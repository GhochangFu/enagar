import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.22 — Tenant Admin grievance configuration', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-622-plan.md');
  const controller = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const configService = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant-grievance-config.service.ts',
  );
  const roles = readRepo('apps/api/src/modules/admin-tenant/tenant-admin-portal-roles.ts');
  const deskService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');

  it('documents sprint 6.22 tenant admin scope', () => {
    expect(sprintPlan).toContain('Tenant Admin Grievance Configuration');
    expect(sprintPlan).toContain('grievance-catalogue/categories');
    expect(sprintPlan).toContain('sla-policies');
  });

  it('exposes admin catalogue, SLA, and routing endpoints', () => {
    expect(controller).toContain("Get('grievance-catalogue/categories')");
    expect(controller).toContain("Post('grievance-catalogue/categories')");
    expect(controller).toContain("Patch('grievance-catalogue/categories/:code')");
    expect(controller).toContain('grievance-catalogue/categories/:code/subtypes');
    expect(controller).toContain("Get('sla-policies')");
    expect(controller).toContain("Put('sla-policies')");
    expect(controller).toContain("Get('grievance-routing-rules')");
    expect(controller).toContain("Put('grievance-routing-rules')");
  });

  it('guards writes with tenant portal admin RBAC', () => {
    expect(configService).toContain('assertTenantPortalAdminWrite');
    expect(configService).toContain('assertTenantPortalStaff');
    expect(roles).toContain('assertTenantPortalAdminWrite');
    expect(roles).not.toContain('tenant_clerk');
  });

  it('desk list items expose localized category labels', () => {
    expect(deskService).toContain('category_label: string');
    expect(deskService).toContain('subtype_label: string | null');
    expect(deskService).toContain('loadGrievanceLabelMaps');
  });

  it('wires Tenant Admin UI panels for masters and operations', () => {
    const cataloguePanel = readRepo('apps/admin-tenant/components/grievance-catalogue-panel.tsx');
    expect(cataloguePanel).toContain('grievance-catalogue/categories');
    expect(cataloguePanel).toContain("method: 'PATCH'");
    expect(cataloguePanel).toContain('subtypesLoadedForCode');
    expect(readRepo('apps/admin-tenant/lib/grievance-catalogue-helpers.ts')).toContain(
      'subtypesVisibleForCategory',
    );
    expect(readRepo('apps/admin-tenant/components/grievance-operations-panel.tsx')).toContain(
      'sla-policies',
    );
    expect(readRepo('apps/admin-tenant/app/dashboard/masters/masters-client.tsx')).toContain(
      'GrievanceCataloguePanel',
    );
    expect(readRepo('apps/admin-tenant/app/dashboard/operations/operations-client.tsx')).toContain(
      'GrievanceOperationsPanel',
    );
    expect(readRepo('apps/admin-tenant/app/dashboard/desk/desk-client.tsx')).toContain(
      'category_label',
    );
  });
});
