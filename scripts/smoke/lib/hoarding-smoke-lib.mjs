/**
 * Shared helpers for Pattern C (hoarding) API/UI smokes.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '../../..');

export const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
export const ADMIN = process.env.SMOKE_ADMIN_URL ?? 'http://localhost:3002';
export const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
export const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
export const OTP = process.env.DEV_OTP_CODE ?? '12345';
export const TENANT = 'KMC';
export const SERVICE_CODE = process.env.HOARDING_SERVICE_CODE ?? 'ad-hoarding';
export const CLERK_USER = 'kmc-tenant-clerk-dummy';
export const ADMIN_USER = 'kmc-municipality-admin-dummy';

export const HOARDING_DESIGNATION_CODES = [
  'hoarding_clerk',
  'hoarding_inspector',
  'hoarding_officer',
  'board_of_councillors',
  'executive_officer',
];

export function loadInfraEnv() {
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

export function log(prefix, step, detail) {
  console.log(`[${prefix}] ${step}${detail ? `: ${detail}` : ''}`);
}

export function fail(prefix, message) {
  console.error(`[${prefix}] FAIL: ${message}`);
  process.exit(1);
}

export async function kcToken(username) {
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
    fail('hoarding', `Keycloak token ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    fail('hoarding', `Keycloak token for ${username}: ${res.status} ${text.slice(0, 300)}`);
  }
  return json.access_token;
}

export async function citizenToken(mobile) {
  const res = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile, otp: OTP }),
  });
  const text = await res.text();
  if (!res.ok) fail('hoarding', `Citizen OTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (!json.access_token) fail('hoarding', 'Citizen token missing');
  return json.access_token;
}

export async function api(method, path, token, body, extraHeaders = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          authorization: token ? `Bearer ${token}` : undefined,
          'content-type': 'application/json',
          ...extraHeaders,
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

export function assertOk(prefix, label, status, text) {
  if (status < 200 || status >= 300) {
    fail(prefix, `${label} (${status}): ${String(text).slice(0, 400)}`);
  }
}

/** Pattern C workflow from designer template (tsx generator). */
export function hoardingWorkflowDefinition(serviceCode = SERVICE_CODE) {
  const out = execSync(
    `pnpm exec tsx scripts/smoke/lib/generate-hoarding-workflow.ts ${serviceCode}`,
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const workflow = JSON.parse(out.trim());
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

export function hoardingFormData() {
  return {
    applicant_name: 'Phase10 Hoarding Applicant',
    site_address: '42 Pilot Road, Kolkata',
    hoarding_dimensions: '8ft x 6ft',
    site_photo: { name: 'site.jpg', mime_type: 'image/jpeg', size_mb: 0.01 },
    creative_mock: { name: 'creative.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
  };
}

export async function uploadCleanDocument(
  prefix,
  citizenTok,
  applicationId,
  documentCode,
  mimeType,
  originalName,
) {
  const { res: intentRes, json: intent } = await api('POST', '/documents/upload-intent', citizenTok, {
    application_id: applicationId,
    document_code: documentCode,
    original_name: originalName,
    mime_type: mimeType,
    size_mb: 0.01,
  });
  assertOk(prefix, 'upload-intent', intentRes.status, JSON.stringify(intent));

  if (process.env.ALLOW_CLIENT_SCAN_SIMULATION !== 'true') {
    const { res: confirmRes, text: confirmText } = await api(
      'POST',
      `/documents/${intent.id}/confirm-upload`,
      citizenTok,
    );
    assertOk(prefix, 'confirm-upload', confirmRes.status, confirmText);
  }

  const { res: scanRes, text: scanText } = await api(
    'POST',
    `/documents/${intent.id}/scan-result`,
    citizenTok,
    { scan_status: 'clean', scan_provider: 'phase10-hoarding-smoke' },
  );
  assertOk(prefix, 'scan-result', scanRes.status, scanText);
}

export async function deskTransition(prefix, clerkTok, applicationId, verb, extra = {}) {
  const { res, text } = await api(
    'POST',
    `/admin/tenant/desk/applications/${applicationId}/transitions`,
    clerkTok,
    { verb, comment: `phase10-hoarding ${verb}`, ...extra },
  );
  if (res.status < 200 || res.status >= 300) {
    fail(prefix, `desk transition ${verb} (${res.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

export async function fetchDeskDetail(prefix, clerkTok, docketNo) {
  const { res, json, text } = await api(
    'GET',
    `/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
    clerkTok,
  );
  assertOk(prefix, 'desk get', res.status, text);
  return json;
}

export function currentStage(detail) {
  return detail.application.current_stage ?? detail.application.status;
}

export function assertStage(prefix, detail, expected) {
  const stage = currentStage(detail);
  if (stage !== expected) {
    fail(prefix, `Expected stage ${expected}, got ${stage}`);
  }
}

export function assertCertificateTerminal(prefix, detail) {
  const stage = currentStage(detail);
  if (stage !== 'certificate-issued' && detail.application.status !== 'closed') {
    fail(
      prefix,
      `Expected certificate-issued, got stage=${stage} status=${detail.application.status}`,
    );
  }
}

export async function assignHoardingDesignations(prefix, adminTok, username) {
  const { res: desigRes, json: designations } = await api(
    'GET',
    '/admin/tenant/org/designations',
    adminTok,
  );
  assertOk(prefix, 'list designations', desigRes.status, JSON.stringify(designations));

  const designationIds = [];
  for (const code of HOARDING_DESIGNATION_CODES) {
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
      assertOk(prefix, 'create board_of_councillors', created.res.status, created.text);
      row = created.json;
    }
    if (!row) fail(prefix, `Missing designation ${code}`);
    designationIds.push(row.id);
  }

  const { res: staffRes, json: staff } = await api('GET', '/admin/tenant/staff', adminTok);
  assertOk(prefix, 'list staff', staffRes.status, JSON.stringify(staff));
  const user = staff.find((row) => row.username === username);
  if (!user) fail(prefix, `Staff ${username} missing`);

  const { res: assignRes, text: assignText } = await api(
    'PUT',
    `/admin/tenant/org/users/${user.id}/designations`,
    adminTok,
    { designation_ids: designationIds },
  );
  assertOk(prefix, `assign ${username}`, assignRes.status, assignText);
}

export async function publishHoardingPilot(prefix, adminTok, service) {
  const { res: designerRes, json: designer } = await api(
    'GET',
    `/admin/tenant/services/${service.id}/designer`,
    adminTok,
  );
  assertOk(prefix, 'designer', designerRes.status, JSON.stringify(designer));

  const workflow = hoardingWorkflowDefinition(service.code ?? SERVICE_CODE);
  workflow.code = `${service.code}-workflow-v1`;
  workflow.version = Math.max(
    designer.workflow_draft?.definition?.version ?? 0,
    designer.workflow_published?.definition?.version ?? 0,
    designer.starter_workflow?.version ?? 1,
    1,
  );

  const { res: wfRes, text: wfText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft`,
    adminTok,
    { workflow },
  );
  assertOk(prefix, 'save workflow', wfRes.status, wfText);

  const { res: pubRes, text: pubText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/workflow-draft/publish`,
    adminTok,
  );
  assertOk(prefix, 'publish workflow', pubRes.status, pubText);

  const { res: cfgRes, text: cfgText } = await api(
    'PATCH',
    `/admin/tenant/services/${service.id}/config`,
    adminTok,
    { boc_policy: 'officer_may_require', municipal_signoff_policy: 'never' },
  );
  assertOk(prefix, 'patch boc_policy', cfgRes.status, cfgText);
}

export async function createSubmittedApplication(prefix, citizenMobile) {
  const citizenTok = await citizenToken(citizenMobile);
  await api(
    'POST',
    '/citizen/register',
    citizenTok,
    { name: 'Phase10 Citizen', mobile: citizenMobile },
    { 'x-enagar-tenant-code': TENANT },
  ).then(({ res }) => {
    if (![200, 201, 409].includes(res.status)) {
      fail(prefix, `citizen register ${res.status}`);
    }
  });

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    citizenTok,
    { service_code: SERVICE_CODE, form_data: hoardingFormData() },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(prefix, 'create draft', draftRes.status, JSON.stringify(draft));

  await uploadCleanDocument(prefix, citizenTok, draft.id, 'site_photo', 'image/jpeg', 'site.jpg');
  await uploadCleanDocument(
    prefix,
    citizenTok,
    draft.id,
    'creative_mock',
    'application/pdf',
    'creative.pdf',
  );

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    citizenTok,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(prefix, 'submit', submitRes.status, JSON.stringify(submitted));
  return submitted;
}

export async function advanceToTechnicalScrutiny(prefix, clerkTok, applicationId) {
  let detail = await deskTransition(prefix, clerkTok, applicationId, 'forward');
  detail = await deskTransition(prefix, clerkTok, applicationId, 'forward');
  detail = await deskTransition(prefix, clerkTok, applicationId, 'forward');
  assertStage(prefix, detail, 'technical-scrutiny');
  return detail;
}
