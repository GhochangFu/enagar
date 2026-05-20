import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.21 — Grievance taxonomy foundation', () => {
  const programme = readRepo('docs/runbooks/grievance-taxonomy-programme.md');
  const sprintPlan = readRepo('docs/runbooks/master-sprint-621-plan.md');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260519120000_grievance_taxonomy/migration.sql',
  );
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const catalogueService = readRepo(
    'apps/api/src/modules/grievances/grievance-catalogue.service.ts',
  );
  const publicController = readRepo(
    'apps/api/src/modules/grievances/public-grievance-stats.controller.ts',
  );
  const grievancesController = readRepo('apps/api/src/modules/grievances/grievances.controller.ts');
  const seed = readRepo('apps/api/src/modules/grievances/grievance-catalogue.seed.ts');

  it('documents programme and sprint 6.21 scope', () => {
    expect(programme).toContain('Sprint 6.21');
    expect(sprintPlan).toContain('Grievance Taxonomy Foundation');
    expect(programme).toContain('global_grievance_categories');
  });

  it('adds taxonomy tables and subtype column on grievances', () => {
    expect(migration).toContain('global_grievance_categories');
    expect(migration).toContain('tenant_grievance_categories');
    expect(migration).toContain('tenant_grievance_subtypes');
    expect(migration).toContain('subtype_code');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(schema).toContain('model GlobalGrievanceCategory');
    expect(schema).toContain('subtypeCode');
  });

  it('exposes public and authenticated catalogue read endpoints', () => {
    expect(publicController).toContain("Get('catalogue')");
    expect(publicController).toContain('tenant_code');
    expect(grievancesController).toContain("Get('catalogue')");
    expect(catalogueService).toContain('getActiveCatalogue');
    expect(catalogueService).toContain('assertGrievanceFilingMatchesCatalogue');
  });

  it('seeds global library and KMC/HMC tenant adoption', () => {
    expect(seed).toContain('globalGrievanceCategories');
    expect(seed).toContain("tenantCode: 'KMC'");
    expect(seed).toContain("code: 'streetlights'");
    expect(readRepo('apps/api/prisma/seed.ts')).toContain('seedGlobalGrievanceCatalogue');
    expect(readRepo('apps/api/prisma/seed.ts')).toContain('seedTenantGrievanceCatalogue');
  });

  it('validates create payload includes optional subtype_code', () => {
    expect(readRepo('apps/api/src/modules/grievances/dto.ts')).toContain('subtype_code');
    expect(readRepo('apps/api/src/modules/grievances/grievances.service.ts')).toContain(
      'assertGrievanceFilingMatchesCatalogue',
    );
  });
});
