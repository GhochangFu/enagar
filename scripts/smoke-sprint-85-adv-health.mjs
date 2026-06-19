/**
 * Sprint 8.5G — combined advertising + health booking smoke orchestrator.
 * Prereq: API :3001, migrate + seed (KMC hoarding matrix, LED boards, health fleet).
 *
 * Usage:
 *   node scripts/smoke-sprint-85-adv-health.mjs
 *   SKIP_REGRESSION=1 node scripts/smoke-sprint-85-adv-health.mjs   # skip 8.2 smart-city leg
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const LEGS = [
  {
    name: 'hoarding quote',
    script: 'scripts/smoke/smoke-hoarding-calculator.mjs',
  },
  {
    name: 'hoarding BOC apply',
    script: 'scripts/smoke/hoarding-boc-e2e-smoke.mjs',
  },
  {
    name: 'LED deferred booking',
    script: 'scripts/smoke/smoke-ad-led-booking.mjs',
  },
  {
    name: 'health fleet booking',
    script: 'scripts/smoke/smoke-health-fleet-booking.mjs',
  },
  {
    name: 'citizen My Bookings',
    script: 'scripts/smoke/smoke-citizen-my-bookings.mjs',
  },
];

function runLeg(leg) {
  const scriptPath = join(repoRoot, leg.script);
  console.log(`\n== 8.5 smoke leg: ${leg.name} ==`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`[smoke-sprint-85] FAILED on leg: ${leg.name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[smoke-sprint-85] OK — ${leg.name}`);
}

function main() {
  console.log('[smoke-sprint-85] Sprint 8.5 advertising + health combined smoke');
  for (const leg of LEGS) {
    runLeg(leg);
  }

  if (!process.env.SKIP_REGRESSION) {
    runLeg({
      name: '8.2 smart-city regression',
      script: 'scripts/smoke-sprint-82-smart-city.mjs',
    });
  } else {
    console.log('\n[smoke-sprint-85] SKIP_REGRESSION=1 — smart-city leg skipped');
  }

  console.log('\n[smoke-sprint-85] ALL LEGS PASS');
}

main();
