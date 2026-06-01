/**
 * Phase 14 smoke — net-new municipality via State onboarding loads full org pack.
 *
 * Prereq: API :3001, Keycloak :8080, Postgres, DEV MFA bypass or enrolled state_admin TOTP
 *
 * Usage: pnpm smoke:phase14-org
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const STATE_USER = process.env.PHASE14_STATE_USER ?? 'kmc-state-admin-dummy';
const TENANT_CODE = process.env.PHASE14_TENANT_CODE ?? `P14${Date.now().toString().slice(-6)}`;
const EXPECTED_DEPARTMENTS = Number(process.env.PHASE14_EXPECTED_DEPARTMENTS ?? '24');
const EXPECTED_DESIGNATIONS = Number(process.env.PHASE14_EXPECTED_DESIGNATIONS ?? '47');

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
  console.log(`[phase14-org] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase14-org] FAIL: ${message}`);
  process.exit(1);
}

async function kcToken(username, clientId) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password: KC_PASSWORD,
  });
  const res = await fetch(KC_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) fail(`Keycloak token for ${username} (${clientId}): ${res.status}`);
  return (await res.json()).access_token;
}

async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
      'content-type': 'application/json',
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

async function main() {
  log('start', `net-new org onboarding for ${TENANT_CODE}`);
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail('API not healthy on :3001');

  const stateTok = await kcToken(STATE_USER, 'admin-state');
  const slug = TENANT_CODE.toLowerCase();
  const tenantAdminUsername = `${slug}-tenant-admin`;
  const payload = {
    code: TENANT_CODE,
    name: `Phase 14 Pilot ${TENANT_CODE}`,
    district: 'Pilot District',
    ward_count: 12,
    theme_color: '#0E7490',
    logo_url: null,
    languages_enabled: ['en', 'bn'],
    status: 'active',
    inherit_default_services: false,
    service_category_codes: ['certificates'],
    grievance_category_codes: [],
    tenant_admin_username: tenantAdminUsername,
    tenant_admin_email: `${tenantAdminUsername}@tenant.enagar.local`,
    tenant_admin_password: KC_PASSWORD,
    tenant_admin_first_name: 'Pilot',
    tenant_admin_last_name: 'Administrator',
    config: {
      default_language: 'en',
      support_email: `support@${slug}.example.gov.in`,
      onboarding_source: 'state_wizard',
      wizard_completed: true,
    },
  };

  const { res: upsertRes, text: upsertText } = await api(
    'POST',
    '/admin/state/tenants',
    stateTok,
    payload,
  );
  assertOk('activate municipality', upsertRes.status, upsertText);

  const tenantAdminTok = await kcToken(tenantAdminUsername, 'admin-tenant');
  const { res: deptRes, json: departments, text: deptText } = await api(
    'GET',
    '/admin/tenant/org/departments',
    tenantAdminTok,
  );
  assertOk('departments', deptRes.status, deptText);
  if (!Array.isArray(departments) || departments.length < EXPECTED_DEPARTMENTS) {
    fail(`expected >= ${EXPECTED_DEPARTMENTS} departments, got ${departments?.length ?? 0}`);
  }

  const { res: desigRes, json: designations, text: desigText } = await api(
    'GET',
    '/admin/tenant/org/designations',
    tenantAdminTok,
  );
  assertOk('designations', desigRes.status, desigText);
  if (!Array.isArray(designations) || designations.length < EXPECTED_DESIGNATIONS) {
    fail(`expected >= ${EXPECTED_DESIGNATIONS} designations, got ${designations?.length ?? 0}`);
  }

  const pwdHead = designations.find((row) => row.code === 'pwd_executive_engineer');
  const hoardingHead = designations.find((row) => row.code === 'hoarding_officer');
  if (!pwdHead?.is_department_head) fail('pwd_executive_engineer missing or not department head');
  if (!hoardingHead?.is_department_head) fail('hoarding_officer missing or not department head');

  log('departments', String(departments.length));
  log('designations', String(designations.length));
  log('done', TENANT_CODE);
  console.log('[phase14-org] PASS');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
