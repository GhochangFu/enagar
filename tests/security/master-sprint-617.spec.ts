import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.17 — Tenant Admin shell, dashboard & Desk (Phase UX)', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-617-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-617-exit.md');
  const phasePlan = readRepo('docs/runbooks/phase-ux-revamp-plan.md');
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const deskClient = readRepo('apps/admin-tenant/app/dashboard/desk/desk-client.tsx');
  const dashboardClient = readRepo('apps/admin-tenant/app/dashboard/dashboard-client.tsx');
  const loginPage = readRepo('apps/admin-tenant/app/login/page.tsx');
  const globalsCss = readRepo('apps/admin-tenant/app/globals.css');
  const adminReadme = readRepo('apps/admin-tenant/README.md');

  it('documents sprint scope, deliverables, and exit criteria in runbooks', () => {
    expect(sprintPlan).toContain('Status: **closed**');
    expect(sprintExit).toContain('Status: **closed**');
    expect(sprintPlan).toContain('TenantAdminShell');
    expect(sprintPlan).toContain('No API route');
    expect(sprintPlan).toContain("cache: 'no-store'");
    expect(sprintExit).toContain('master-sprint-617-plan.md');
    expect(sprintExit).toContain('Exit criteria checklist');
    expect(phasePlan).toContain('Sprint 6.17 — Tenant Admin');
    expect(phasePlan).toContain('Option B+ Pro');
  });

  it('preserves Desk API surface from Sprint 6.13 (no API drift in this sprint)', () => {
    expect(tenantController).toContain("@Get('desk/me')");
    expect(tenantController).toContain("@Get('desk/inbox/applications')");
    expect(tenantController).toContain("@Post('desk/applications/:applicationId/transitions')");
    expect(tenantController).toContain("@Post('desk/grievances/staff/sweep-sla')");
  });

  it('preserves clerk dashboard 403 redirect and Desk data freshness', () => {
    expect(dashboardClient).toContain("router.replace('/dashboard/desk')");
    expect(deskClient).toContain("cache: 'no-store'");
  });

  it('wires Warm Coral platform tokens into admin-tenant globals', () => {
    expect(globalsCss).toContain('@enagar/config/styles/tricolor-calm.css');
    expect(globalsCss).toContain('--canvas-rgb');
  });

  it('documents 6.17 in admin-tenant README', () => {
    expect(adminReadme).toMatch(/6\.17|Sprint 6\.17/);
  });

  it('implements TenantAdminShell with role-aware navigation', () => {
    const shell = readRepo('apps/admin-tenant/components/tenant-admin-shell.tsx');
    const nav = readRepo('apps/admin-tenant/lib/tenant-admin-nav.ts');
    expect(shell).toContain('TenantAdminShell');
    expect(shell).toContain('Admin only');
    expect(nav).toContain('adminOnly');
    expect(readRepo('apps/admin-tenant/app/dashboard/layout.tsx')).toContain(
      'DashboardShellLayout',
    );
  });

  it('uses B+ Pro login chrome without gradients', () => {
    expect(loginPage).toContain('bg-canvas');
    expect(loginPage).not.toMatch(/linear-gradient|radial-gradient/i);
  });

  it('replaces ad-hoc btn-primary in desk and dashboard clients', () => {
    expect(deskClient).not.toContain('btn-primary');
    expect(dashboardClient).not.toContain('btn-primary');
    expect(deskClient).toContain('@enagar/ui');
    expect(dashboardClient).toContain('@enagar/ui');
  });
});
