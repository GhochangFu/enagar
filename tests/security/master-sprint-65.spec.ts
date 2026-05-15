import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const schemaPath = join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
const migrationPath = join(
  repoRoot,
  'apps',
  'api',
  'prisma',
  'migrations',
  '20260515172000_state_admin_portal',
  'migration.sql',
);
const controllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-state',
  'admin-state.controller.ts',
);
const contractsPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-state',
  'admin-state.contracts.ts',
);
const stateClientPath = join(
  repoRoot,
  'apps',
  'admin-state',
  'app',
  'dashboard',
  'state-dashboard-client.tsx',
);
const statePackagePath = join(repoRoot, 'apps', 'admin-state', 'package.json');
const statePostcssPath = join(repoRoot, 'apps', 'admin-state', 'postcss.config.mjs');
const apiMainPath = join(repoRoot, 'apps', 'api', 'src', 'main.ts');

describe('Master Sprint 6.5 — state super-admin contract', () => {
  it('adds persistence for state audit and impersonation records', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const migration = readFileSync(migrationPath, 'utf8');
    expect(schema).toContain('model StateAuditLog');
    expect(schema).toContain('model ImpersonationToken');
    expect(migration).toContain('CREATE TABLE state_audit_logs');
    expect(migration).toContain('CREATE TABLE impersonation_tokens');
    expect(migration).toContain('token_id UUID NOT NULL UNIQUE');
  });

  it('exposes state-admin APIs behind explicit state_admin authorization', () => {
    const controller = readFileSync(controllerPath, 'utf8');
    const contracts = readFileSync(contractsPath, 'utf8');
    for (const marker of [
      `@Get('analytics')`,
      `@Get('tenants')`,
      `@Patch('tenants')`,
      `@Post('impersonation')`,
      `@Get('audit-logs')`,
    ]) {
      expect(controller).toContain(marker);
    }
    expect(contracts).toContain("principal.roles.includes('state_admin')");
    expect(contracts).toContain('assertImpersonationReason');
  });

  it('turns admin-state into a Next.js portal on port 3003', () => {
    const pkg = JSON.parse(readFileSync(statePackagePath, 'utf8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const client = readFileSync(stateClientPath, 'utf8');
    const postcss = readFileSync(statePostcssPath, 'utf8');
    const apiMain = readFileSync(apiMainPath, 'utf8');
    expect(pkg.scripts?.dev).toContain('-p 3003');
    expect(pkg.dependencies?.next).toBeDefined();
    expect(postcss).toContain('tailwindcss');
    expect(client).toContain('Sprint 6.5 · State Super-Admin');
    expect(client).toContain('/admin/state/analytics');
    expect(client).toContain('/admin/state/impersonation');
    expect(apiMain).toContain('http://localhost:3003');
  });
});
