import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function mergeEnvFile(path) {
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) {
      continue;
    }
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

/** Merge `infrastructure/.env` when running `next dev` from `apps/citizen-pwa`. */
if (process.env.NODE_ENV !== 'production') {
  const infraPath = resolve(process.cwd(), '..', '..', 'infrastructure', '.env');
  if (existsSync(infraPath)) {
    mergeEnvFile(infraPath);
  }
}

if (
  !process.env.NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION &&
  process.env.ALLOW_CLIENT_SCAN_SIMULATION
) {
  process.env.NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION = process.env.ALLOW_CLIENT_SCAN_SIMULATION;
}
