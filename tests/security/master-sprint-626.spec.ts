import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.26 — application documents Postgres + real client upload', () => {
  const documentsService = readRepo('apps/api/src/modules/documents/documents.service.ts');
  const documentsModule = readRepo('apps/api/src/modules/documents/documents.module.ts');
  const applicationsService = readRepo('apps/api/src/modules/applications/applications.service.ts');
  const webFields = readRepo('packages/forms/src/web/DynamicFormFields.tsx');
  const mobileFields = readRepo('apps/mobile/src/forms/DynamicFormFields.tsx');
  const pwaPage = readRepo('apps/citizen-pwa/app/page.tsx');
  const mobileDocs = readRepo('apps/mobile/src/api/documentsApi.ts');

  it('persists application documents in Postgres via Prisma', () => {
    expect(documentsService).toContain('prisma.applicationDocument.create');
    expect(documentsService).not.toContain('private readonly documents = new Map');
    expect(documentsModule).toContain('DatabaseModule');
    expect(applicationsService).toContain('withPersistedDocuments');
    expect(applicationsService).toContain('applicationDocument.findMany');
  });

  it('replaces simulated file pickers with real upload flows', () => {
    expect(webFields).toContain('type="file"');
    expect(webFields).not.toContain('Simulated file metadata');
    expect(pwaPage).toContain('putFileToUploadUrl');
    expect(pwaPage).toContain('confirmDocumentUpload');
    expect(pwaPage).toContain('applicationFileBlobs');
    expect(mobileFields).toContain('DocumentPicker.getDocumentAsync');
    expect(mobileDocs).toContain('confirm-upload');
    expect(mobileDocs).toContain('putFileToUploadUrl');
  });
});
