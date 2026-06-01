/**
 * Phase 8 Desk UI smoke — return + reject (Playwright + API setup).
 *
 * Prereq: API :3001, Tenant Admin :3002, Keycloak :8080, DB seeded,
 *   pnpm infra:seed-keycloak-users, ALLOW_CLIENT_SCAN_SIMULATION=true (or MinIO scan path)
 *   Playwright: npx playwright install chromium (once)
 *
 * Usage: node scripts/smoke/phase8-desk-reject-return-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { phase8DeskSmokeWorkflow } from './lib/phase8-desk-workflow.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const ADMIN = process.env.SMOKE_ADMIN_URL ?? 'http://localhost:3002';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
const SERVICE_CODE = 'ad-hoarding';
const CLERK_USER = 'kmc-tenant-clerk-dummy';
const ADMIN_USER = 'kmc-municipality-admin-dummy';
/** Bump when smoke logic changes — confirm latest script in console output. */
const SMOKE_SCRIPT_REV = '2026-05-30-desk-queue-v3';

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8',
);

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
  console.log(`[phase8-desk] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase8-desk] FAIL: ${message}`);
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
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail(`Keycloak token ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    fail(`Keycloak token for ${username}: ${res.status} ${text.slice(0, 300)}`);
  }
  return json.access_token;
}

async function citizenToken(mobile = '9876500099') {
  const res = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile, otp: OTP }),
  });
  const text = await res.text();
  if (!res.ok) fail(`Citizen OTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (!json.access_token) fail('Citizen token missing');
  return json.access_token;
}

async function api(method, path, token, body, extraHeaders = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, text };
}

function serviceCodeFromRow(row) {
  const code = row?.code ?? row?.service_code;
  return typeof code === 'string' ? code.trim() : '';
}

function assertOk(label, status, text, hint) {
  if (status < 200 || status >= 300) {
    const extra = hint ? ` — ${hint}` : '';
    fail(`${label} (${status})${extra}: ${String(text).slice(0, 400)}`);
  }
}

/** Same post-process as hoarding-boc-e2e-smoke — ensures clerk Desk queue after citizen submit. */
function patchPhase8WorkflowForDesk(workflow) {
  const submitted = workflow.stages.find((stage) => stage.code === 'submitted');
  if (submitted) {
    submitted.owner_role = 'tenant_clerk';
    submitted.owner_designation = 'hoarding_clerk';
  }
  for (const transition of workflow.transitions) {
    if (transition.from === 'submitted' && transition.verb === 'forward') {
      transition.actor_role = 'tenant_clerk';
      transition.actor_designation = 'hoarding_clerk';
    }
  }
  return workflow;
}

function submittedStageFromDefinition(definition) {
  return definition?.stages?.find((stage) => stage.code === 'submitted');
}

async function uploadCleanDocument(citizenTok, applicationId, documentCode, mimeType, originalName) {
  const { res: intentRes, json: intent } = await api('POST', '/documents/upload-intent', citizenTok, {
    application_id: applicationId,
    document_code: documentCode,
    original_name: originalName,
    mime_type: mimeType,
    size_mb: 0.01,
  });
  assertOk('upload-intent', intentRes.status, JSON.stringify(intent));

  if (process.env.ALLOW_CLIENT_SCAN_SIMULATION !== 'true') {
    const { res: confirmRes, text: confirmText } = await api(
      'POST',
      `/documents/${intent.id}/confirm-upload`,
      citizenTok,
    );
    assertOk('confirm-upload', confirmRes.status, confirmText);
  }

  const { res: scanRes, text: scanText } = await api(
    'POST',
    `/documents/${intent.id}/scan-result`,
    citizenTok,
    { scan_status: 'clean', scan_provider: 'phase8-desk-smoke' },
  );
  assertOk('scan-result', scanRes.status, scanText);
}

async function fetchDeskDetail(token, docketNo) {
  return api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    token,
  ).then(({ res, json, text }) => {
    assertOk('desk get', res.status, text, `docket=${docketNo}`);
    return json;
  });
}

function deskCurrentStage(detail) {
  return detail.application.current_stage ?? detail.application.status;
}

