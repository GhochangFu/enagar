import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.24 — State grievance library & programme exit', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-624-plan.md');
  const statePanel = readRepo('apps/admin-state/components/state-grievance-library-panel.tsx');
  const tenantPanel = readRepo('apps/admin-tenant/components/grievance-catalogue-panel.tsx');
  const stateService = readRepo(
    'apps/api/src/modules/admin-state/admin-state-grievance-library.service.ts',
  );
  const tenantGovernance = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant-grievance-governance.service.ts',
  );
  const grievancesService = readRepo('apps/api/src/modules/grievances/grievances.service.ts');
  const workspace = readRepo('apps/citizen-pwa/components/grievances-workspace.tsx');

  it('documents sprint 6.24 state library scope', () => {
    expect(sprintPlan).toContain('State Grievance Library');
    expect(sprintPlan).toContain('grievance-library/categories');
  });

  it('ships state admin grievance library API', () => {
    expect(stateService).toContain('listCategories');
    expect(stateService).toContain('adoptForTenant');
    expect(readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts')).toContain(
      'grievance-library/categories',
    );
  });

  it('ships tenant adopt, fork, and deactivate governance', () => {
    expect(tenantGovernance).toContain('listGovernance');
    expect(tenantGovernance).toContain('adoptGlobal');
    expect(tenantGovernance).toContain('forkCategory');
    expect(tenantGovernance).toContain('deactivateCategory');
    expect(tenantPanel).toContain('grievance-catalogue/governance');
    expect(tenantPanel).toContain('Adopt global category');
    expect(tenantPanel).toContain('Fork local copy');
    expect(tenantPanel).toContain('Deactivate');
  });

  it('maps unknown aggregate categories to other with legacy_unmapped metadata', () => {
    expect(grievancesService).toContain('legacy_unmapped');
    expect(grievancesService).toContain(": 'other'");
  });

  it('state admin UI curates global grievance library', () => {
    expect(statePanel).toContain('/admin/state/grievance-library/categories');
    expect(readRepo('apps/admin-state/app/dashboard/state-dashboard-client.tsx')).toContain(
      'grievanceLibrary',
    );
    expect(
      readRepo('apps/admin-state/components/state-tenant-grievance-catalogue-section.tsx'),
    ).toContain('grievance-catalogue/adopt');
  });

  it('citizen filing paths avoid hardcoded category enums', () => {
    expect(workspace).not.toContain('GRIEVANCE_CATEGORY_CODES');
    expect(
      readRepo('apps/mobile/src/screens/grievances/GrievanceComposerScreen.tsx'),
    ).not.toContain('GRIEVANCE_CATEGORY_SLUGS');
  });
});
