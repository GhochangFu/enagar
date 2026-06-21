import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 1 — Excel MVP (EN-30–EN-36)', () => {
  it('documents the Excel template spec and fixtures (EN-30)', () => {
    expect(readRepo('docs/runbooks/form-import-excel-template.md')).toContain('field_id');
    expect(readRepo('apps/api/package.json')).toContain('fixtures:form-import');
  });

  it('ships shared form-import UI for both portals (EN-33–EN-35)', () => {
    const pkg = readRepo('packages/forms/package.json');
    expect(pkg).toContain('"./form-import-ui"');
    expect(readRepo('packages/forms/src/form-import-ui/FormImportPanel.tsx')).toContain(
      'Apply to draft',
    );
    expect(
      readRepo('apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx'),
    ).toContain('FormImportPanel');
    expect(
      readRepo('apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx'),
    ).toContain('FormImportPanel');
  });

  it('wires sync Excel extraction in the API module (EN-31–EN-32)', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('extractFormImportProposalFromExcel');
    expect(service).not.toContain('NotImplementedException');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/excel-form-import.extractor.ts'),
    ).toContain('EXCEL_IMPORT_REQUIRED_COLUMNS');
  });

  it('exports applyImportProposalToDraft helper (EN-35)', () => {
    expect(readRepo('packages/forms/src/form-import/index.ts')).toContain(
      'applyImportProposalToDraft',
    );
  });
});
