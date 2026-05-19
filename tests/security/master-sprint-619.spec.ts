import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.19 — State Admin & cross-portal finish (Phase UX)', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-619-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-619-exit.md');
  const phasePlan = readRepo('docs/runbooks/phase-ux-revamp-plan.md');
  const stateController = readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts');
  const stateDashboard = readRepo('apps/admin-state/app/dashboard/state-dashboard-client.tsx');
  const stateLogin = readRepo('apps/admin-state/app/login/page.tsx');
  const stateLoginTheme = readRepo('apps/admin-state/components/state-login-theme.tsx');
  const stateLoginActions = readRepo('apps/admin-state/components/state-login-actions.tsx');
  const tenantTheme = readRepo('packages/tenant-theme/src/index.ts');
  const stateReadme = readRepo('apps/admin-state/README.md');

  it('documents sprint scope and exit criteria in runbooks', () => {
    expect(sprintPlan).toMatch(/Status: \*\*closed\*\*/);
    expect(sprintPlan).toContain('State Admin');
    expect(sprintPlan).toContain('applyStateAdminTheme');
    expect(sprintExit).toContain('master-sprint-619-plan.md');
    expect(phasePlan).toContain('Sprint 6.19');
    expect(phasePlan).toContain('master-sprint-619-exit.md');
  });

  it('preserves state admin API surface (no API drift in this sprint)', () => {
    expect(stateController).toContain("@Get('analytics')");
    expect(stateController).toContain("@Get('tenants')");
    expect(stateController).toContain("@Post('impersonation')");
    expect(stateController).toContain("@Get('audit-logs')");
  });

  it('exposes state admin platform theme helper', () => {
    expect(tenantTheme).toContain('STATE_ADMIN_BRAND_HEX');
    expect(tenantTheme).toContain('applyStateAdminTheme');
  });

  it('documents 6.19 in admin-state README', () => {
    expect(stateReadme).toMatch(/6\.19|Sprint 6\.19/);
  });

  it('state dashboard uses shared UI primitives for chrome', () => {
    expect(stateDashboard).toContain('@enagar/ui');
    expect(stateDashboard).toContain('PageHeader');
    expect(stateDashboard).not.toContain('bg-indigo-950');
  });

  it('state login uses platform theme and UI button', () => {
    expect(stateLoginTheme).toContain('applyStateAdminTheme');
    expect(stateLoginActions).toContain('@enagar/ui');
    expect(stateLogin).not.toContain('bg-indigo-700');
    expect(stateLoginActions).not.toContain('bg-indigo-700');
  });
});
