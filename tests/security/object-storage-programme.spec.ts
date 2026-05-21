import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Object storage upload programme (6.25–6.30) — cross-cutting contracts', () => {
  const objectStorage = readRepo('apps/api/src/common/object-storage/object-storage.service.ts');
  const objectStorageConfig = readRepo(
    'apps/api/src/common/object-storage/object-storage.config.ts',
  );
  const documentsService = readRepo('apps/api/src/modules/documents/documents.service.ts');
  const grievancesService = readRepo('apps/api/src/modules/grievances/grievances.service.ts');
  const adminTenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const formsUpload = readRepo('packages/forms/src/application-document-upload.ts');

  it('ObjectStorageService rejects traversal and enforces tenant prefixes', () => {
    expect(objectStorage).toContain('assertSafeObjectKey');
    expect(objectStorage).toContain("key.includes('..')");
    expect(objectStorage).toContain('assertTenantObjectKey');
    expect(objectStorage).toContain('tenants/${code}/');
    expect(objectStorageConfig).toContain('OBJECT_STORAGE_DISABLED');
    expect(objectStorage).toContain('buildPublicObjectUrl');
  });

  it('Application documents use presign, confirm-upload, and guarded scan-result', () => {
    expect(documentsService).toContain('objectStorage.presignUpload');
    expect(documentsService).toContain('documentScanQueue.enqueueScan');
    expect(documentsService).toContain('allowsClientScanSimulation');
    expect(documentsService).toContain('ForbiddenException');
    expect(documentsService).toContain('tenants/${tenantCode}/applications/');
    expect(documentsService).toContain("scan_status !== 'clean'");
  });

  it('Grievance evidence uses presign upload-intent and headObject on register', () => {
    expect(grievancesService).toContain('createEvidenceUploadIntent');
    expect(grievancesService).toContain('objectStorage.presignUpload');
    expect(grievancesService).toContain('registerCitizenAttachment');
    expect(grievancesService).toContain('headObject');
    expect(grievancesService).toContain('tenants/${tenantCode.toLowerCase()}/grievances/evidence/');
  });

  it('Tenant branding and Desk surfaces stream bytes when storage is enabled', () => {
    expect(adminTenantService).toContain('createBrandingAssetUploadIntent');
    expect(adminTenantService).toContain('storage_key must be tenant-prefixed');
    expect(adminTenantService).toContain('Branding object not found in storage');
    expect(adminTenantService).toContain('applicationDocument.findMany');
    expect(adminTenantService).toContain('getDeskApplicationDocumentBlob');
    expect(adminTenantService).toContain('getDeskGrievanceAttachmentBlob');
    expect(adminTenantService).toContain('getObjectBuffer');
  });

  it('Citizen clients upload real bytes when storage is enabled (not minio:// skip)', () => {
    expect(formsUpload).toContain('isStubObjectStorageUploadUrl');
    expect(formsUpload).toContain('putFileToUploadUrl');
    expect(formsUpload).toContain('confirmDocumentUpload');
    expect(readRepo('apps/citizen-pwa/lib/grievance-evidence.ts')).toContain(
      'isStubObjectStorageUploadUrl',
    );
    expect(readRepo('apps/mobile/src/api/grievanceEvidenceApi.ts')).toContain('upload_url');
  });
});
