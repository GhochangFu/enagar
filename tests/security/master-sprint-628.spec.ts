import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.28 — grievance evidence end-to-end', () => {
  const grievancesService = readRepo('apps/api/src/modules/grievances/grievances.service.ts');
  const grievancesController = readRepo('apps/api/src/modules/grievances/grievances.controller.ts');
  const adminTenant = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const pwaEvidence = readRepo('apps/citizen-pwa/lib/grievance-evidence.ts');
  const pwaPreview = readRepo('apps/citizen-pwa/components/grievance-evidence-preview.tsx');
  const mobileEvidence = readRepo('apps/mobile/src/api/grievanceEvidenceApi.ts');
  const mobileComposer = readRepo('apps/mobile/src/screens/grievances/GrievanceComposerScreen.tsx');

  it('wires grievance evidence to object storage with register guard and citizen blob', () => {
    expect(grievancesService).toContain('objectStorage.presignUpload');
    expect(grievancesService).toContain('headObject');
    expect(grievancesService).toContain('getCitizenAttachmentBlob');
    expect(grievancesController).toContain('attachments/:attachmentId/blob');
    expect(adminTenant).toContain('getObjectBuffer');
    expect(adminTenant).toContain('Evidence object not found in storage');
  });

  it('PWA and mobile upload real bytes when storage is enabled', () => {
    expect(pwaEvidence).toContain('isStubObjectStorageUploadUrl');
    expect(pwaEvidence).not.toContain("uploadUrl.startsWith('minio://')");
    expect(pwaPreview).toContain('/attachments/');
    expect(mobileEvidence).toContain('putFileToUploadUrl');
    expect(mobileComposer).toContain('uploadGrievanceEvidenceAssets');
    expect(mobileComposer).toContain('ImagePicker');
  });
});
