#!/usr/bin/env node
/**
 * Build Citizen + Tenant + State apps with demo/staging NEXT_PUBLIC_* URLs.
 * Used locally and in CI (Unified Portal Option A — Phase 3).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hosts = JSON.parse(
  readFileSync(join(repoRoot, 'infrastructure/unified-portal/demo-hosts.json'), 'utf8'),
);

/** @param {string} cmd */
function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit', env: process.env });
}

const shared = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_PUBLIC_API_BASE_URL: hosts.apiBaseUrl,
};

console.log('Unified Portal demo build — embedding demo hostnames in Next.js bundles');

process.env = {
  ...shared,
  NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION: 'true',
};
run('pnpm --filter @enagar/citizen-pwa build');

process.env = {
  ...shared,
  NEXT_PUBLIC_KEYCLOAK_ISSUER_URL: hosts.keycloakIssuerUrl,
  NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'admin-tenant',
  NEXT_PUBLIC_ADMIN_APP_ORIGIN: hosts.tenantOrigin,
};
run('pnpm --filter @enagar/admin-tenant build');

process.env = {
  ...shared,
  NEXT_PUBLIC_KEYCLOAK_ISSUER_URL: hosts.keycloakIssuerUrl,
  NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: 'admin-state',
  NEXT_PUBLIC_STATE_APP_ORIGIN: hosts.stateOrigin,
};
run('pnpm --filter @enagar/admin-state build');

console.log('\nDemo portal builds finished.');
