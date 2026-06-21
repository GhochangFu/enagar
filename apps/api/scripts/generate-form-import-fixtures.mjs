/**
 * Generates sample .xlsx and .docx fixtures for form import.
 * Run via: pnpm --filter @enagar/api run fixtures:form-import
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import * as XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'test/fixtures/form-import');

/** @param {string[][]} rows @param {{ merges?: XLSX.Range[] }} [opts] */
function writeWorkbook(filename, sheetName, rows, opts = {}) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (opts.merges?.length) {
    sheet['!merges'] = opts.merges;
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  writeTarget(filename, buffer);
}

function writeTarget(filename, buffer) {
  const target = join(outDir, filename);
  try {
    writeFileSync(target, buffer);
    console.log(`Wrote ${filename}`);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EBUSY') {
      console.warn(`Skipped ${filename} (file open elsewhere)`);
      return;
    }
    throw err;
  }
}

async function writeDocx(filename, title, rows) {
  const tableRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(String(cell ?? ''))] })],
            }),
        ),
      }),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun(title)] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  writeTarget(filename, await Packer.toBuffer(doc));
}

const structuredTemplates = {
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

const wordTemplates = {
  'birth-certificate-template.docx': {
    title: 'Birth certificate form import template',
    rows: structuredTemplates['birth-certificate-template.xlsx'],
  },
  'trade-licence-template.docx': {
    title: 'Trade licence form import template',
    rows: structuredTemplates['trade-licence-template.xlsx'],
  },
};

/** EN-50 layout-style workbooks (no field_id / type columns). */
const layoutForms = {
  'birth-certificate-layout-form.xlsx': {
    sheetName: 'Application',
    rows: [
      ['Birth Certificate Application', '', ''],
      ['', '', ''],
      ['Applicant details', '', ''],
      ['Applicant name:', '', ''],
      ['Date of birth:', '', ''],
      ['Gender:', '☐ Male   ☐ Female   ☐ Other', ''],
    ],
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }],
  },
  'trade-licence-grid-form.xlsx': {
    sheetName: 'Application',
    rows: [
      ['Trade Licence Application', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
      ['Business details', '', '', ''],
      ['Trade name:', '', '', ''],
      ['', '', '', ''],
      ['Trade type:', '☐ Retail   ☐ Food   ☐ Services', '', ''],
      ['Annual turnover (INR):', '', '', ''],
      ['Supporting document (attach):', '', '', ''],
    ],
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }],
  },
};

mkdirSync(outDir, { recursive: true });

for (const [filename, rows] of Object.entries(structuredTemplates)) {
  writeWorkbook(filename, 'fields', rows);
}

for (const [filename, spec] of Object.entries(layoutForms)) {
  writeWorkbook(filename, spec.sheetName, spec.rows, { merges: spec.merges });
}

for (const [filename, spec] of Object.entries(wordTemplates)) {
  await writeDocx(filename, spec.title, spec.rows);
}

const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

async function writeAcroformPdf(filename, fields) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const form = pdfDoc.getForm();
  let y = 720;

  page.drawText('Birth Certificate Application', { x: 50, y: 760, size: 16, font });

  for (const field of fields) {
    page.drawText(`${field.label}:`, { x: 50, y, size: 11, font });
    if (field.type === 'text') {
      const textField = form.createTextField(field.id);
      textField.addToPage(page, { x: 200, y: y - 4, width: 280, height: 18 });
    } else if (field.type === 'radio') {
      const radio = form.createRadioGroup(field.id);
      for (const option of field.options) {
        radio.addOptionToPage(option, page, { x: 200, y, width: 18, height: 18 });
        page.drawText(option, { x: 220, y, size: 10, font });
      }
    }
    y -= 36;
  }

  writeTarget(filename, Buffer.from(await pdfDoc.save()));
}

async function writeDigitalTextPdf(filename, lines) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 760;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
    y -= 24;
  }
  writeTarget(filename, Buffer.from(await pdfDoc.save()));
}

async function writeBlankPdf(filename) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]);
  writeTarget(filename, Buffer.from(await pdfDoc.save()));
}

await writeAcroformPdf('birth-certificate-acroform.pdf', [
  { id: 'applicant_name', label: 'Applicant name', type: 'text' },
  { id: 'date_of_birth', label: 'Date of birth', type: 'text' },
  {
    id: 'gender',
    label: 'Gender',
    type: 'radio',
    options: ['Male', 'Female', 'Other'],
  },
]);

await writeDigitalTextPdf('birth-certificate-digital-text.pdf', [
  'Birth Certificate Application',
  'APPLICANT DETAILS',
  'Applicant name: ____________________',
  'Date of birth: ____________________',
  'Gender: [ ] Male   [ ] Female   [ ] Other',
]);

await writeBlankPdf('handwritten-scan-placeholder.pdf');
