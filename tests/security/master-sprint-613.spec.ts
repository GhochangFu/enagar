import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.13 — Operator Desk in Tenant Admin', () => {
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const tenantRoles = readRepo('apps/api/src/modules/admin-tenant/tenant-admin-portal-roles.ts');
  const applicationsService = readRepo('apps/api/src/modules/applications/applications.service.ts');
  const servicesService = readRepo('apps/api/src/modules/services/services.service.ts');
  const dashboardClient = readRepo('apps/admin-tenant/app/dashboard/dashboard-client.tsx');
  const deskClient = readRepo('apps/admin-tenant/app/dashboard/desk/desk-client.tsx');
  const deskPage = readRepo('apps/admin-tenant/app/dashboard/desk/page.tsx');
  const sprintPlan = readRepo('docs/runbooks/master-sprint-613-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-613-exit.md');

  it('adds a clerk/admin Desk API surface without weakening existing config guards', () => {
    expect(tenantController).toContain("@Get('desk/me')");
    expect(tenantController).toContain("@Get('desk/inbox/applications')");
    expect(tenantController).toContain("@Get('desk/inbox/grievances')");
    expect(tenantService).toContain('function assertDeskAccess');
    expect(tenantService).toContain("'tenant_clerk'");
    expect(tenantService).toContain("'municipality_clerk'");
    expect(tenantRoles).toContain('TENANT_ADMIN_PORTAL_ROLES');
    expect(tenantRoles).not.toContain("'tenant_clerk'");
  });

  it('executes application workflow transitions through the shared workflow evaluator', () => {
    expect(tenantController).toContain("@Post('desk/applications/:applicationId/transitions')");
    expect(tenantService).toContain('evaluateTransition');
    expect(tenantService).toContain('loadWorkflowForDesk');
    expect(tenantService).toContain("status: 'published'");
    expect(tenantService).toContain('workflowForPattern');
    expect(tenantService).toContain('desk.application.transition');
    expect(tenantService).toContain('roleStageMap.findMany');
    expect(applicationsService).toContain('getPublishedWorkflowDefinition');
    expect(servicesService).toContain('getPublishedWorkflowDefinition');
  });

  it('adds grievance handling actions with admin-only assignment and SLA sweep', () => {
    expect(tenantController).toContain("@Patch('desk/grievances/:grievanceId/status')");
    expect(tenantController).toContain("@Post('desk/grievances/:grievanceId/assign')");
    expect(tenantController).toContain("@Post('desk/grievances/staff/sweep-sla')");
    expect(tenantService).toContain('assertDeskAdmin(principal)');
    expect(tenantService).toContain('desk.grievance.status');
    expect(tenantService).toContain('desk.grievance.assign');
    expect(tenantService).toContain('desk.grievance.sweep_sla');
  });

  it('adds the Tenant Admin Desk UI and clerk redirect from the dashboard', () => {
    expect(deskPage).toContain('DeskClient');
    expect(deskClient).toContain('eyebrow="Operator Desk"');
    expect(deskClient).toContain('/admin/tenant/desk/inbox/applications');
    expect(deskClient).toContain('/admin/tenant/desk/inbox/grievances');
    expect(deskClient).toContain('transitionApplication');
    expect(deskClient).toContain('updateGrievanceStatus');
    expect(dashboardClient).toContain("router.replace('/dashboard/desk')");
  });

  it('documents Phase 7 gate and 6.13 exit closure in runbooks', () => {
    expect(sprintPlan).toContain('Phase 7');
    expect(sprintPlan).toContain('does not start until **Phase UX (6.14–6.19)** closes');
    expect(sprintPlan).toContain('No separate clerk PWA');
    expect(sprintExit).toContain('manual smoke 2026-05-18');
    expect(sprintExit).toContain('Phase UX (**6.14–6.19**) gates Phase 7');
  });
});
