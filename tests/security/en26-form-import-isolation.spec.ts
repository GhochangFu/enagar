import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 5 — form import isolation (EN-48)', () => {
  it('scopes tenant import jobs by tenantId and serviceId on GET', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('row.tenantId !== tenantId');
    expect(service).toContain('row.serviceId !== resourceKey');
    expect(service).toContain('getTenantImportJob');
  });

  it('scopes state import jobs by service code on GET', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('row.serviceCode !== resourceKey');
    expect(service).toContain('getStateImportJob');
  });

  it('uses tenant-prefixed object storage keys for tenant uploads', () => {
    const storage = readRepo('apps/api/src/modules/form-import/form-import-storage.ts');
    expect(storage).toContain('tenants/${code}/form-import/');
    expect(readRepo('apps/api/src/modules/form-import/form-import.service.spec.ts')).toContain(
      'denies cross-tenant job lookup',
    );
    expect(readRepo('apps/api/src/modules/form-import/form-import.service.spec.ts')).toContain(
      'denies cross-service tenant job lookup',
    );
  });

  it('indexes form_import_jobs for tenant and scope lookups', () => {
    const schema = readRepo('apps/api/prisma/schema.prisma');
    expect(schema).toContain('model FormImportJob');
    expect(schema).toContain('@@index([tenantId, serviceId, createdAt(sort: Desc)])');
    expect(schema).toContain('@@index([scope, serviceCode, createdAt(sort: Desc)])');
  });

  it('requires portal staff roles on import routes', () => {
    expect(readRepo('apps/api/src/modules/form-import/form-import.service.ts')).toContain(
      'assertTenantPortalStaff',
    );
    expect(readRepo('apps/api/src/modules/form-import/form-import.service.ts')).toContain(
      'assertStateAdmin',
    );
  });
});
