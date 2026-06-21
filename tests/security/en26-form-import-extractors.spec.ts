import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 5 — extractor unit tests (EN-47)', () => {
  it('ships table parser unit tests', () => {
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/form-import-table.parser.spec.ts'),
    ).toContain('isFormImportTableHeaderRow');
  });

  it('ships job processor unit tests', () => {
    expect(
      readRepo('apps/api/src/modules/form-import/form-import-job.processor.spec.ts'),
    ).toContain('extractFormImportFromUpload');
  });

  it('ships PDF extractor unit tests', () => {
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/pdf-acroform.extractor.spec.ts'),
    ).toContain('extractAcroFormProposal');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/pdf-digital-text.extractor.spec.ts'),
    ).toContain('extractDigitalTextFromPdf');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/pdf-form-import.extractor.spec.ts'),
    ).toContain('extractFormImportProposalFromPdf');
  });

  it('ships Excel and Word extractor unit tests', () => {
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/excel-form-import.extractor.spec.ts'),
    ).toContain('extractFormImportProposalFromExcel');
    expect(
      readRepo(
        'apps/api/src/modules/form-import/extractors/excel-layout-form-import.extractor.spec.ts',
      ),
    ).toContain('extractFormImportProposalFromExcelLayout');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/word-form-import.extractor.spec.ts'),
    ).toContain('extractFormImportProposalFromWord');
  });
});
