import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 2 — Word MVP (EN-37–EN-38)', () => {
  it('documents the Word template spec and fixtures (EN-37)', () => {
    expect(readRepo('docs/runbooks/form-import-word-template.md')).toContain('field_id');
    expect(readRepo('apps/api/package.json')).toContain('jszip');
  });

  it('ships Word-aware import UI for both portals (EN-38)', () => {
    const panel = readRepo('packages/forms/src/form-import-ui/FormImportPanel.tsx');
    expect(panel).toContain('.docx');
    expect(panel).toContain('Import from Excel or Word');
    expect(
      readRepo('apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx'),
    ).toContain('FormImportPanel');
    expect(
      readRepo('apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx'),
    ).toContain('FormImportPanel');
  });

  it('wires sync Word extraction in the API module (EN-37–EN-38)', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('extractFormImportProposalFromWord');
    expect(service).toContain('isWordUpload');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/word-form-import.extractor.ts'),
    ).toContain('parseFormImportProposalFromTableRows');
  });
});
