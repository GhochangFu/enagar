import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractFormImportProposalFromExcelLayout,
  readExcelWorkbookSheet,
} from './excel-layout-form-import.extractor';

const fixtureDir = join(__dirname, '../../../../test/fixtures/form-import');

function readFixture(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

function upload(name: string, buffer: Buffer) {
  return {
    originalname: name,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
  };
}

describe('excel-layout-form-import.extractor (EN-50)', () => {
  it('parses birth-certificate-layout-form.xlsx with section and input fields', () => {
    const buffer = readFixture('birth-certificate-layout-form.xlsx');
    const sheet = readExcelWorkbookSheet(buffer);
    const proposal = extractFormImportProposalFromExcelLayout(
      upload('birth-certificate-layout-form.xlsx', buffer),
      'birth-certificate',
      sheet,
    );

    expect(proposal.extraction_mode).toBe('layout');
    expect(proposal.fields.length).toBeGreaterThanOrEqual(4);
    expect(proposal.fields.some((field) => field.field_id === 'applicant_details')).toBe(true);
    expect(proposal.fields.some((field) => field.field_id === 'applicant_name')).toBe(true);
    expect(proposal.fields.some((field) => field.field_id === 'date_of_birth')).toBe(true);
    expect(proposal.fields.some((field) => field.type === 'radio')).toBe(true);
    expect(proposal.fields.every((field) => field.confidence <= 0.8)).toBe(true);
  });

  it('parses trade-licence-grid-form.xlsx with noisy rows', () => {
    const buffer = readFixture('trade-licence-grid-form.xlsx');
    const proposal = extractFormImportProposalFromExcelLayout(
      upload('trade-licence-grid-form.xlsx', buffer),
      'trade-licence',
      readExcelWorkbookSheet(buffer),
    );

    expect(proposal.fields.length).toBeGreaterThanOrEqual(4);
    expect(proposal.fields.some((field) => field.field_id === 'trade_type')).toBe(true);
    const tradeType = proposal.fields.find((field) => field.field_id === 'trade_type');
    expect(tradeType?.type === 'radio' || tradeType?.type === 'select').toBe(true);
  });

  it('rejects sheets with only a title row', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([['Only a title', '', '']]);
    sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Application');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    expect(() =>
      extractFormImportProposalFromExcelLayout(
        upload('title-only.xlsx', buffer),
        'demo',
        readExcelWorkbookSheet(buffer),
      ),
    ).toThrow(/recognizable form fields/);
  });
});
