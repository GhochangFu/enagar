/**
 * Phase 13C smoke — upfront_and_deferred: application fee before submit; no approval pay yet.
 *
 * Prereq: API :3001, Keycloak :8080
 *
 * Usage: pnpm smoke:phase13-dual
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveApplicationFeePaise,
  uploadCleanDocument,
} from './lib/document-smoke-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
const SERVICE_CODE = process.env.PHASE13_DUAL_SERVICE ?? 'trade-licence';
const APPLICATION_FEE_PAISE = Number(process.env.PHASE13_TRADE_APPLICATION_FEE_PAISE ?? '50000');

function loadInfraEnv() {
  const path = resolve(repoRoot, 'infrastructure/.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadInfraEnv();

function log(step, detail) {
  console.log(`[phase13-dual] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase13-dual] FAIL: ${message}`);
  process.exit(1);
}

async function api(method, path, token, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, text };
}

function assertOk(label, status, text) {
  if (status < 200 || status >= 300) {
    fail(`${label} (${status}): ${String(text).slice(0, 500)}`);
  }
}

async function stubComplete(token, payment) {
  const { res, text } = await api('POST', '/payments/stub/complete', token, {
    payment_id: payment.id,
    gateway_order_id: payment.gateway_order_id,
  }, { 'x-enagar-tenant-code': TENANT });
  if (res.status < 200 || res.status >= 300) {
    fail(`stub complete (${res.status}): ${text.slice(0, 400)}`);
  }
}

async function main() {
  log('start', `${SERVICE_CODE} dual-fee application line`);
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail('API not healthy on :3001');

  const { res: servicesRes, json: services } = await api(
    'GET',
    `/services/tenants/${TENANT}`,
    null,
  );
  assertOk('catalogue', servicesRes.status, JSON.stringify(services));
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(`Service ${SERVICE_CODE} missing on ${TENANT}`);
  const schedule = service.payment_schedule ?? 'upfront_and_deferred';
  if (schedule !== 'upfront_and_deferred') {
    fail(`Expected payment_schedule upfront_and_deferred, got ${schedule}`);
  }

  const citizenMobile = process.env.PHASE13_CITIZEN_MOBILE ?? '9876501302';
  const { res: otpRes, json: citizenTok } = await api('POST', '/auth/verify-otp', null, {
    mobile: citizenMobile,
    otp: OTP,
  });
  assertOk('citizen otp', otpRes.status, JSON.stringify(citizenTok));
  const token = citizenTok.access_token;

  await api(
    'POST',
    '/citizen/register',
    token,
    { name: 'Phase13 Dual Smoke', mobile: citizenMobile },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res }) => {
    if (![200, 201, 409].includes(res.status)) fail(`register ${res.status}`);
  });

  const formData = {
    applicant_name: 'Phase13 Dual',
    business_name: 'Dual Fee Traders',
    trade_type: 'retail',
    premises_proof: { name: 'premises.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
  };

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    token,
    { service_code: SERVICE_CODE, form_data: formData },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('draft', draftRes.status, JSON.stringify(draft));

  await uploadCleanDocument(api, assertOk, token, draft.id, {
    documentCode: 'premises_proof',
    originalName: 'premises.pdf',
    scanProvider: 'phase13-dual-smoke',
    tenantCode: TENANT,
  });
  log('documents', 'premises_proof scan-clean');

  const applicationFeePaise = resolveApplicationFeePaise(service, APPLICATION_FEE_PAISE);

  const { res: submitBlockedRes, text: submitBlockedText } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    token,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  if (submitBlockedRes.status !== 400) {
    fail(`submit should be 400 before application fee, got ${submitBlockedRes.status}`);
  }
  if (!submitBlockedText.includes('Application fee must be paid')) {
    fail(`submit error missing fee gate message: ${submitBlockedText}`);
  }
  log('gate', 'submit blocked until application fee paid');

  const { res: payRes, json: payment } = await api(
    'POST',
    '/payments/initiate',
    token,
    {
      application_id: draft.id,
      amount_paise: applicationFeePaise,
      method: 'upi',
      fee_code: 'application',
    },
    {
      'x-enagar-tenant-code': TENANT,
      'idempotency-key': `phase13-dual-app-${draft.id}`,
    },
  );
  assertOk('initiate application', payRes.status, JSON.stringify(payment));
  await stubComplete(token, payment);

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    token,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('submit', submitRes.status, JSON.stringify(submitted));
  if (submitted.fee_settlement?.application?.status !== 'paid') {
    fail(`application fee line not paid after submit: ${JSON.stringify(submitted.fee_settlement)}`);
  }
  if (submitted.fee_settlement?.approval?.status !== 'not_required') {
    fail(`approval fee should stay not_required until desk link: ${JSON.stringify(submitted.fee_settlement)}`);
  }
  if (submitted.current_stage === 'payment-pending') {
    fail('submitted application should not be at payment-pending yet');
  }

  const { res: approvalInitRes, text: approvalInitText } = await api(
    'POST',
    '/payments/initiate',
    token,
    {
      application_id: draft.id,
      amount_paise: service.fee_line_previews?.approval ?? 100_000,
      method: 'upi',
      fee_code: 'approval',
    },
    {
      'x-enagar-tenant-code': TENANT,
      'idempotency-key': `phase13-dual-approval-${draft.id}`,
    },
  );
  if (approvalInitRes.status < 400) {
    fail(
      `approval initiate should fail before desk link (${approvalInitRes.status}): ${approvalInitText}`,
    );
  }
  log('gate', 'approval fee blocked until desk generate_payment_link');

  log('done', `${submitted.docket_no} — application fee paid, approval deferred to desk (Phase 13D link)`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
