import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PdfFormImportError, extractFormImportProposalFromPdf } from './pdf-form-import.extractor';

const fixtureDir = join(__dirname, '../../../../test/fixtures/form-import');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

describe('pdf-form-import.extractor (EN-39–EN-42)', () => {
  it('parses AcroForm PDF into a high-confidence proposal (EN-39)', async () => {
    const proposal = await extractFormImportProposalFromPdf(
      {
        originalname: 'birth-certificate-acroform.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFixture('birth-certificate-acroform.pdf'),
      },
      'birth-certificate',
    );

    expect(proposal.source_kind).toBe('pdf_acroform');
    expect(proposal.fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
    expect(proposal.fields.every((field) => field.confidence >= 0.85)).toBe(true);
  });

  it('parses digital-text PDF with layout heuristics (EN-40)', async () => {
    const proposal = await extractFormImportProposalFromPdf(
      {
        originalname: 'birth-certificate-digital-text.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFixture('birth-certificate-digital-text.pdf'),
      },
      'birth-certificate',
    );

    expect(proposal.source_kind).toBe('pdf_digital');
    expect(proposal.fields.length).toBeGreaterThanOrEqual(2);
    expect(proposal.warnings?.length).toBeGreaterThan(0);
  });

  it('rejects handwritten / blank PDFs via EN-41 gate', async () => {
    const proposal = await extractFormImportProposalFromPdf(
      {
        originalname: 'handwritten-scan-placeholder.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFixture('handwritten-scan-placeholder.pdf'),
      },
      'birth-certificate',
    );

    expect(proposal.fields).toHaveLength(0);
    expect(proposal.rejection_reason).toContain('Handwritten forms are not supported');
  });

  it('rejects non-PDF uploads', async () => {
    await expect(
      extractFormImportProposalFromPdf(
        {
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          size: 3,
          buffer: Buffer.from('txt'),
        },
        'demo',
      ),
    ).rejects.toThrow(PdfFormImportError);
  });
});
