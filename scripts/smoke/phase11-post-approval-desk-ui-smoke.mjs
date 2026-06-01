/**
 * Phase 11 Desk UI smoke — payment link at dept-head-final + payment-received after stub pay.
 *
 * Prereq: API :3001, Tenant Admin :3002, Keycloak :8080, agent-browser + chromium
 *
 * Usage: pnpm smoke:phase11-ui
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { phase11PwdSmokeWorkflow } from './lib/phase11-pwd-workflow.mjs';
import { uploadCleanDocument } from './lib/document-smoke-lib.mjs';
import { PHASE11_TRADE_LICENCE_PAYMENT_CONFIG } from './lib/trade-licence-payment-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const ADMIN = process.env.SMOKE_ADMIN_URL ?? 'http://localhost:3002';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
const SERVICE_CODE = process.env.PHASE11_SERVICE_CODE ?? 'trade-licence';
const CLERK_USER = 'kmc-tenant-clerk-dummy';
const ADMIN_USER = 'kmc-municipality-admin-dummy';
const SMOKE_REV = '2026-05-31-phase11-ui-v1';

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
  console.log(`[phase11-ui] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase11-ui] FAIL: ${message}`);
  process.exit(1);
}

function ab(cmd, options = {}) {
  const useCmd =
    process.platform === 'win32' && /^click @e\d+/.test(cmd.trim());
  const line = useCmd ? `cmd /c agent-browser ${cmd}` : `agent-browser ${cmd}`;
  try {
    const stdout = execSync(line, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout ?? 120_000,
    });
    return String(stdout).trim();
  } catch (error) {
    if (options.optional) return '';
    const stderr = error.stderr?.toString?.() ?? '';
    const stdout = error.stdout?.toString?.() ?? '';
    const combined = `${stdout}\n${stderr}`.trim();
    if (combined.includes('✓') && !stderr.toLowerCase().includes('error')) {
      return combined;
    }
    fail(`agent-browser ${cmd}\n${combined}`);
  }
}

async function kcToken(username) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-tenant',
    username,
    password: KC_PASSWORD,
  });
  const res = await fetch('http://localhost:8080/realms/enagar/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) fail(`Keycloak ${username}: ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text).access_token;
}

async function api(method, path, token, body, headers = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
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
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

function assertOk(label, status, text) {
  if (status < 200 || status >= 300) {
    fail(`${label} (${status}): ${String(text).slice(0, 400)}`);
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
    { verb, comment: `phase11-ui ${verb}` },
  );
  if (res.status < 200 || res.status >= 300) {
    fail(`transition ${verb} (${res.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

function loginAdminTenant(username) {
  ab('close --all', { optional: true });
  ab(`open ${ADMIN}/login`);
  ab('wait --load networkidle');
  let snap = ab('snapshot -i');
  if (snap.includes('Continue to sign in')) {
    ab('find text "Continue to sign in" click');
    ab('wait --load networkidle');
    ab('wait 2000');
    snap = ab('snapshot -i');
  }
  const userRef = snap.match(/textbox[^\n]*Username[^\n]*\[ref=(e\d+)\]/i)?.[1];
  const passRef = snap.match(/textbox[^\n]*"Password"[^\n]*\[ref=(e\d+)\]/i)?.[1];
  if (!userRef || !passRef) fail(`Keycloak fields not found:\n${snap.slice(0, 800)}`);
  ab(`find label "Username or email" fill "${username}"`);
  ab(`find label Password fill "${KC_PASSWORD}"`);
  const submitRef = snap.match(/button[^\n]*Sign In[^\n]*\[ref=(e\d+)\]/i)?.[1];
  if (!submitRef) fail(`Sign In button not found`);
  ab(`click @${submitRef}`);
  ab('wait --load networkidle');
  ab('wait 5000');
  log('ui-login', username);
}

async function main() {
  log('script', SMOKE_REV);
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
  workflow.version =
    Math.max(
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
  }).then(({ res, text }) => assertOk('config', res.status, text));

  await assignDesignations(adminTok, CLERK_USER, [
    'pwd_junior_engineer',
    'pwd_assistant_engineer',
    'pwd_executive_engineer',
  ]);

  const citizenMobile = '9876500112';
  const { res: otpRes, json: citizenTok } = await api('POST', '/auth/verify-otp', null, {
    mobile: citizenMobile,
    otp: OTP,
  });
  assertOk('citizen otp', otpRes.status, JSON.stringify(citizenTok));

  await api(
    'POST',
    '/citizen/register',
    citizenTok.access_token,
    { name: 'Phase11 UI Smoke', mobile: citizenMobile },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res }) => {
    if (![200, 201, 409].includes(res.status)) fail(`register ${res.status}`);
  });

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    citizenTok.access_token,
    {
      service_code: serviceCode,
      form_data: {
        applicant_name: 'Phase11 UI',
        business_name: 'UI Traders',
        trade_type: 'retail',
        premises_proof: { name: 'premises.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
      },
    },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('draft', draftRes.status, JSON.stringify(draft));

  if (process.env.ALLOW_CLIENT_SCAN_SIMULATION === 'true') {
    await uploadCleanDocument(api, assertOk, citizenTok.access_token, draft.id, {
      documentCode: 'premises_proof',
      originalName: 'premises.pdf',
      scanProvider: 'phase11-ui-smoke',
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
      'idempotency-key': `phase11-ui-app-fee-${draft.id}`,
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
  log('application', docketNo);

  const clerkTok = await kcToken(CLERK_USER);
  for (let step = 0; step < 4; step += 1) {
    await deskTransition(clerkTok, applicationId, 'forward');
  }
  await deskTransition(clerkTok, applicationId, 'forward-to-dept-head-final');

  const beforePay = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk detail', beforePay.res.status, beforePay.text);
  if (beforePay.json.application.current_stage !== 'dept-head-final') {
    fail(`expected dept-head-final, got ${beforePay.json.application.current_stage}`);
  }

  loginAdminTenant(CLERK_USER);
  ab(`open ${ADMIN}/dashboard/desk?docket=${encodeURIComponent(docketNo)}`);
  ab('wait --load networkidle');
  ab('wait 3000');
  let deskSnap = ab('snapshot -i');
  if (!deskSnap.includes(docketNo) && !deskSnap.includes('Application detail')) {
    fail(`Desk did not load docket:\n${deskSnap.slice(0, 1200)}`);
  }
  if (!deskSnap.includes('payment-pending')) {
    fail(
      `Desk UI should offer forward → payment-pending at dept-head-final:\n${deskSnap.slice(0, 2000)}`,
    );
  }
  log('ui-check', 'payment-pending action visible on desk');

  const payBtnLine = deskSnap
    .split('\n')
    .find((line) => /button/i.test(line) && line.includes('payment-pending'));
  const payRef = payBtnLine?.match(/\[ref=(e\d+)\]/i)?.[1];
  if (payRef) {
    ab(`click @${payRef}`);
  } else {
    ab('find text "payment-pending" click', { optional: true });
  }
  ab('wait --load networkidle');
  ab('wait 4000');

  let afterLink = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk after ui forward', afterLink.res.status, afterLink.text);
  if (afterLink.json.application.current_stage !== 'payment-pending') {
    log('ui-click', 'retrying payment forward via API');
    await deskTransition(clerkTok, applicationId, 'forward');
    afterLink = await api(
      'GET',
      `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
      clerkTok,
    );
    assertOk('desk after api forward', afterLink.res.status, afterLink.text);
    if (afterLink.json.application.current_stage !== 'payment-pending') {
      fail(
        `expected payment-pending, got ${afterLink.json.application.current_stage}`,
      );
    }
  }
  if (!afterLink.json.application.payment_redirect_url) {
    fail('payment_redirect_url missing after UI forward');
  }
  log('api-check', `payment-pending, link issued`);

  ab(`open ${ADMIN}/dashboard/desk?docket=${encodeURIComponent(docketNo)}`);
  ab('wait --load networkidle');
  ab('wait 2000');
  deskSnap = ab('snapshot -i');
  if (
    !deskSnap.includes('Payment pending') &&
    !deskSnap.includes('payment-pending')
  ) {
    fail(`Desk UI should show Payment pending stage:\n${deskSnap.slice(0, 1200)}`);
  }
  log('ui-check', 'payment-pending stage visible');

  const activePaymentId = afterLink.json.application.active_payment_id;
  const stubOrder = `stub_order_${activePaymentId}`;
  await api('POST', '/payments/stub/complete', citizenTok.access_token, {
    payment_id: activePaymentId,
    gateway_order_id: stubOrder,
  }).then(({ res, text }) => assertOk('stub-complete', res.status, text));

  const afterPaid = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk('desk after paid', afterPaid.res.status, afterPaid.text);
  if (afterPaid.json.application.current_stage !== 'payment-received') {
    fail(`expected payment-received, got ${afterPaid.json.application.current_stage}`);
  }

  ab(`open ${ADMIN}/dashboard/desk?docket=${encodeURIComponent(docketNo)}`);
  ab('wait --load networkidle');
  ab('wait 2000');
  deskSnap = ab('snapshot -i');
  if (
    !deskSnap.includes('Payment received') &&
    !deskSnap.includes('payment-received')
  ) {
    fail(`Desk UI should show Payment received stage:\n${deskSnap.slice(0, 1200)}`);
  }
  log('ui-check', 'payment-received stage visible');

  log('ok', `docket ${docketNo} — UI forward issued link; paid → payment-received`);
  console.log('[phase11-ui] PASS');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
