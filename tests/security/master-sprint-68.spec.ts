import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.8 — Phase 6 P1 operator polish contract', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260516093000_tenant_banners/migration.sql',
  );
  const adminController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantController = readRepo('apps/api/src/modules/tenants/tenants.controller.ts');
  const adminContracts = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant-config.contracts.ts',
  );
  const operationsClient = readRepo(
    'apps/admin-tenant/app/dashboard/operations/operations-client.tsx',
  );
  const serviceDesigner = readRepo(
    'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
  );
  const serviceConfigPanel = readRepo(
    'apps/admin-tenant/app/dashboard/services/[serviceId]/service-config-panel.tsx',
  );
  const citizenPage = readRepo('apps/citizen-pwa/app/page.tsx');
  const citizenBanners = readRepo('apps/citizen-pwa/components/tenant-banners.tsx');

  it('adds tenant-scoped banner persistence with RLS and public/admin endpoints', () => {
    expect(schema).toContain('model TenantBanner');
    expect(schema).toContain('@@map("tenant_banners")');
    expect(migration).toContain('CREATE TABLE tenant_banners');
    expect(migration).toContain('tenant_id UUID NOT NULL REFERENCES tenants(id)');
    expect(migration).toContain('ALTER TABLE tenant_banners ENABLE ROW LEVEL SECURITY');
    expect(adminController).toContain("@Get('banners')");
    expect(adminController).toContain("@Patch('banners')");
    expect(tenantController).toContain("@Get(':id/banners')");
  });

  it('surfaces active tenant banners in the citizen PWA without expanding page logic heavily', () => {
    expect(citizenPage).toContain('fetchTenantBanners');
    expect(citizenPage).toContain('TenantBanners');
    expect(citizenBanners).toContain('severityClass');
    expect(citizenBanners).not.toContain('dangerouslySetInnerHTML');
  });

  it('moves service config into guided fee and document editors over existing contracts', () => {
    expect(serviceDesigner).toContain('ServiceConfigPanel');
    expect(serviceConfigPanel).toContain('Fee rule guided editor');
    expect(serviceConfigPanel).toContain('Document checklist');
    expect(serviceConfigPanel).toContain('JSON fallback');
    expect(serviceConfigPanel).toContain('value="slab"');
    expect(serviceConfigPanel).not.toContain('eval(');
    expect(serviceConfigPanel).not.toContain('new Function');
  });

  it('adds notification template channel matrix and placeholder preview without provider sends', () => {
    expect(operationsClient).toContain('TemplatePreviewEditor');
    expect(operationsClient).toContain('renderTemplatePreview');
    expect(operationsClient).toContain('extractTemplateVariables');
    expect(operationsClient).toContain('sms');
    expect(operationsClient).toContain('whatsapp');
    expect(operationsClient).not.toContain('sendSms');
    expect(operationsClient).not.toContain('sendWhatsApp');
    expect(adminContracts).toContain('assertValidNotificationVariables');
  });
});
