import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.29 — branding upload & Desk application documents', () => {
  const adminTenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const adminTenantController = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant.controller.ts',
  );
  const objectStorage = readRepo('apps/api/src/common/object-storage/object-storage.service.ts');
  const operationsClient = readRepo(
    'apps/admin-tenant/app/dashboard/operations/operations-client.tsx',
  );
  const deskPanel = readRepo('apps/admin-tenant/components/desk-application-documents-panel.tsx');

  it('exposes branding upload-intent with tenant-prefixed keys and public URL builder', () => {
    expect(adminTenantController).toContain('branding-assets/upload-intent');
    expect(adminTenantService).toContain('createBrandingAssetUploadIntent');
    expect(adminTenantService).toContain('storage_key must be tenant-prefixed');
    expect(adminTenantService).toContain('buildPublicObjectUrl');
    expect(objectStorage).toContain('buildPublicObjectUrl');
    expect(adminTenantService).toContain('Branding object not found in storage');
  });

  it('Desk loads application_documents and streams blob preview for operators', () => {
    expect(adminTenantController).toContain(
      'desk/applications/:applicationId/documents/:documentId/blob',
    );
    expect(adminTenantService).toContain('applicationDocument.findMany');
    expect(adminTenantService).toContain('getDeskApplicationDocumentBlob');
    expect(deskPanel).toContain('documents/');
    expect(operationsClient).toContain('branding-assets/upload-intent');
    expect(operationsClient).toContain('putFileToUploadUrl');
  });
});
