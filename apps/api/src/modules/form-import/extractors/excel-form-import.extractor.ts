import { FORM_FIELD_TYPES, type FormFieldType } from '@enagar/forms';
import {
  validateImportProposalSchema,
  type FormImportFieldCandidate,
  type FormImportProposal,
} from '@enagar/forms/form-import';

import type { FormImportUploadedFile } from '../dto/form-import.dto';

export const EXCEL_IMPORT_REQUIRED_COLUMNS = ['field_id', 'label_en', 'type'] as const;

export const EXCEL_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

const fieldIdPattern = /^[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*$/;
const fieldTypeSet = new Set<string>(FORM_FIELD_TYPES);

export class ExcelFormImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcelFormImportError';
  }
}

export function isExcelUpload(file: FormImportUploadedFile): boolean {
  const lower = file.originalname.toLowerCase();
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    EXCEL_IMPORT_MIME_TYPES.has(file.mimetype.toLowerCase())
  );
}

export function extractFormImportProposalFromExcel(
  file: FormImportUploadedFile,
  serviceCode: string,
): FormImportProposal {
  if (!isExcelUpload(file)) {
    throw new ExcelFormImportError('Upload must be an Excel workbook (.xlsx)');
  }

  const rows = parseWorkbookRows(file.buffer);
  if (rows.length < 2) {
    throw new ExcelFormImportError(
      'Excel template must include a header row and at least one field',
    );
  }

  const headerRow = rows[0];
  if (!headerRow) {
    throw new ExcelFormImportError('Excel template must include a header row');
  }
  const header = normalizeHeaderRow(headerRow);
  for (const column of EXCEL_IMPORT_REQUIRED_COLUMNS) {
    if (!header.includes(column)) {
      throw new ExcelFormImportError(`Missing required column: ${column}`);
    }
  }

  const fields: FormImportFieldCandidate[] = [];
  const seenIds = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    if (row.every((cell) => cell.trim() === '')) {
      continue;
    }
    const record = rowToRecord(header, row);
    const fieldId = record.field_id?.trim() ?? '';
    if (!fieldId) {
      throw new ExcelFormImportError(`Row ${index + 1}: field_id is required`);
    }
    if (!fieldIdPattern.test(fieldId)) {
      throw new ExcelFormImportError(`Row ${index + 1}: invalid field_id "${fieldId}"`);
    }
    if (seenIds.has(fieldId)) {
      throw new ExcelFormImportError(`Row ${index + 1}: duplicate field_id "${fieldId}"`);
    }
    seenIds.add(fieldId);

    const type = normalizeFieldType(record.type, index + 1);
    const labelEn = record.label_en?.trim();
    if (!labelEn) {
      throw new ExcelFormImportError(`Row ${index + 1}: label_en is required`);
    }

    const candidate: FormImportFieldCandidate = {
      candidate_id: `excel-${index}`,
      field_id: fieldId,
      type,
      label: {
        en: labelEn,
        ...(record.label_bn?.trim() ? { bn: record.label_bn.trim() } : {}),
        ...(record.label_hi?.trim() ? { hi: record.label_hi.trim() } : {}),
      },
      required: parseBoolean(record.required),
      confidence: 0.95,
      disposition: 'accepted',
      source_hint: `row:${index + 1}`,
    };

    if (record.help_en?.trim()) {
      candidate.help_text = { en: record.help_en.trim() };
    }

    if (isChoiceType(type)) {
      candidate.options = parseOptions(record.options, index + 1);
    }

    fields.push(candidate);
  }

  if (fields.length === 0) {
    throw new ExcelFormImportError('Excel template did not contain any field rows');
  }

  const proposal: FormImportProposal = {
    source_kind: 'excel',
    source_filename: file.originalname,
    service_code: serviceCode,
    overall_confidence: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
    fields,
  };

  const validation = validateImportProposalSchema(proposal, {
    service_code: serviceCode,
    version: 1,
  });
  if (!validation.ok) {
    throw new ExcelFormImportError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
}

function parseWorkbookRows(buffer: Buffer): string[][] {
  // Lazy require keeps jest mocking straightforward and avoids ESM friction in Nest build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ExcelFormImportError('Excel workbook has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ExcelFormImportError('Excel workbook sheet could not be read');
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as string[][];
  return rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

function normalizeHeaderRow(row: string[]): string[] {
  return row.map((cell) => cell.trim().toLowerCase());
}

function rowToRecord(header: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < header.length; index += 1) {
    const key = header[index];
    if (!key) {
      continue;
    }
    record[key] = row[index] ?? '';
  }
  return record;
}

function normalizeFieldType(raw: string | undefined, rowNumber: number): FormFieldType {
  const type = raw?.trim().toLowerCase() ?? '';
  if (!fieldTypeSet.has(type)) {
    throw new ExcelFormImportError(
      `Row ${rowNumber}: unsupported type "${raw ?? ''}" (allowed: ${FORM_FIELD_TYPES.join(', ')})`,
    );
  }
  return type as FormFieldType;
}

function parseBoolean(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase() ?? '';
  return value === 'true' || value === 'yes' || value === '1' || value === 'y';
}

function isChoiceType(type: FormFieldType): boolean {
  return type === 'radio' || type === 'select' || type === 'multiselect';
}

function parseOptions(
  raw: string | undefined,
  rowNumber: number,
): FormImportFieldCandidate['options'] {
  const text = raw?.trim();
  if (!text) {
    throw new ExcelFormImportError(
      `Row ${rowNumber}: options column is required for choice fields`,
    );
  }
  const parts = text
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new ExcelFormImportError(`Row ${rowNumber}: options column is empty`);
  }
  return parts.map((part, index) => {
    const colon = part.indexOf(':');
    if (colon > 0) {
      const value = part.slice(0, colon).trim();
      const label = part.slice(colon + 1).trim() || value;
      return { value, label: { en: label } };
    }
    const slug =
      part
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `opt_${index + 1}`;
    return { value: slug, label: { en: part } };
  });
}
