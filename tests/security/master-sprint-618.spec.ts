import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.18 — Tenant Admin Masters, Operations & designer (Phase UX)', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-618-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-618-exit.md');
  const phasePlan = readRepo('docs/runbooks/phase-ux-revamp-plan.md');
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const mastersClient = readRepo('apps/admin-tenant/app/dashboard/masters/masters-client.tsx');
  const operationsClient = readRepo(
    'apps/admin-tenant/app/dashboard/operations/operations-client.tsx',
  );
  const designerClient = readRepo(
    'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
  );
  const adminReadme = readRepo('apps/admin-tenant/README.md');

  it('documents sprint scope, deliverables, and exit criteria in runbooks', () => {
    expect(sprintPlan).toContain('Status: **closed**');
    expect(sprintExit).toContain('Status: **closed**');
    expect(sprintPlan).toContain('Masters');
    expect(sprintPlan).toContain('Operations');
    expect(sprintPlan).toContain('No API route');
    expect(sprintExit).toContain('master-sprint-618-plan.md');
    expect(sprintExit).toContain('Exit criteria checklist');
    expect(phasePlan).toContain('Sprint 6.18');
    expect(phasePlan).toContain('master-sprint-618-exit.md');
  });

  it('preserves configure API surface (no API drift in this sprint)', () => {
    expect(tenantController).toContain("@Get('revenue-heads')");
    expect(tenantController).toContain("@Post('address-master/import-csv')");
    expect(tenantController).toContain("@Get('settings')");
    expect(tenantController).toContain("@Post('staff-invites')");
    expect(tenantController).toContain("@Get('services/:serviceId/designer')");
    expect(tenantController).toContain("@Patch('services/:serviceId/form-draft/publish')");
    expect(tenantController).toContain("@Patch('services/:serviceId/workflow-draft/publish')");
  });

  it('documents 6.18 in admin-tenant README', () => {
    expect(adminReadme).toMatch(/6\.18|Sprint 6\.18/);
  });

  it('masters and operations use shared session and drop duplicate auth headers', () => {
    expect(mastersClient).toContain('useTenantAdminSession');
    expect(operationsClient).toContain('useTenantAdminSession');
    expect(mastersClient).not.toContain('readStoredAuth');
    expect(operationsClient).not.toContain('readStoredAuth');
  });

  it('replaces btn-primary in masters, operations, and designer clients', () => {
    expect(mastersClient).not.toContain('btn-primary');
    expect(operationsClient).not.toContain('btn-primary');
    expect(designerClient).not.toContain('btn-primary');
    expect(mastersClient).toContain('@enagar/ui');
    expect(operationsClient).toContain('@enagar/ui');
  });

  it('implements clerk admin-only panel for configure routes', () => {
    expect(readRepo('apps/admin-tenant/components/admin-only-panel.tsx')).toContain(
      'AdminOnlyPanel',
    );
    expect(readRepo('apps/admin-tenant/components/configure-route-guard.tsx')).toMatch(
      /masters|operations|services/,
    );
    expect(readRepo('apps/admin-tenant/components/dashboard-shell-layout.tsx')).toContain(
      'ConfigureRouteGuard',
    );
  });

  it('designer chrome uses PageHeader without changing xyflow graph imports', () => {
    expect(designerClient).toContain('PageHeader');
    expect(designerClient).toContain('@xyflow/react');
    expect(designerClient).not.toMatch(/linear-gradient|radial-gradient/i);
  });
});
