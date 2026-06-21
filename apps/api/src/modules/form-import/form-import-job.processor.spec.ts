import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ExcelFormImportError } from './extractors/excel-form-import.extractor';
import { PdfFormImportError } from './extractors/pdf-form-import.extractor';
import { WordFormImportError } from './extractors/word-form-import.extractor';
import {
  UnsupportedFormImportFormatError,
  completeFormImportFromProposal,
  extractFormImportFromUpload,
  isFormImportExtractionError,
} from './form-import-job.processor';

const fixtureDir = join(__dirname, '../../../test/fixtures/form-import');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

describe('form-import-job.processor (EN-47)', () => {
  it('routes Excel uploads through the excel extractor', async () => {
    const result = await extractFormImportFromUpload(
      {
        originalname: 'birth-certificate-template.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1,
        buffer: readFixture('birth-certificate-template.xlsx'),
      },
      'birth-certificate',
    );

    expect(result.sourceKind).toBe('excel');
    expect(result.proposal.extraction_mode).toBe('table');
    expect(result.proposal.fields.length).toBeGreaterThan(0);
  });

  it('routes Word uploads through the word extractor', async () => {
    const result = await extractFormImportFromUpload(
      {
        originalname: 'birth-certificate-template.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1,
        buffer: readFixture('birth-certificate-template.docx'),
      },
      'birth-certificate',
    );

    expect(result.sourceKind).toBe('word');
  });

  it('routes PDF uploads through the pdf router', async () => {
    const result = await extractFormImportFromUpload(
      {
        originalname: 'birth-certificate-acroform.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: readFixture('birth-certificate-acroform.pdf'),
      },
      'birth-certificate',
    );

    expect(result.sourceKind).toBe('pdf_acroform');
  });

  it('rejects unsupported file types', async () => {
    await expect(
      extractFormImportFromUpload(
        {
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          size: 3,
          buffer: Buffer.from('txt'),
        },
        'demo',
      ),
    ).rejects.toThrow(UnsupportedFormImportFormatError);
  });

  it('completes applyable proposals as completed jobs', () => {
    const completion = completeFormImportFromProposal(
      {
        source_kind: 'excel',
        source_filename: 'template.xlsx',
        service_code: 'birth-certificate',
        overall_confidence: 0.95,
        fields: [
          {
            candidate_id: 'excel-1',
            field_id: 'applicant_name',
            type: 'text',
            label: { en: 'Applicant name' },
            confidence: 0.95,
            disposition: 'accepted',
          },
        ],
      },
      'excel',
      'birth-certificate',
    );

    expect(completion.status).toBe('completed');
    expect(completion.proposed_schema.fields).toHaveLength(1);
  });

  it('rejects handwritten PDF proposals via applyability gate', () => {
    const completion = completeFormImportFromProposal(
      {
        source_kind: 'pdf_digital',
        source_filename: 'scan.pdf',
        service_code: 'birth-certificate',
        overall_confidence: 0,
        fields: [],
        rejection_reason: 'Handwritten forms are not supported',
      },
      'pdf_digital',
      'birth-certificate',
    );

    expect(completion.status).toBe('rejected');
    expect(completion.rejectionReason).toContain('Handwritten');
  });

  it('classifies extractor errors for HTTP mapping', () => {
    expect(isFormImportExtractionError(new ExcelFormImportError('bad excel'))).toBe(true);
    expect(isFormImportExtractionError(new WordFormImportError('bad word'))).toBe(true);
    expect(isFormImportExtractionError(new PdfFormImportError('bad pdf'))).toBe(true);
    expect(isFormImportExtractionError(new Error('other'))).toBe(false);
  });
});
