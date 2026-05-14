import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal `.env` line parser (same semantics as dotenv): no dependency required.
 */
function mergeEnvFile(path: string): void {
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

/**
 * When `pnpm --filter @enagar/api dev` runs from the monorepo, `cwd` is `apps/api`.
 * Merge `infrastructure/.env` into `process.env` for keys **not already set** (shell /
 * IDE launch config wins).
 */
function loadInfrastructureEnvOptional(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const infraPath = resolve(process.cwd(), '..', '..', 'infrastructure', '.env');
  if (!existsSync(infraPath)) {
    return;
  }
  mergeEnvFile(infraPath);
}

/** Logs DB host + database name in non-production (password never printed). */
function logEffectiveDatabaseUrl(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const raw =
    process.env.DATABASE_URL ??
    'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';
  try {
    const u = new URL(raw);
    const db = u.pathname?.replace(/^\//, '').split('?')[0] ?? '(unknown)';
    // eslint-disable-next-line no-console -- bootstrap visibility for local dev
    console.info(`[api] Postgres target: host=${u.hostname} port=${u.port || '5432'} db=${db}`);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[api] DATABASE_URL is not a valid URL; fix infrastructure/.env or process env.');
  }
}

loadInfrastructureEnvOptional();
logEffectiveDatabaseUrl();
