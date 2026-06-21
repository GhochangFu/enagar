import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ExcelFormImportError,
  extractFormImportProposalFromExcel,
} from './excel-form-import.extractor';

const fixtureDir = join(__dirname, '../../../../test/fixtures/form-import');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

describe('excel-form-import.extractor (EN-31)', () => {
  it('parses birth-certificate-template.xlsx into a valid proposal', () => {
    const proposal = extractFormImportProposalFromExcel(
      {
        originalname: 'birth-certificate-template.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1,
        buffer: readFixture('birth-certificate-template.xlsx'),
      },
      'birth-certificate',
    );

    expect(proposal.source_kind).toBe('excel');
    expect(proposal.fields.length).toBeGreaterThanOrEqual(3);
    expect(proposal.fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
    expect(proposal.overall_confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('parses trade-licence-template.xlsx with choice options', () => {
    const proposal = extractFormImportProposalFromExcel(
      {
        originalname: 'trade-licence-template.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1,
        buffer: readFixture('trade-licence-template.xlsx'),
      },
      'trade-licence',
    );

    const tradeType = proposal.fields.find((field) => field.field_id === 'trade_type');
    expect(tradeType?.options?.length).toBeGreaterThan(1);
  });

  it('rejects workbooks missing required columns', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['field_id', 'type'],
      ['only_id', 'text'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'fields');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    expect(() =>
      extractFormImportProposalFromExcel(
        {
          originalname: 'bad.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
          buffer,
        },
        'demo',
      ),
    ).toThrow(ExcelFormImportError);
  });
});
