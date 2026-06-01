/**
 * Shared helpers for Phase 13 payment-schedule smokes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '../../..');

export const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
export const OTP = process.env.DEV_OTP_CODE ?? '12345';
export const TENANT = 'KMC';

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

export function makeLogger(prefix) {
  return {
    log(step, detail) {
      console.log(`[${prefix}] ${step}${detail ? `: ${detail}` : ''}`);
    },
    fail(message) {
      console.error(`[${prefix}] FAIL: ${message}`);
      process.exit(1);
    },
  };
}

export async function api(method, path, token, body, headers = {}) {
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

export function assertOk(fail, label, status, text) {
  if (status < 200 || status >= 300) {
    fail(`${label} (${status}): ${String(text).slice(0, 500)}`);
  }
}

export async function citizenToken(fail, mobile) {
  const { res, json, text } = await api('POST', '/auth/verify-otp', null, {
    mobile,
    otp: OTP,
  });
  assertOk(fail, 'citizen otp', res.status, text);
  if (!json?.access_token) {
    fail('Citizen token missing');
  }
  return json.access_token;
}

export async function registerCitizen(fail, token, mobile, name) {
  const { res } = await api(
    'POST',
    '/citizen/register',
    token,
    { name, mobile },
    { 'x-enagar-tenant-code': TENANT },
  );
  if (![200, 201, 409].includes(res.status)) {
    fail(`register ${res.status}`);
  }
}

export function expectSchedule(fail, draft, schedule) {
  if (draft.payment_schedule && draft.payment_schedule !== schedule) {
    fail(`draft payment_schedule ${draft.payment_schedule} !== ${schedule}`);
  }
}

export async function assertApiHealthy(fail) {
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) {
    fail('API not healthy on :3001');
  }
}
