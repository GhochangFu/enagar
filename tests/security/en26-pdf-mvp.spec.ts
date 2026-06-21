import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 3 — PDF MVP (EN-39–EN-42)', () => {
  it('documents PDF import runbook and fixtures (EN-39)', () => {
    expect(readRepo('docs/runbooks/form-import-pdf.md')).toContain(
      'birth-certificate-acroform.pdf',
    );
    expect(readRepo('apps/api/package.json')).toContain('pdf-lib');
  });

  it('ships PDF-aware import UI for both portals (EN-38 continuity)', () => {
    const panel = readRepo('packages/forms/src/form-import-ui/FormImportPanel.tsx');
    expect(panel).toContain('.pdf');
    expect(panel).toContain('Excel, Word, or PDF');
  });

  it('wires PDF extraction modes in the API module (EN-39–EN-42)', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('extractFormImportProposalFromPdf');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/pdf-acroform.extractor.ts'),
    ).toContain('pdf_acroform');
    expect(
      readRepo('apps/api/src/modules/form-import/extractors/pdf-digital-text.extractor.ts'),
    ).toContain('pdf_digital');
    expect(readRepo('apps/api/src/modules/form-import/extractors/pdf-ocr.extractor.ts')).toContain(
      'pdf_ocr',
    );
    expect(readRepo('packages/forms/src/form-import/policy.ts')).toContain(
      'handwritten_rejection_message',
    );
  });
});
