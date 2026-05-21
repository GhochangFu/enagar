import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.25 — object storage platform', () => {
  const objectStorageService = readRepo(
    'apps/api/src/common/object-storage/object-storage.service.ts',
  );
  const objectStorageConfig = readRepo(
    'apps/api/src/common/object-storage/object-storage.config.ts',
  );
  const documentsController = readRepo('apps/api/src/modules/documents/documents.controller.ts');
  const documentsService = readRepo('apps/api/src/modules/documents/documents.service.ts');
  const grievancesService = readRepo('apps/api/src/modules/grievances/grievances.service.ts');
  const appModule = readRepo('apps/api/src/app.module.ts');
  const envExample = readRepo('infrastructure/.env.example');

  it('adds a global ObjectStorageModule wired into the API app', () => {
    expect(appModule).toContain('ObjectStorageModule');
    expect(objectStorageService).toContain('@Injectable()');
    expect(objectStorageService).toContain('presignUpload');
    expect(objectStorageService).toContain('presignDownload');
    expect(objectStorageService).toContain('headObject');
  });

  it('documents and grievances use ObjectStorageService instead of inline minio stubs', () => {
    expect(documentsService).toContain('ObjectStorageService');
    expect(documentsService).toContain('presignUpload');
    expect(documentsService).toContain('confirmUpload');
    expect(grievancesService).toContain('objectStorage.presignUpload');
    expect(grievancesService).not.toMatch(
      /return `minio:\/\/enagar-local\/\$\{objectKey\}\?action=/,
    );
  });

  it('exposes confirm-upload and guards object keys', () => {
    expect(documentsController).toContain("@Post(':id/confirm-upload')");
    expect(objectStorageService).toContain('assertSafeObjectKey');
    expect(objectStorageService).toContain('assertTenantObjectKey');
    expect(objectStorageConfig).toContain('OBJECT_STORAGE_DISABLED');
    expect(envExample).toContain('OBJECT_STORAGE_ENDPOINT');
  });
});
