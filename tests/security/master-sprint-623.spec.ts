import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.23 — Citizen grievance catalogue (PWA + mobile)', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-623-plan.md');
  const workspace = readRepo('apps/citizen-pwa/components/grievances-workspace.tsx');
  const composer = readRepo('apps/mobile/src/screens/grievances/GrievanceComposerScreen.tsx');
  const packageFetch = readRepo('packages/grievance-catalogue/src/fetch.ts');
  const packageLabels = readRepo('packages/grievance-catalogue/src/labels.ts');

  it('documents sprint 6.23 citizen catalogue scope', () => {
    expect(sprintPlan).toContain('Citizen Grievance Catalogue');
    expect(sprintPlan).toContain('fetchPublicGrievanceCatalogue');
  });

  it('ships shared @enagar/grievance-catalogue package', () => {
    expect(packageFetch).toContain('fetchPublicGrievanceCatalogue');
    expect(packageLabels).toContain('resolveGrievanceCategoryLabel');
    expect(readRepo('packages/grievance-catalogue/package.json')).toContain(
      '@enagar/grievance-catalogue',
    );
  });

  it('PWA filing path loads API catalogue (no static category enum)', () => {
    expect(workspace).not.toContain('GRIEVANCE_CATEGORY_CODES');
    expect(workspace).toContain('fetchPublicGrievanceCatalogue');
    expect(workspace).toContain('pickSubtype');
    expect(workspace).toContain('subtype_code');
  });

  it('mobile composer loads API catalogue (no static slug list)', () => {
    expect(composer).not.toContain('GRIEVANCE_CATEGORY_SLUGS');
    expect(composer).not.toContain('grievanceCategories');
    expect(composer).toContain('fetchPublicGrievanceCatalogue');
    expect(composer).toContain('subtype_code');
    expect(composer).toContain("step === 'subtype'");
  });

  it('mobile draft stores category and subtype codes', () => {
    expect(readRepo('apps/mobile/src/draft/grievanceComposerDraft.ts')).toContain('subtype_slug');
  });
});
