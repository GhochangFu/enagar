import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.6 catalogue alignment contract', () => {
  const servicesService = readRepo('apps/api/src/modules/services/services.service.ts');
  const servicesModule = readRepo('apps/api/src/modules/services/services.module.ts');
  const applicationsService = readRepo('apps/api/src/modules/applications/applications.service.ts');
  const postgresApplicationStore = readRepo(
    'apps/api/src/modules/applications/postgres-application.store.ts',
  );
  const seed = readRepo('apps/api/prisma/seed.ts');
  const pwaPage = readRepo('apps/citizen-pwa/app/page.tsx');
  const pwaDefaults = readRepo('apps/citizen-pwa/lib/service-schemas.ts');
  const mobileComposer = readRepo('apps/mobile/src/screens/services/ApplicationComposerScreen.tsx');
  const mobileCatalogueApi = readRepo('apps/mobile/src/api/servicesCatalogApi.ts');
  const mobileDefaults = readRepo('apps/mobile/src/lib/serviceSchemas.ts');

  it('makes the public tenant catalogue resolve active published forms from Postgres', () => {
    expect(servicesModule).toContain('DatabaseModule');
    expect(servicesService).toContain('PrismaService');
    expect(servicesService).toContain("formVersions: { some: { status: 'published' } }");
    expect(servicesService).toContain('coercePublishedFormSchema');
    expect(servicesService).toContain('validateFormSchema');
    expect(servicesService).toContain('accounting_code');
  });

  it('seeds published form versions so local citizen smoke starts from database state', () => {
    expect(seed).toContain('priorityServiceFormSchemas');
    expect(seed).toContain('serviceFormVersion.upsert');
    expect(seed).toContain("status: 'published'");
    expect(seed).toContain('publishedAt: new Date()');
  });

  it('validates and persists applications against the published runtime form version', () => {
    expect(applicationsService).toContain('service.form_schema');
    expect(applicationsService).toContain('form_version_id: service.form_version_id');
    expect(postgresApplicationStore).toContain(
      'formVersionId: application.form_version_id ?? null',
    );
  });

  it('keeps PWA apply schema-driven from API catalogue rows, not bundled fixtures', () => {
    expect(pwaPage).toContain('selectedService?.form_schema');
    expect(pwaPage).not.toContain('schemaByServiceCode');
    expect(pwaDefaults).not.toContain('@enagar/forms/fixtures');
  });

  it('keeps mobile apply schema-driven from API catalogue rows, not bundled fixtures', () => {
    expect(mobileCatalogueApi).toContain('fetchTenantService');
    expect(mobileComposer).toContain('service?.form_schema');
    expect(mobileComposer).toContain('fetchTenantService');
    expect(mobileDefaults).not.toContain('@enagar/forms/fixtures');
  });
});
