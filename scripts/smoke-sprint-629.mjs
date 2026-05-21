/**
 * Master Sprint 6.29 manual smoke — branding upload + Desk application document blob.
 * Prerequisite: API :3001, Keycloak :8080, MinIO, smoke-626 state (or existing clean doc docket).
 * Usage: node scripts/smoke-sprint-629.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadInfraEnv() {
  const path = resolve(repoRoot, 'infrastructure/.env');
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
const ULB = 'KMC';
const BRANDING_CODE = `smoke-logo-${Date.now()}`;

/** 1×1 PNG */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const statePath = resolve(__dirname, '.smoke-626-state.json');

function log(step, detail) {
  console.log(`[629-smoke] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[629-smoke] FAIL: ${message}`);
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

async function api(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers, raw: text };
}

async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fail('API not healthy on :3001/health');
}

async function smokeBranding(adminToken) {
  log('branding', 'upload-intent');
  const intentRes = await api('/admin/tenant/branding-assets/upload-intent', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      code: BRANDING_CODE,
      kind: 'logo',
      mime_type: 'image/png',
      size_bytes: String(PNG_BYTES.length),
      original_name: 'smoke-logo.png',
    }),
  });
  if (intentRes.status !== 201) {
    fail(`upload-intent ${intentRes.status}: ${JSON.stringify(intentRes.body)}`);
  }
  const intent = intentRes.body;
  if (!intent.upload_url || intent.upload_url.startsWith('minio://')) {
    fail(`Expected real presigned upload_url, got ${intent.upload_url}`);
  }
  if (!intent.public_url?.startsWith('http')) {
    fail(`Expected http(s) public_url, got ${intent.public_url}`);
  }
  if (!intent.storage_key?.startsWith(`${ULB}/`)) {
    fail(`storage_key not tenant-prefixed: ${intent.storage_key}`);
  }

  const putRes = await fetch(intent.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: PNG_BYTES,
  });
  if (!putRes.ok) {
    fail(`PUT branding ${putRes.status}: ${await putRes.text()}`);
  }
  log('branding', `PUT ${PNG_BYTES.length} bytes to MinIO`);

  const upsertRes = await api('/admin/tenant/branding-assets', adminToken, {
    method: 'PATCH',
    body: JSON.stringify({
      code: BRANDING_CODE,
      kind: 'logo',
      storage_key: intent.storage_key,
      public_url: intent.public_url,
      mime_type: 'image/png',
      size_bytes: String(PNG_BYTES.length),
      width: '1',
      height: '1',
      metadata: { smoke: '629' },
    }),
  });
  if (upsertRes.status !== 200) {
    fail(`PATCH branding-assets ${upsertRes.status}: ${JSON.stringify(upsertRes.body)}`);
  }

  const settingsRes = await api('/admin/tenant/settings', adminToken, {
    method: 'PATCH',
    body: JSON.stringify({
      branding: {
        theme_color: '#0f766e',
        logo_url: intent.public_url,
        hero_image_url: '',
      },
    }),
  });
  if (settingsRes.status !== 200) {
    fail(`PATCH settings ${settingsRes.status}: ${JSON.stringify(settingsRes.body)}`);
  }

  const getSettings = await api('/admin/tenant/settings', adminToken);
  const logoUrl = getSettings.body?.branding?.logo_url;
  if (logoUrl !== intent.public_url) {
    fail(`settings.logo_url mismatch: ${logoUrl} vs ${intent.public_url}`);
  }
  log('branding', `settings.logo_url = ${logoUrl}`);

  try {
    const head = await fetch(intent.public_url, { method: 'HEAD' });
    if (head.ok) {
      log('branding', `public URL HEAD ${head.status}`);
    } else {
      log('branding', `public URL HEAD ${head.status} (MinIO may block anonymous read — OK if upsert passed headObject)`);
    }
  } catch {
    log('branding', 'public URL HEAD skipped (network)');
  }
}

async function smokeDeskDocuments(clerkToken, docket, documentId) {
  log('desk', `GET application ${docket}`);
  const detailRes = await api(
    `/admin/tenant/desk/applications/${encodeURIComponent(docket)}`,
    clerkToken,
  );
  if (detailRes.status !== 200) {
    fail(`desk application ${detailRes.status}: ${JSON.stringify(detailRes.body)}`);
  }
  const appId = detailRes.body?.application?.id;
  const docs = detailRes.body?.application?.documents ?? [];
  if (!appId) fail('desk detail missing application.id');
  const doc = docs.find((d) => d.id === documentId);
  if (!doc) {
    fail(`documents[] missing ${documentId}: ${JSON.stringify(docs)}`);
  }
  if (doc.scan_status !== 'clean') {
    fail(`document scan_status=${doc.scan_status}, expected clean`);
  }
  log('desk', `${docs.length} document(s); target clean`);

  const blobRes = await fetch(
    `${API}/admin/tenant/desk/applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(documentId)}/blob`,
    { headers: { Authorization: `Bearer ${clerkToken}` } },
  );
  if (!blobRes.ok) {
    fail(`document blob ${blobRes.status}: ${await blobRes.text()}`);
  }
  const contentType = blobRes.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await blobRes.arrayBuffer());
  if (contentType.includes('svg')) {
    fail('Desk document blob returned SVG placeholder');
  }
  if (!bytes.slice(0, 5).toString('utf8').startsWith('%PDF')) {
    fail(`Desk document blob is not PDF (content-type=${contentType}, len=${bytes.length})`);
  }
  log('desk', `blob OK — ${contentType}, ${bytes.length} bytes, PDF magic`);
}

async function main() {
  await waitForApi();
  log('health', 'ok');

  if (process.env.OBJECT_STORAGE_DISABLED === 'true') {
    fail('OBJECT_STORAGE_DISABLED=true — enable MinIO for this smoke');
  }

  const adminToken = await kcToken('kmc-municipality-admin-dummy');
  log('auth', 'kmc-municipality-admin-dummy');
  await smokeBranding(adminToken);

  let docket;
  let documentId;
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    docket = state.docket;
    documentId = state.documentId;
    log('state', `using ${statePath}`);
  } else {
    fail(`Missing ${statePath} — run node scripts/smoke-sprint-626.mjs first`);
  }

  const clerkToken = await kcToken('kmc-tenant-clerk-dummy');
  log('auth', 'kmc-tenant-clerk-dummy');
  await smokeDeskDocuments(clerkToken, docket, documentId);

  log('PASS', 'Sprint 6.29 manual smoke (API) — branding + Desk document preview bytes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
