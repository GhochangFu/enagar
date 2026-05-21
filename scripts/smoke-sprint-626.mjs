/**
 * Master Sprint 6.26 manual smoke — HTTP flow against local API + MinIO.
 * Usage: node scripts/smoke-sprint-626.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const require = createRequire(resolve(repoRoot, 'apps/api/package.json'));
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

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
const MOBILE = '6260000001';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const ULB = 'KMC';

const birthCertificateForm = {
  applicant_name: 'Sprint 626 Smoke',
  applicant_dob: '1990-05-15',
  mobile: MOBILE,
  child_name: 'Smoke Child',
  date_of_birth: '2026-01-15',
  relationship: 'parent',
  hospital_discharge: {
    name: 'birth-proof.pdf',
    mime_type: 'application/pdf',
    size_mb: 0.01,
  },
};

/** Minimal valid PDF bytes */
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
);

function log(step, detail) {
  console.log(`[626-smoke] ${step}${detail ? `: ${detail}` : ''}`);
}

function fail(message) {
  console.error(`[626-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function api(path, init = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

async function waitForApi(maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail('API did not become healthy on :3001/health');
}

async function getToken() {
  const { status, body } = await api('/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: MOBILE, otp: OTP, tenant_code: 'WBPORTAL' }),
  });
  if (status !== 200 && status !== 201) {
    fail(`verify-otp ${status}: ${JSON.stringify(body)}`);
  }
  const token = body?.access_token;
  if (!token) fail('No access_token from verify-otp');
  return token;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Enagar-Tenant-Code': ULB,
  };
}

async function minioHead(objectKey) {
  const client = new S3Client({
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY,
    },
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  });
  await client.send(
    new HeadObjectCommand({
      Bucket: process.env.OBJECT_STORAGE_BUCKET,
      Key: objectKey,
    }),
  );
  const list = await client.send(
    new ListObjectsV2Command({
      Bucket: process.env.OBJECT_STORAGE_BUCKET,
      Prefix: objectKey.split('/').slice(0, 3).join('/'),
      MaxKeys: 20,
    }),
  );
  return list.Contents?.some((o) => o.Key === objectKey) ?? false;
}

async function main() {
  log('waiting for API');
  await waitForApi();

  const token = await getToken();
  log('authenticated', `sub dev-citizen-${MOBILE}`);

  const registerRes = await api('/citizen/register', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ mobile: MOBILE, language_pref: 'en' }),
  });
  if (registerRes.status !== 201 && registerRes.status !== 200) {
    fail(`citizen/register ${registerRes.status}: ${JSON.stringify(registerRes.body)}`);
  }
  log('citizen registered', MOBILE);

  const draftRes = await api('/applications/drafts', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ service_code: 'birth-cert', form_data: birthCertificateForm }),
  });
  if (draftRes.status !== 201) {
    fail(`draft ${draftRes.status}: ${JSON.stringify(draftRes.body)}`);
  }
  const draft = draftRes.body;
  log('draft created', draft.id);

  const intentRes = await api('/documents/upload-intent', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      application_id: draft.id,
      document_code: 'hospital_discharge',
      original_name: 'birth-proof.pdf',
      mime_type: 'application/pdf',
      size_mb: 0.01,
    }),
  });
  if (intentRes.status !== 201) {
    fail(`upload-intent ${intentRes.status}: ${JSON.stringify(intentRes.body)}`);
  }
  const intent = intentRes.body;
  if (!intent.upload_url || intent.upload_url.startsWith('minio://')) {
    fail(`Expected real presigned upload_url, got ${intent.upload_url}`);
  }
  log('upload-intent', intent.id);

  const putRes = await fetch(intent.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: PDF_BYTES,
  });
  if (!putRes.ok) {
    fail(`PUT to presigned URL ${putRes.status}: ${await putRes.text()}`);
  }
  log('PUT bytes to MinIO', `${PDF_BYTES.length} bytes`);

  const confirmRes = await api(`/documents/${intent.id}/confirm-upload`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (confirmRes.status !== 201) {
    fail(`confirm-upload ${confirmRes.status}: ${JSON.stringify(confirmRes.body)}`);
  }
  if (confirmRes.body?.upload_status !== 'uploaded') {
    fail(`confirm-upload upload_status=${confirmRes.body?.upload_status}`);
  }
  log('confirm-upload', 'uploaded');

  const scanRes = await api(`/documents/${intent.id}/scan-result`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      scan_status: 'clean',
      scan_provider: 'pwa-simulated-clamav',
    }),
  });
  if (scanRes.status !== 201) {
    fail(`scan-result ${scanRes.status}: ${JSON.stringify(scanRes.body)}`);
  }
  log('scan-result', 'clean');

  const submitRes = await api(`/applications/${draft.id}/submit`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (submitRes.status !== 201) {
    fail(`submit ${submitRes.status}: ${JSON.stringify(submitRes.body)}`);
  }
  const submitted = submitRes.body;
  log('submitted', submitted.docket_no);

  const detailRes = await api(`/applications/${encodeURIComponent(submitted.docket_no)}`, {
    headers: authHeaders(token),
  });
  if (detailRes.status !== 200) {
    fail(`GET docket ${detailRes.status}`);
  }
  const docs = detailRes.body?.documents ?? [];
  if (!docs.some((d) => d.id === intent.id && d.scan_status === 'clean')) {
    fail(`documents[] missing clean row: ${JSON.stringify(docs)}`);
  }
  log('GET docket documents', `${docs.length} row(s), scan_status=clean`);

  const inMinio = await minioHead(intent.object_key);
  if (!inMinio) {
    fail(`Object not found in bucket ${process.env.OBJECT_STORAGE_BUCKET}: ${intent.object_key}`);
  }
  log('MinIO head', intent.object_key);

  writeFileSync(
    resolve(repoRoot, 'scripts/.smoke-626-state.json'),
    JSON.stringify({ docket: submitted.docket_no, documentId: intent.id, objectKey: intent.object_key }, null, 2),
  );
  log('PASS', 'pre-restart checks complete — run scripts/smoke-sprint-626-restart.mjs after API restart');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
