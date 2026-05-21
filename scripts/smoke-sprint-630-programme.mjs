/**
 * Object storage programme exit smoke (Sprint 6.30).
 * Replays API checks for 6.26 application docs + 6.29 branding/desk; verifies storage enabled.
 * Prerequisite: API :3001, Keycloak :8080, MinIO, scripts/.smoke-626-state.json (run 626 smoke once).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const statePath = resolve(__dirname, '.smoke-626-state.json');

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

function log(step, detail) {
  console.log(`[630-programme] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[630-programme] FAIL: ${message}`);
  process.exit(1);
}

function runNodeScript(scriptName) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(__dirname, scriptName)], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${scriptName} exited ${code}`));
    });
  });
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
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    fail(`Keycloak token for ${username}: ${res.status}`);
  }
  return json.access_token;
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
  fail('API not healthy');
}

async function verifyGrievanceEvidenceBlob() {
  const deskToken = await kcToken('kmc-municipality-admin-dummy');
  const listRes = await fetch(`${API}/admin/tenant/desk/inbox/grievances?queue=all`, {
    headers: { Authorization: `Bearer ${deskToken}` },
  });
  if (!listRes.ok) {
    fail(`desk grievance list ${listRes.status}`);
  }
  const rows = await listRes.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    log('grievance-evidence', 'skip — no grievances in desk inbox (6.28 UI smoke may still be manual)');
    return;
  }
  const grievanceId = rows[0].id;
  const detailRes = await fetch(
    `${API}/admin/tenant/desk/grievances/${encodeURIComponent(grievanceId)}`,
    { headers: { Authorization: `Bearer ${deskToken}` } },
  );
  if (!detailRes.ok) {
    fail(`desk grievance detail ${detailRes.status}`);
  }
  const detail = await detailRes.json();
  const attachments = detail?.grievance?.attachments ?? [];
  if (!attachments.length) {
    log('grievance-evidence', 'skip — no attachments on first grievance');
    return;
  }
  const attachment = attachments[0];
  const blobRes = await fetch(
    `${API}/admin/tenant/desk/grievances/${encodeURIComponent(grievanceId)}/attachments/${encodeURIComponent(attachment.id)}/blob`,
    { headers: { Authorization: `Bearer ${deskToken}` } },
  );
  if (!blobRes.ok) {
    fail(`grievance blob ${blobRes.status}`);
  }
  const contentType = blobRes.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await blobRes.arrayBuffer());
  if (contentType.includes('svg+xml') && bytes.toString('utf8').includes('Local dev: object bytes not served')) {
    fail('Grievance desk blob is SVG dev placeholder — expected real bytes with OBJECT_STORAGE_DISABLED=false');
  }
  log('grievance-evidence', `blob OK (${contentType}, ${bytes.length} bytes)`);
}

async function verifyCitizenDocumentDownload() {
  if (!existsSync(statePath)) {
    fail(`Missing ${statePath} — run node scripts/smoke-sprint-626.mjs`);
  }
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const OTP = process.env.DEV_OTP_CODE ?? '12345';
  const auth = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '6260000001', otp: OTP, tenant_code: 'WBPORTAL' }),
  });
  const { access_token: token } = await auth.json();
  if (!token) fail('citizen token missing');
  const dl = await fetch(`${API}/documents/${encodeURIComponent(state.documentId)}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Enagar-Tenant-Code': 'KMC',
    },
  });
  if (!dl.ok) {
    fail(`citizen download ${dl.status}: ${await dl.text()}`);
  }
  const body = await dl.json();
  if (!body.download_url || body.download_url.startsWith('minio://')) {
    fail('citizen download_url not presigned');
  }
  log('citizen-download', 'presigned URL issued for clean document');
}

async function main() {
  if (process.env.OBJECT_STORAGE_DISABLED === 'true') {
    fail('OBJECT_STORAGE_DISABLED=true — programme exit requires real MinIO');
  }

  await waitForApi();
  log('health', 'ok');

  if (!existsSync(statePath)) {
    log('626', 'running smoke-sprint-626.mjs (creates application + document state)');
    await runNodeScript('smoke-sprint-626.mjs');
  } else {
    log('626', `state present — ${statePath}`);
  }

  await runNodeScript('smoke-sprint-629.mjs');
  await verifyCitizenDocumentDownload();
  await verifyGrievanceEvidenceBlob();

  log('PASS', 'Upload programme 6.25–6.30 API smoke complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
