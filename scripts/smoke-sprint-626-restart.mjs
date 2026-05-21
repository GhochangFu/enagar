/**
 * Second half of Sprint 6.26 smoke — verify persistence after API restart.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const statePath = resolve(__dirname, '.smoke-626-state.json');
const state = JSON.parse(readFileSync(statePath, 'utf8'));

const API = process.env.SMOKE_API_BASE ?? 'http://localhost:3001/api';
const MOBILE = '6260000001';
const OTP = process.env.DEV_OTP_CODE ?? '12345';

async function waitForApi() {
  for (let i = 0; i < 45; i++) {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error('[626-smoke-restart] API not healthy');
  process.exit(1);
}

async function main() {
  await waitForApi();
  const auth = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: MOBILE, otp: OTP }),
  });
  const { access_token: token } = await auth.json();
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Enagar-Tenant-Code': 'KMC',
  };
  const detail = await fetch(`${API}/applications/${encodeURIComponent(state.docket)}`, { headers });
  if (!detail.ok) {
    console.error('[626-smoke-restart] FAIL GET docket', detail.status, await detail.text());
    process.exit(1);
  }
  const body = await detail.json();
  const doc = (body.documents ?? []).find((d) => d.id === state.documentId);
  if (!doc || doc.scan_status !== 'clean') {
    console.error('[626-smoke-restart] FAIL documents after restart', body.documents);
    process.exit(1);
  }
  console.log('[626-smoke-restart] PASS — documents survived API restart:', state.docket);
}

main();
