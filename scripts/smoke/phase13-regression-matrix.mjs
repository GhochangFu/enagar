/**
 * Phase 13E — ADR-0013 regression matrix runner (upfront, dual, deferred, free).
 *
 * Usage: pnpm smoke:phase13-matrix
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const smokeDir = resolve(__dirname);

const CASES = [
  { name: 'birth-cert upfront_only', script: 'phase13-upfront-payment-smoke.mjs' },
  { name: 'trade-licence upfront_and_deferred', script: 'phase13-dual-payment-smoke.mjs' },
  { name: 'ad-hoarding deferred_only', script: 'phase13-deferred-payment-smoke.mjs' },
  { name: 'sanitation-grievance free', script: 'phase13-free-payment-smoke.mjs' },
];

function fail(message) {
  console.error(`[phase13-matrix] FAIL: ${message}`);
  process.exit(1);
}

console.log('[phase13-matrix] ADR-0013 regression matrix');

for (const testCase of CASES) {
  console.log(`[phase13-matrix] → ${testCase.name}`);
  const result = spawnSync(process.execPath, [resolve(smokeDir, testCase.script)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`${testCase.name} failed (exit ${result.status ?? 'unknown'})`);
  }
}

console.log('[phase13-matrix] PASS — all schedule patterns verified');
