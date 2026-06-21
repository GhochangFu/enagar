import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-50 — Excel layout heuristic import', () => {
  it('documents layout fixtures and ADR-0015', () => {
    expect(readRepo('docs/ADRs/ADR-0015-excel-layout-heuristic-import.md')).toContain('layout');
    expect(readRepo('docs/runbooks/form-import-excel-layout-fixtures.md')).toContain(
      'birth-certificate-layout-form.xlsx',
    );
  });

  it('ships layout extractor and dual-mode Excel router', () => {
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/excel-layout-form-import.extractor.ts'),
    ).toContain('extractFormImportProposalFromExcelLayout');
    const router = readRepo(
      'apps/api/src/modules/form-import/extractors/excel-form-import.extractor.ts',
    );
    expect(router).toContain('isFormImportTableHeaderRow');
    expect(router).toContain('extractFormImportProposalFromExcelLayout');
    expect(router).toContain('extraction_mode');
  });

  it('surfaces layout banner and extraction_mode in shared UI types (EN-50)', () => {
    const panel = readRepo('packages/forms/src/form-import-ui/FormImportPanel.tsx');
    expect(panel).toContain('Detected Excel form layout');
    expect(readRepo('packages/forms/src/form-import/types.ts')).toContain('extraction_mode');
  });
});
