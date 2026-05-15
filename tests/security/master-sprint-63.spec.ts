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
  '20260515143000_admin_tenant_masters',
  'migration.sql',
);
const adminControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant.controller.ts',
);
const adminContractsPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant-config.contracts.ts',
);
const serviceDesignerPath = join(
  repoRoot,
  'apps',
  'admin-tenant',
  'app',
  'dashboard',
  'services',
  '[serviceId]',
  'service-designer-client.tsx',
);
const mastersClientPath = join(
  repoRoot,
  'apps',
  'admin-tenant',
  'app',
  'dashboard',
  'masters',
  'masters-client.tsx',
);

describe('Master Sprint 6.3 — tenant admin configuration contract', () => {
  it('adds tenant-scoped tariff persistence and locality mouza support', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const migration = readFileSync(migrationPath, 'utf8');

    expect(schema).toContain('model TenantTariff');
    expect(schema).toContain('mouza');
    expect(migration).toContain('CREATE TABLE tenant_tariffs');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('exposes authenticated admin endpoints for 6.3 masters', () => {
    const src = readFileSync(adminControllerPath, 'utf8');
    for (const marker of [
      `@Get('services/:serviceId/config')`,
      `@Patch('services/:serviceId/config')`,
      `@Get('revenue-heads')`,
      `@Patch('address-master')`,
      `@Patch('tariffs')`,
    ]) {
      expect(src).toContain(marker);
    }
  });

  it('uses safe fee-rule validation instead of executable expressions', () => {
    const src = readFileSync(adminContractsPath, 'utf8');
    expect(src).toContain('assertValidFeeRule');
    expect(src).toContain('calculateFeePreview');
    expect(src).not.toContain('eval(');
    expect(src).not.toContain('new Function');
  });

  it('adds tenant admin UI for service config and master data', () => {
    const serviceDesigner = readFileSync(serviceDesignerPath, 'utf8');
    const mastersClient = readFileSync(mastersClientPath, 'utf8');

    expect(serviceDesigner).toContain('Fee, documents, and revenue mapping');
    expect(serviceDesigner).toContain('/config');
    expect(mastersClient).toContain('Revenue, address, and tariff masters');
    expect(mastersClient).toContain('address-master');
    expect(mastersClient).toContain('tariffs');
  });
});
