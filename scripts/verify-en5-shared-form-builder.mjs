/**
 * EN-5 — shared form builder automated verify (no browser required).
 *
 * Runs @enagar/forms unit tests + EN-5 security contract tests.
 * Optionally checks a live API for trade-licence show_if when the stack is up.
 *
 * Usage (repo root):
 *   node scripts/verify-en5-shared-form-builder.mjs
 *   pnpm verify:en5
 *
 * Optional API smoke (skip with EN5_SKIP_API=1):
 *   TENANT_CODE=EN4T node scripts/verify-en5-shared-form-builder.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT_CODE = (process.env.TENANT_CODE ?? 'EN4T').trim().toUpperCase();
const SERVICE_CODE = (process.env.EN5_SERVICE_CODE ?? 'trade-licence').trim();

function fail(message) {
  console.error(`EN-5 verify FAIL: ${message}`);
  process.exit(1);
}

function runStep(label, command, args) {
  console.log(`\nEN-5 verify → ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail(`${label} exited with code ${result.status ?? 1}`);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    const detail = typeof json === 'object' && json?.message ? JSON.stringify(json.message) : text;
    throw new Error(`${url} → HTTP ${response.status}: ${detail}`);
  }
  return json;
}

async function optionalApiSmoke() {
  if (process.env.EN5_SKIP_API === '1') {
    console.log('\nEN-5 verify → API smoke skipped (EN5_SKIP_API=1)');
    return;
  }

  console.log(`\nEN-5 verify → optional API smoke (${API}, tenant ${TENANT_CODE})`);
  try {
    const detail = await fetchJson(
      `${API}/api/services/tenants/${TENANT_CODE}/${encodeURIComponent(SERVICE_CODE)}`,
    );
    const fields = detail?.form_schema?.fields;
    if (!Array.isArray(fields)) {
      fail(`${SERVICE_CODE} response missing form_schema.fields`);
    }
    const fssai = fields.find((field) => field?.id === 'fssai_certificate');
    if (!fssai?.show_if) {
      fail(`${SERVICE_CODE} fssai_certificate missing show_if (conditional apply smoke)`);
    }
    if (fssai.show_if.field !== 'trade_type') {
      fail(`${SERVICE_CODE} fssai_certificate show_if.field expected trade_type`);
    }
    const hasFoodEquals =
      fssai.show_if.equals === 'food' ||
      (Array.isArray(fssai.show_if.equals_any) && fssai.show_if.equals_any.includes('food'));
    if (!hasFoodEquals) {
      fail(`${SERVICE_CODE} fssai_certificate show_if must match food (equals or equals_any)`);
    }
    console.log(`OK ${SERVICE_CODE} published form has food-gated fssai_certificate`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message)) {
      console.log(`SKIP API smoke (API not reachable): ${message}`);
      console.log('Manual smokes: see docs/runbooks/en5-state-global-form-builder-plan.md § Manual smoke checklists');
      return;
    }
    fail(message);
  }
}

async function main() {
  console.log('EN-5 verify → shared @enagar/forms/builder contract');

  runStep('@enagar/forms unit tests', 'pnpm', ['--filter', '@enagar/forms', 'test']);
  runStep('EN-5 security contract', 'pnpm', ['test:security', '--', 'en5-shared-form-builder']);

  await optionalApiSmoke();

  console.log('\nEN-5 verify PASS');
  console.log('Manual smokes (State/Tenant/Citizen UI): docs/runbooks/en5-state-global-form-builder-plan.md');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
