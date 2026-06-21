import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { extractAcroFormProposal } from './pdf-acroform.extractor';

const fixtureDir = join(__dirname, '../../../../test/fixtures/form-import');

describe('pdf-acroform.extractor (EN-47)', () => {
  it('extracts named AcroForm fields from the birth certificate fixture', async () => {
    const proposal = await extractAcroFormProposal(
      {
        originalname: 'birth-certificate-acroform.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFileSync(join(fixtureDir, 'birth-certificate-acroform.pdf')),
      },
      'birth-certificate',
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.source_kind).toBe('pdf_acroform');
    expect(proposal?.fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
    expect(proposal?.fields.every((field) => field.confidence >= 0.85)).toBe(true);
  });

  it('returns null when the PDF has no AcroForm fields', async () => {
    const proposal = await extractAcroFormProposal(
      {
        originalname: 'handwritten-scan-placeholder.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFileSync(join(fixtureDir, 'handwritten-scan-placeholder.pdf')),
      },
      'birth-certificate',
    );

    expect(proposal).toBeNull();
  });
});
