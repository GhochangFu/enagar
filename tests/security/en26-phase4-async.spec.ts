import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('EN-26 Phase 4 async infrastructure (EN-43–EN-45)', () => {
  it('persists form-import jobs in Prisma (EN-45)', () => {
    expect(readRepo('apps/api/prisma/schema.prisma')).toContain('model FormImportJob');
    expect(readRepo('apps/api/prisma/schema.prisma')).toContain('@@map("form_import_jobs")');
  });

  it('stores source files with scoped object keys (EN-43)', () => {
    const storage = readRepo('apps/api/src/modules/form-import/form-import-storage.ts');
    expect(storage).toContain('buildTenantFormImportObjectKey');
    expect(storage).toContain('buildStateFormImportObjectKey');
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('putObject');
    expect(service).toContain('sourceStorageKey');
  });

  it('enqueues BullMQ jobs and ships form-import-worker (EN-44)', () => {
    expect(readRepo('apps/api/src/common/form-import/form-import.queue.ts')).toContain(
      'form-import',
    );
    expect(readRepo('services/form-import-worker/package.json')).toContain(
      '@enagar/form-import-worker',
    );
    expect(readRepo('services/form-import-worker/src/index.ts')).toContain(
      'FORM_IMPORT_QUEUE_NAME',
    );
  });

  it('polls async jobs from FormImportPanel', () => {
    const panel = readRepo('packages/forms/src/form-import-ui/FormImportPanel.tsx');
    expect(panel).toContain('pollJob');
    expect(panel).toContain("'processing'");
  });
});
