/**
 * Phase 9 API smoke — municipal_signoff_policy branches at dept-head-review.
 *
 * Prereq: API :3001, Keycloak :8080, DB seeded, pnpm infra:seed-keycloak-users
 *
 * Usage: node scripts/smoke/phase9-municipal-signoff-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const KC_TOKEN = 'http://localhost:8080/realms/enagar/protocol/openid-connect/token';
const KC_PASSWORD = process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const TENANT = 'KMC';
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
  console.log(`[phase9-muni] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[phase9-muni] FAIL: ${message}`);
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
  const json = await res.json();
  return json.access_token;
}

async function api(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  return { res, text, json: text ? JSON.parse(text) : null };
}

function assertOk(label, status, text) {
  if (status < 200 || status >= 300) {
    fail(`${label} (${status}): ${text.slice(0, 400)}`);
  }
}

async function main() {
  log('start', 'municipal signoff policy smoke');
  const adminToken = await kcToken(ADMIN_USER);

  const catalogue = await api(`/admin/tenant/services?tenant_code=${TENANT}`, adminToken);
  assertOk('list services', catalogue.res.status, catalogue.text);
  const service =
    catalogue.json?.find?.((row) => row.code === 'pwd-test-muni') ??
    catalogue.json?.[0];
  if (!service?.id) fail('no tenant service found');

  log('configure', `municipal_signoff_policy on ${service.code} (${service.id})`);

  const cfgRes = await api(`/admin/tenant/services/${service.id}/config`, adminToken, {
    method: 'PATCH',
    body: JSON.stringify({
      municipal_signoff_policy: 'high_value_only',
      municipal_signoff_threshold_paise: 50_000_000,
      fee_rule: { type: 'fixed', amount_paise: 1_000, currency: 'INR' },
    }),
  });
  assertOk('patch municipal config', cfgRes.res.status, cfgRes.text);

  const cfgGet = await api(`/admin/tenant/services/${service.id}/config`, adminToken);
  assertOk('get config', cfgGet.res.status, cfgGet.text);
  if (cfgGet.json?.municipal_signoff_policy !== 'high_value_only') {
    fail(`expected high_value_only, got ${cfgGet.json?.municipal_signoff_policy}`);
  }

  log('ok', 'municipal_signoff_policy persisted on service config');
  console.log(
    '[phase9-muni] PASS. Publish PWD works template in designer and verify dept-head forward branches at desk.',
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
