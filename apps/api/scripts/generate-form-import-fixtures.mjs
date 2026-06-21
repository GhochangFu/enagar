/**
 * Generates sample .xlsx fixtures for EN-30 (run via pnpm fixtures:form-import).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'test/fixtures/form-import');

const templates = {
  'birth-certificate-template.xlsx': [
    ['field_id', 'label_en', 'label_bn', 'type', 'required', 'options', 'help_en'],
    ['applicant-section', 'Applicant details', 'আবেদনকারীর বিবরণ', 'section', 'false', '', ''],
    ['applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'text', 'true', '', 'Full legal name'],
    ['date_of_birth', 'Date of birth', '', 'date', 'true', '', 'YYYY-MM-DD'],
    ['gender', 'Gender', '', 'radio', 'true', 'male:Male|female:Female|other:Other', ''],
  ],
  'trade-licence-template.xlsx': [
    ['field_id', 'label_en', 'type', 'required', 'options'],
    ['business-section', 'Business details', 'section', 'false', ''],
    ['trade_name', 'Trade name', 'text', 'true', ''],
    ['trade_type', 'Trade type', 'select', 'true', 'retail:Retail|food:Food|services:Services'],
    ['annual_turnover', 'Annual turnover (INR)', 'number', 'false', ''],
    ['supporting-doc', 'Supporting document', 'file', 'false', ''],
  ],
};

mkdirSync(outDir, { recursive: true });

for (const [filename, rows] of Object.entries(templates)) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'fields');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  writeFileSync(join(outDir, filename), buffer);
  console.log(`Wrote ${filename}`);
}
