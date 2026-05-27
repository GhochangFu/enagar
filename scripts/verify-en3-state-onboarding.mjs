/**
 * EN-3 State tenant onboarding — smoke checks (laptop or demo VM).
 *
 * Usage (repo root):
 *   node scripts/verify-en3-state-onboarding.mjs
 *   TENANT_CODE=BLYM TENANT_ADMIN_USER=blym-tenant-admin TENANT_ADMIN_PASSWORD='DummyDev_2026!ChangeMe' node scripts/verify-en3-state-onboarding.mjs
 *
 * Demo VM (HTTPS):
 *   $env:API_URL='https://enagarapi.demosites.co.in'
 *   $env:KEYCLOAK_TOKEN_URL='https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/token'
 *   $env:TENANT_CODE='BLYM'
 *   node scripts/verify-en3-state-onboarding.mjs
 */
const API = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const KEYCLOAK_TOKEN =
  process.env.KEYCLOAK_TOKEN_URL ??
  'http://127.0.0.1:8080/realms/enagar/protocol/openid-connect/token';
const TENANT_CODE = (process.env.TENANT_CODE ?? 'BLYM').trim().toUpperCase();
const TENANT_ADMIN_USER = (process.env.TENANT_ADMIN_USER ?? `${TENANT_CODE.toLowerCase()}-tenant-admin`).trim();
const TENANT_ADMIN_PASSWORD = process.env.TENANT_ADMIN_PASSWORD ?? 'DummyDev_2026!ChangeMe';

function fail(message) {
  console.error(`EN-3 verify FAIL: ${message}`);
  process.exit(1);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    const detail = typeof json === 'object' && json?.message ? JSON.stringify(json.message) : text;
    fail(`${url} → HTTP ${response.status}: ${detail}`);
  }
  return json;
}

async function keycloakPasswordToken(clientId, username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
  });
  const json = await fetchJson(KEYCLOAK_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!json?.access_token) {
    fail(`No access_token for ${username} (${clientId})`);
  }
  return json.access_token;
}

async function main() {
  console.log(`EN-3 verify → API ${API}, tenant ${TENANT_CODE}, admin ${TENANT_ADMIN_USER}`);

  const tenants = await fetchJson(`${API}/api/tenants`);
  if (!Array.isArray(tenants)) {
    fail('GET /api/tenants did not return an array');
  }
  const row = tenants.find((t) => String(t.code).toUpperCase() === TENANT_CODE);
  if (!row) {
    fail(`${TENANT_CODE} missing from GET /api/tenants (${tenants.length} rows)`);
  }
  console.log(`OK catalogue lists ${TENANT_CODE}`);

  const serviceList = await fetchJson(`${API}/api/services/tenants/${TENANT_CODE}`);
  if (!Array.isArray(serviceList)) {
    fail(`GET /api/services/tenants/${TENANT_CODE} did not return an array`);
  }
  if (serviceList.length < 1) {
    fail(`No published services for ${TENANT_CODE}`);
  }
  console.log(`OK ${serviceList.length} service(s) visible to citizens`);

  const token = await keycloakPasswordToken('admin-tenant', TENANT_ADMIN_USER, TENANT_ADMIN_PASSWORD);
  const me = await fetchJson(`${API}/api/admin/tenant/desk/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!me?.tenant_code || String(me.tenant_code).toUpperCase() !== TENANT_CODE) {
    fail(`desk/me tenant mismatch: ${JSON.stringify(me)}`);
  }
  console.log(`OK tenant admin ${TENANT_ADMIN_USER} → desk/me`);
  console.log('EN-3 verify PASS');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