async function deskTransition(token, applicationId, verb, extra = {}) {
  const { res, text } = await api(
    'POST',
    `/admin/tenant/desk/applications/${applicationId}/transitions`,
    token,
    { verb, comment: extra.comment ?? `phase8-desk-smoke ${verb}`, ...extra },
  );
  if (res.status < 200 || res.status >= 300) {
    fail(`desk transition ${verb} (${res.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

async function assignDesignations(adminTok, username, codes) {
  const { res: desigRes, json: designations } = await api(
    'GET',
    '/admin/tenant/org/designations',
    adminTok,
  );
  assertOk('list designations', desigRes.status, JSON.stringify(designations));

  const designationIds = [];
  for (const code of codes) {
    const row = designations.find((d) => d.code === code && d.is_active);
    if (!row) fail(`Missing designation ${code} — run apps/api prisma db seed`);
    designationIds.push(row.id);
  }

  const { res: staffRes, json: staff } = await api('GET', '/admin/tenant/staff', adminTok);
  assertOk('list staff', staffRes.status, JSON.stringify(staff));
  const user = staff.find((row) => row.username === username);
  if (!user) fail(`Staff user ${username} missing — pnpm infra:seed-keycloak-users`);

  const { res: assignRes, text: assignText } = await api(
    'PUT',
    `/admin/tenant/org/users/${user.id}/designations`,
    adminTok,
    { designation_ids: designationIds },
  );
  assertOk(`assign ${username}`, assignRes.status, assignText);
  log('staff', `${username} ← ${codes.join(', ')}`);
}

async function loginTenantAdmin(page, username) {
  await page.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('link', { name: /Continue to sign in/i }).click();
  await page.waitForURL(/8080|realms\/enagar/i, { timeout: 20000 });
  const userField = page.locator('#username, input[name="username"]').first();
  await userField.waitFor({ state: 'visible', timeout: 15000 });
  await userField.fill(username);
  await page.locator('#password, input[name="password"]').first().fill(KC_PASSWORD);
  await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();
  await page.waitForURL(/localhost:3002/, { timeout: 30000 });
  log('ui-login', username);
}

async function openDeskApplication(page, docketNo) {
  await page.goto(
    `${ADMIN}/dashboard/desk?docket=${encodeURIComponent(docketNo)}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  );
  await page.getByText('Application detail').waitFor({ timeout: 15000 });
  await page.getByText(docketNo).first().waitFor({ timeout: 15000 });
}

async function main() {
  log('script', SMOKE_SCRIPT_REV);
  log('health');
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail('API health not ok — start pnpm --filter @enagar/api dev');

  const adminTok = await kcToken(ADMIN_USER);

  const { res: servicesRes, json: services } = await api('GET', '/admin/tenant/services', adminTok);
  assertOk('list services', servicesRes.status, JSON.stringify(services));
  if (!Array.isArray(services)) {
    fail('list services returned non-array payload');
  }
  const service =
    services.find((row) => serviceCodeFromRow(row) === SERVICE_CODE) ??
    services.find((row) => serviceCodeFromRow(row).startsWith(`${SERVICE_CODE}-`)) ??
    services.find(
      (row) => serviceCodeFromRow(row).replace(/-local$/, '') === SERVICE_CODE,
    );
  if (!service?.id) {
    fail(
      `Service ${SERVICE_CODE} not found — adopt catalogue for KMC. Have: ${services.map((r) => serviceCodeFromRow(r) || JSON.stringify(r)).join(', ')}`,
    );
  }

  const { res: designerRes, json: designer, text: designerText } = await api(
    'GET',
    `/admin/tenant/services/${service.id}/designer`,
    adminTok,
  );
  assertOk('get service designer', designerRes.status, designerText);
  const serviceCode = designer?.service?.code ?? serviceCodeFromRow(service);
  if (!serviceCode) {
    fail('Could not resolve tenant service code from designer or services list');
  }

  const workflow = patchPhase8WorkflowForDesk(phase8DeskSmokeWorkflow(serviceCode));
  // Same code pattern as hoarding-boc smoke / createLinearWorkflowDraft (API prefix rule).
  workflow.code = `${serviceCode}-workflow-v1`;
  workflow.version = Math.max(
    designer?.workflow_draft?.definition?.version ?? 0,
    designer?.workflow_published?.definition?.version ?? 0,
    designer?.starter_workflow?.version ?? 1,
    1,
  );

  const expectedPrefix = `${serviceCode}-`;
  if (!workflow.code.startsWith(expectedPrefix)) {
    fail(
      `Workflow code "${workflow.code}" must start with "${expectedPrefix}" (service ${service.id})`,
    );
  }
  log('workflow-draft', `${workflow.code} v${workflow.version} for service ${serviceCode}`);

  const { res: wfRes, json: wfSaved, text: wfText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft`,
    adminTok,
    { workflow },
  );
  assertOk(
    'save workflow draft',
    wfRes.status,
    wfText,
    `workflow.code=${workflow.code} service.code=${serviceCode}`,
  );
  const draftSubmitted = submittedStageFromDefinition(wfSaved?.definition);
  if (draftSubmitted?.owner_designation !== 'hoarding_clerk') {
    fail(
      `Draft submitted stage must be owned by hoarding_clerk (got ${JSON.stringify(draftSubmitted)})`,
    );
  }

  const { res: pubRes, text: pubText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft/publish`,
    adminTok,
  );
  assertOk('publish workflow', pubRes.status, pubText);

  const { res: designer2Res, json: designer2, text: designer2Text } = await api(
    'GET',
    `/admin/tenant/services/${service.id}/designer`,
    adminTok,
  );
  assertOk('verify published workflow', designer2Res.status, designer2Text);
  const publishedSubmitted = submittedStageFromDefinition(
    designer2?.workflow_published?.definition,
  );
  if (publishedSubmitted?.owner_designation !== 'hoarding_clerk') {
    fail(
      `Published submitted stage must be hoarding_clerk (got ${JSON.stringify(publishedSubmitted)})`,
    );
  }
  log('workflow', `${workflow.code} published with clerk-owned submitted stage`);

  await assignDesignations(adminTok, CLERK_USER, [
    'hoarding_clerk',
    'hoarding_inspector',
    'pwd_executive_engineer',
  ]);

  const citizenMobile = '9876500099';
  const citizenTok = await citizenToken(citizenMobile);
  await api(
    'POST',
    '/citizen/register',
    citizenTok,
    { name: 'Phase8 Desk Smoke', mobile: citizenMobile },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res }) => {
    if (res.status !== 201 && res.status !== 200 && res.status !== 409) {
      fail(`citizen register ${res.status}`);
    }
  });

  const formData = {
    applicant_name: 'Phase8 Desk Applicant',
    site_address: '1 Smoke Lane, Kolkata',
    hoarding_dimensions: '6ft x 4ft',
    site_photo: { name: 'site.jpg', mime_type: 'image/jpeg', size_mb: 0.01 },
    creative_mock: { name: 'creative.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
  };

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    citizenTok,
    { service_code: SERVICE_CODE, form_data: formData },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('create draft', draftRes.status, JSON.stringify(draft));
  await uploadCleanDocument(citizenTok, draft.id, 'site_photo', 'image/jpeg', 'site.jpg');
  await uploadCleanDocument(citizenTok, draft.id, 'creative_mock', 'application/pdf', 'creative.pdf');

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    citizenTok,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('submit', submitRes.status, JSON.stringify(submitted));
  const docketNo = submitted.docket_no;
  const applicationId = submitted.id;
  log(
    'application',
    `${docketNo} pending=${submitted.pending_designation ?? 'null'}/${submitted.pending_role ?? 'null'} workflow=${submitted.workflow_code}`,
  );
  if (submitted.pending_designation !== 'hoarding_clerk') {
    fail(
      `After submit, pending_designation must be hoarding_clerk (got ${submitted.pending_designation ?? 'null'}, role=${submitted.pending_role ?? 'null'}). Published workflow may be stale — re-run smoke.`,
    );
  }

  const clerkTok = await kcToken(CLERK_USER);

  const { res: inboxRes, json: inbox } = await api(
    'GET',
    '/admin/tenant/desk/inbox/applications?queue=my',
    clerkTok,
  );
  assertOk('desk inbox my', inboxRes.status, JSON.stringify(inbox));
  const inboxRows = Array.isArray(inbox) ? inbox : [];
  if (!inboxRows.some((row) => row.docket_no === docketNo)) {
    fail(
      `${docketNo} not in clerk my-queue (inbox has ${inboxRows.length} items). Check staff designations for ${CLERK_USER}.`,
    );
  }

  let detail = await fetchDeskDetail(clerkTok, docketNo);

  detail = await deskTransition(clerkTok, applicationId, 'forward');
  detail = await deskTransition(clerkTok, applicationId, 'forward');
  const atChecker = detail.application.current_stage ?? detail.application.status;
  if (atChecker !== 'checker-review') {
    fail(`Expected checker-review after two forwards, got ${atChecker}`);
  }
  log('api-setup', `at ${atChecker}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginTenantAdmin(page, CLERK_USER);
    await openDeskApplication(page, docketNo);

    const rejectButtons = page.getByRole('button', { name: /^Reject →/i });
    if ((await rejectButtons.count()) > 0) {
      fail('Clerk at checker-review should not see Reject action buttons');
    }
    log('ui-check', 'clerk: no Reject button at checker');

    await page
      .getByPlaceholder('Comment for workflow action')
      .fill('Returning to maker for correction of site dimensions');
    await page.getByRole('button', { name: /^Return → maker-review/i }).click();
    await page
      .getByRole('button', { name: /^Forward → checker-review/i })
      .waitFor({ state: 'visible', timeout: 15000 });
    log('ui-check', 'clerk: Return → maker-review succeeded');
  } finally {
    await context.close();
  }

  detail = await fetchDeskDetail(clerkTok, docketNo);
  let stage = deskCurrentStage(detail);
  if (stage !== 'maker-review') {
    if (stage === 'checker-review') {
      log('note', 'sync return via API after UI');
      detail = await deskTransition(clerkTok, applicationId, 'return');
      stage = deskCurrentStage(detail);
    }
    if (stage !== 'maker-review') {
      fail(`After return expected maker-review, got ${stage}`);
    }
  }

  detail = await deskTransition(clerkTok, applicationId, 'forward');
  detail = await deskTransition(clerkTok, applicationId, 'forward');
  const atHead = deskCurrentStage(detail);
  if (atHead !== 'dept-head-review') {
    fail(`Expected dept-head-review, got ${atHead}`);
  }
  log('api-setup', `at ${atHead}`);

  detail = await fetchDeskDetail(clerkTok, docketNo);
  const allowedVerbs = (detail.allowed_transitions ?? []).map((item) => item.verb);
  log('allowed-at-head', allowedVerbs.join(', ') || 'none');
  if (!allowedVerbs.includes('reject')) {
    fail(
      `reject must be allowed at ${deskCurrentStage(detail)} for ${CLERK_USER} with pwd_executive_engineer`,
    );
  }

  const headContext = await browser.newContext();
  const headPage = await headContext.newPage();
  try {
    await loginTenantAdmin(headPage, CLERK_USER);
    await openDeskApplication(headPage, docketNo);

    const rejectBtn = headPage.getByRole('button', { name: /Reject/i });
    await rejectBtn.waitFor({ state: 'visible', timeout: 10000 });

    await headPage.getByPlaceholder('Comment for workflow action').fill('');
    await rejectBtn.click();
    await headPage.getByText(/Comment is required/i).waitFor({ timeout: 8000 });
    log('ui-check', 'dept head: reject blocked without comment');

    await headPage
      .getByPlaceholder('Comment for workflow action')
      .fill('Phase 8 smoke — application rejected at department head');
    await rejectBtn.click();
    await headPage.getByText(/rejected/i).first().waitFor({ timeout: 15000 });
    log('ui-check', 'dept head: Reject → rejected succeeded');
  } finally {
    await headContext.close();
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        docket_no: docketNo,
        application_id: applicationId,
        service_code: SERVICE_CODE,
      },
      null,
      2,
    ),
  );
  log('PASS', `${docketNo} — return + reject Desk UI smoke`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
