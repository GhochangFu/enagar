/**
 * Phase 11 API smoke — dept-head payment link + payment_paid auto-advance.
 *
 * Prereq: API :3001, Keycloak :8080, DB seeded, APPLICATION_STORE_PROVIDER=postgres
 *
 * Usage: pnpm smoke:phase11
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { phase11PwdSmokeWorkflow } from './lib/phase11-pwd-workflow.mjs';
import { uploadCleanDocument } from './lib/document-smoke-lib.mjs';
import { PHASE11_TRADE_LICENCE_PAYMENT_CONFIG } from './lib/trade-licence-payment-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
const SERVICE_CODE = process.env.PHASE11_SERVICE_CODE ?? 'trade-licence';
const CLERK_USER = 'kmc-tenant-clerk-dummy';
const ADMIN_USER = 'kmc-municipality-admin-dummy';

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
  console.log(`[phase11-pay] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase11-pay] FAIL: ${message}`);
  process.exit(1);
}

async function kcToken(username) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-tenant',
    username,
    password: KC_PASSWORD,
  });
  const res = await fetch(KC_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) fail(`Keycloak token for ${username}: ${res.status}`);
  return (await res.json()).access_token;
}

async function api(method, path, token, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
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

async function assignDesignations(adminTok, username, codes) {
  const { res: desigRes, json: designations } = await api('GET', '/admin/tenant/org/designations', adminTok);
  assertOk('designations', desigRes.status, JSON.stringify(designations));
  const designationIds = codes.map((code) => {
    const row = designations.find((d) => d.code === code && d.is_active);
    if (!row) fail(`Missing designation ${code}`);
    return row.id;
  });
  const { res: staffRes, json: staff } = await api('GET', '/admin/tenant/staff', adminTok);
  assertOk('staff', staffRes.status, JSON.stringify(staff));
  const user = staff.find((row) => row.username === username);
  if (!user) fail(`Staff ${username} missing`);
  const { res: assignRes, text } = await api(
    'PUT',
    `/admin/tenant/org/users/${user.id}/designations`,
    adminTok,
    { designation_ids: designationIds },
  );
  assertOk(`assign ${username}`, assignRes.status, text);
}

async function deskTransition(token, applicationId, verb) {
  const { res, text } = await api(
    'POST',
    `/admin/tenant/desk/applications/${applicationId}/transitions`,
    token,
    { verb, comment: `phase11 ${verb}` },
  );
  if (res.status < 200 || res.status >= 300) {
    fail(`transition ${verb} (${res.status}): ${text.slice(0, 400)}`);
  }
  return { res, json: text ? JSON.parse(text) : null, text };
}

async function main() {
  log('start', 'post-approval payment smoke');
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail('API not healthy on :3001');

  const adminTok = await kcToken(ADMIN_USER);
  const { res: servicesRes, json: services } = await api('GET', '/admin/tenant/services', adminTok);
  assertOk('services', servicesRes.status, JSON.stringify(services));
  const service =
    services.find((row) => (row.code ?? '').trim() === SERVICE_CODE) ?? services[0];
  if (!service?.id) fail('No tenant service');

  const { res: designerRes, json: designer } = await api(
    'GET',
    `/admin/tenant/services/${service.id}/designer`,
    adminTok,
  );
  assertOk('designer', designerRes.status, JSON.stringify(designer));
  const serviceCode = designer.service?.code ?? service.code;
  const workflow = phase11PwdSmokeWorkflow(serviceCode);
  const submittedStage = workflow.stages.find((stage) => stage.code === 'submitted');
  if (submittedStage) {
    submittedStage.owner_role = 'tenant_clerk';
    submittedStage.owner_designation = 'pwd_junior_engineer';
  }
  for (const transition of workflow.transitions) {
    if (transition.from === 'submitted' && transition.verb === 'forward') {
      transition.actor_role = 'tenant_clerk';
      transition.actor_designation = 'pwd_junior_engineer';
    }
  }
  workflow.version = Math.max(
    designer.workflow_draft?.definition?.version ?? 0,
    designer.workflow_published?.definition?.version ?? 0,
    1,
  ) + 1;

  await api('PATCH', `/admin/tenant/services/${service.id}/workflow-draft`, adminTok, {
    workflow,
  }).then(({ res, text }) => assertOk('workflow draft', res.status, text));
  await api('PATCH', `/admin/tenant/services/${service.id}/workflow-draft/publish`, adminTok).then(
    ({ res, text }) => assertOk('publish', res.status, text),
  );
  await api('PATCH', `/admin/tenant/services/${service.id}/config`, adminTok, {
    municipal_signoff_policy: 'never',
    ...PHASE11_TRADE_LICENCE_PAYMENT_CONFIG,
  }).then(({ res, text }) => assertOk('service config', res.status, text));

  await assignDesignations(adminTok, CLERK_USER, [
    'pwd_junior_engineer',
    'pwd_assistant_engineer',
    'pwd_executive_engineer',
  ]);

  const citizenMobile = '9876500111';
  const { res: otpRes, json: citizenTok } = await api('POST', '/auth/verify-otp', null, {
    mobile: citizenMobile,
    otp: OTP,
  });
  assertOk('citizen otp', otpRes.status, JSON.stringify(citizenTok));

  await api(
    'POST',
    '/citizen/register',
    citizenTok.access_token,
    { name: 'Phase11 Payment Smoke', mobile: citizenMobile },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res }) => {
    if (![200, 201, 409].includes(res.status)) fail(`register ${res.status}`);
  });

  const formData = {
    applicant_name: 'Phase11 Payment',
    business_name: 'Smoke Traders',
    trade_type: 'retail',
    premises_proof: { name: 'premises.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
  };

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    citizenTok.access_token,
    { service_code: serviceCode, form_data: formData },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('draft', draftRes.status, JSON.stringify(draft));

  if (process.env.ALLOW_CLIENT_SCAN_SIMULATION === 'true') {
    await uploadCleanDocument(api, assertOk, citizenTok.access_token, draft.id, {
      documentCode: 'premises_proof',
      originalName: 'premises.pdf',
      scanProvider: 'phase11-smoke',
      tenantCode: TENANT,
    });
  }

  const applicationFeePaise =
    PHASE11_TRADE_LICENCE_PAYMENT_CONFIG.fee_lines.application.rule.amount_paise;
  const { res: payInitRes, json: appPayment } = await api(
    'POST',
    '/payments/initiate',
    citizenTok.access_token,
    {
      application_id: draft.id,
      amount_paise: applicationFeePaise,
      method: 'upi',
      fee_code: 'application',
    },
    {
      'x-enagar-tenant-code': TENANT,
      'idempotency-key': `phase11-app-fee-${draft.id}`,
    },
  );
  assertOk('initiate application fee', payInitRes.status, JSON.stringify(appPayment));
  await api(
    'POST',
    '/payments/stub/complete',
    citizenTok.access_token,
    {
      payment_id: appPayment.id,
      gateway_order_id: appPayment.gateway_order_id,
    },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res, text }) => assertOk('stub application fee', res.status, text));

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    citizenTok.access_token,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('submit', submitRes.status, JSON.stringify(submitted));

  const applicationId = submitted.id;
  const docketNo = submitted.docket_no;
  const clerkTok = await kcToken(CLERK_USER);

  for (let step = 0; step < 4; step += 1) {
    await deskTransition(clerkTok, applicationId, 'forward');
  }

  let detail = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk detail', detail.res.status, detail.text);
  if (detail.json.application.current_stage !== 'dept-head-review') {
    fail(`expected dept-head-review, got ${detail.json.application.current_stage}`);
  }

  await deskTransition(clerkTok, applicationId, 'forward-to-dept-head-final');
  detail = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk after skip ladder', detail.res.status, detail.text);
  if (detail.json.application.current_stage !== 'dept-head-final') {
    fail(`expected dept-head-final, got ${detail.json.application.current_stage}`);
  }

  await deskTransition(clerkTok, applicationId, 'forward');
  detail = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk after payment link', detail.res.status, detail.text);
  if (detail.json.application.current_stage !== 'payment-pending') {
    fail(`expected payment-pending, got ${detail.json.application.current_stage}`);
  }
  if (detail.json.application.payment_status !== 'pending') {
    fail(`expected payment_status pending, got ${detail.json.application.payment_status}`);
  }
  if (!detail.json.application.payment_redirect_url) {
    fail('expected payment_redirect_url on desk detail');
  }

  const activePaymentId = detail.json.application.active_payment_id;
  if (!activePaymentId) fail('active_payment_id missing after payment link');

  const stubOrder = `stub_order_${activePaymentId}`;
  const { res: payRes, text: payText } = await api(
    'POST',
    '/payments/stub/complete',
    citizenTok.access_token,
    { payment_id: activePaymentId, gateway_order_id: stubOrder },
  );
  assertOk('stub-complete', payRes.status, payText);

  detail = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk after paid', detail.res.status, detail.text);
  if (detail.json.application.current_stage !== 'payment-received') {
    fail(`expected payment-received after pay, got ${detail.json.application.current_stage}`);
  }
  if (detail.json.application.payment_status !== 'paid') {
    fail(`expected paid status, got ${detail.json.application.payment_status}`);
  }

  log('ok', `docket ${docketNo} reached payment-received`);
  console.log('[phase11-pay] PASS');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
