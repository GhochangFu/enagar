/**
 * Hoarding + BOC Phase 7 E2E smoke (API).
 * Prereq: API :3001, Keycloak :8080, DB seeded, pnpm infra:seed-keycloak-users
 * Usage: node scripts/smoke/hoarding-boc-e2e-smoke.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

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

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
const SERVICE_CODE = 'ad-hoarding';
const CLERK_USER = 'kmc-tenant-clerk-dummy';
const ADMIN_USER = 'kmc-municipality-admin-dummy';

const DESIGNATION_CODES = [
  'hoarding_clerk',
  'hoarding_inspector',
  'hoarding_officer',
  'board_of_councillors',
  'executive_officer',
];

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8',
);

function log(step, detail) {
  console.log(`[hoarding-boc] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[hoarding-boc] FAIL: ${message}`);
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

async function citizenToken(mobile = '9876500001') {
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

function assertOk(label, status, text) {
  if (status < 200 || status >= 300) {
    fail(`${label} (${status}): ${text.slice(0, 400)}`);
  }
}

function hoardingWorkflowDefinition() {
  const out = execSync('pnpm exec tsx scripts/smoke/lib/generate-hoarding-workflow.ts', {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const workflow = JSON.parse(out.trim());
  // Desk smoke: first hop is staff-owned (citizen submit already happened via API).
  const submitted = workflow.stages.find((stage) => stage.code === 'submitted');
  if (submitted) {
    submitted.owner_role = 'tenant_clerk';
    submitted.owner_designation = 'hoarding_clerk';
  }
  for (const transition of workflow.transitions) {
    if (
      transition.from === 'submitted' &&
      transition.to === 'clerk-verification' &&
      transition.verb === 'forward'
    ) {
      transition.actor_role = 'tenant_clerk';
      transition.actor_designation = 'hoarding_clerk';
    }
  }
  return workflow;
}

async function uploadCleanDocument(
  citizenTok,
  applicationId,
  documentCode,
  mimeType = 'application/pdf',
  originalName = `${documentCode}.pdf`,
) {
  const { res: intentRes, json: intent } = await api('POST', '/documents/upload-intent', citizenTok, {
    application_id: applicationId,
    document_code: documentCode,
    original_name: originalName,
    mime_type: mimeType,
    size_mb: 0.01,
  });
  assertOk('upload-intent', intentRes.status, JSON.stringify(intent));

  const simulate = process.env.ALLOW_CLIENT_SCAN_SIMULATION === 'true';
  if (!simulate) {
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
    { scan_status: 'clean', scan_provider: 'hoarding-boc-smoke' },
  );
  assertOk('scan-result', scanRes.status, scanText);
  return intent.id;
}

async function deskTransition(clerkTok, applicationId, verb, extra = {}) {
  const { res, text } = await api(
    'POST',
    `/admin/tenant/desk/applications/${applicationId}/transitions`,
    clerkTok,
    { verb, comment: `hoarding-boc-smoke ${verb}`, ...extra },
  );
  if (res.status < 200 || res.status >= 300) {
    fail(`desk transition ${verb} (${res.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

async function main() {
  log('health');
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail('API health not ok');

  const adminTok = await kcToken(ADMIN_USER);
  log('auth', ADMIN_USER);

  const { res: servicesRes, json: services } = await api(
    'GET',
    '/admin/tenant/services',
    adminTok,
  );
  assertOk('list services', servicesRes.status, JSON.stringify(services));
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(`Service ${SERVICE_CODE} not found for tenant — adopt/seed catalogue`);

  log('configure', `workflow + boc_policy on ${service.id}`);

  const workflow = hoardingWorkflowDefinition();
  const { res: wfRes, text: wfText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft`,
    adminTok,
    { workflow },
  );
  assertOk('save workflow draft', wfRes.status, wfText);

  const { res: pubRes, text: pubText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft/publish`,
    adminTok,
  );
  assertOk('publish workflow', pubRes.status, pubText);

  const { res: cfgRes, text: cfgText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/config`,
    adminTok,
    { boc_policy: 'officer_may_require' },
  );
  assertOk('patch boc_policy', cfgRes.status, cfgText);

  const { res: cfgGetRes, json: cfg } = await api(
    'GET',
    `/admin/tenant/services/${service.id}/config`,
    adminTok,
  );
  assertOk('get config', cfgGetRes.status, JSON.stringify(cfg));
  if (cfg.boc_policy !== 'officer_may_require') {
    fail(`expected boc_policy officer_may_require, got ${cfg.boc_policy}`);
  }

  const { res: desigRes, json: designations } = await api(
    'GET',
    '/admin/tenant/org/designations',
    adminTok,
  );
  assertOk('list designations', desigRes.status, JSON.stringify(designations));

  const designationIds = [];
  for (const code of DESIGNATION_CODES) {
    let row = designations.find((d) => d.code === code && d.is_active);
    if (!row && code === 'board_of_councillors') {
      const created = await api('POST', '/admin/tenant/org/designations', adminTok, {
        code: 'board_of_councillors',
        name: {
          en: 'Board of Councillors',
          bn: 'Board of Councillors',
          hi: 'Board of Councillors',
        },
        scope: 'municipality',
        is_active: true,
      });
      assertOk('create board_of_councillors', created.res.status, created.text);
      row = created.json;
      log('org', 'created board_of_councillors designation');
    }
    if (!row) {
      fail(`Missing designation ${code} — run apps/api prisma db seed`);
    }
    designationIds.push(row.id);
  }

  const { res: staffRes, json: staff } = await api('GET', '/admin/tenant/staff', adminTok);
  assertOk('list staff', staffRes.status, JSON.stringify(staff));
  const clerk = staff.find((row) => row.username === CLERK_USER);
  if (!clerk) {
    fail(`Staff user ${CLERK_USER} missing — run pnpm infra:seed-keycloak-users`);
  }

  const { res: assignRes, text: assignText } = await api(
    'PUT',
    `/admin/tenant/org/users/${clerk.id}/designations`,
    adminTok,
    { designation_ids: designationIds },
  );
  assertOk('assign designations', assignRes.status, assignText);
  log('staff', `${CLERK_USER} ← ${DESIGNATION_CODES.join(', ')}`);

  const citizenMobile = '9876500001';
  const citizenTok = await citizenToken(citizenMobile);
  log('auth', 'citizen dev OTP');

  const { res: regRes, text: regText } = await api(
    'POST',
    '/citizen/register',
    citizenTok,
    {
      name: 'BOC Smoke Citizen',
      mobile: citizenMobile,
    },
    { 'x-enagar-tenant-code': TENANT },
  );
  if (regRes.status !== 201 && regRes.status !== 200 && regRes.status !== 409) {
    assertOk('citizen register', regRes.status, regText);
  }

  const formData = {
    applicant_name: 'BOC Smoke Applicant',
    site_address: '12 Test Road, Ward 1, Kolkata',
    hoarding_dimensions: '10ft x 8ft',
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
  await uploadCleanDocument(citizenTok, draft.id, 'creative_mock');

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    citizenTok,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('submit', submitRes.status, JSON.stringify(submitted));
  log('application', `${submitted.docket_no} stage=${submitted.current_stage}`);

  const clerkTok = await kcToken(CLERK_USER);
  log('auth', CLERK_USER);

  const steps = [
    { verb: 'forward', note: 'submitted → clerk-verification' },
    { verb: 'forward', note: 'clerk → site-inspection' },
    { verb: 'forward', note: 'inspector → technical-scrutiny' },
    {
      verb: 'route-to-boc',
      require_boc: true,
      note: 'officer routes to BOC (require_boc flag)',
    },
    {
      verb: 'record-boc-resolution',
      boc_resolution: {
        resolution_number: `BOC/SMOKE/${Date.now()}`,
        resolution_date: '2026-05-30',
      },
      note: 'BOC resolution recorded',
    },
    { verb: 'forward', note: 'executive → certificate' },
  ];

  let detail = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(submitted.docket_no)}`,
    clerkTok,
  ).then(({ res, json, text }) => {
    assertOk('desk get', res.status, text);
    return json;
  });

  let applicationId = detail.application.id;

  for (const step of steps) {
    const stage = detail.application.current_stage ?? detail.application.status;
    const allowed = detail.allowed_transitions ?? [];
    const match = allowed.find((t) => t.verb === step.verb);
    if (!match && step.verb !== 'route-to-boc') {
      fail(
        `At stage "${stage}", verb "${step.verb}" not allowed. Have: ${allowed.map((t) => t.verb).join(', ') || 'none'}`,
      );
    }
    if (step.verb === 'route-to-boc' && !match) {
      log('note', 'route-to-boc hidden until require_boc is sent on transition (officer_may_require)');
    }
    log('transition', `${step.note} (${step.verb}) from ${stage}`);
    const payload = { require_boc: step.require_boc, boc_resolution: step.boc_resolution };
    detail = await deskTransition(clerkTok, applicationId, step.verb, payload);
    applicationId = detail.application.id;
  }

  const finalStage = detail.application.current_stage ?? detail.application.status;
  if (finalStage !== 'certificate-issued' && detail.application.status !== 'closed') {
    fail(`Expected terminal certificate, got stage=${finalStage} status=${detail.application.status}`);
  }

  const snapshot = detail.application;
  log('PASS', `${submitted.docket_no} reached ${finalStage} with BOC resolution path`);
  console.log(
    JSON.stringify(
      {
        docket_no: submitted.docket_no,
        application_id: applicationId,
        final_stage: finalStage,
        boc_policy: cfg.boc_policy,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
