import { FORM_FIELD_TYPES, type FormFieldType } from '@enagar/forms';
import {
  validateImportProposalSchema,
  type FormImportFieldCandidate,
  type FormImportProposal,
  type FormImportSourceKind,
} from '@enagar/forms/form-import';

export const FORM_IMPORT_TABLE_REQUIRED_COLUMNS = ['field_id', 'label_en', 'type'] as const;

const fieldIdPattern = /^[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*$/;
const fieldTypeSet = new Set<string>(FORM_FIELD_TYPES);

export class FormImportTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormImportTableError';
  }
}

export interface FormImportTableParseOptions {
  sourceKind: FormImportSourceKind;
  sourceFilename: string;
  serviceCode: string;
  confidence: number;
  candidatePrefix: string;
  sourceHintPrefix: string;
}

export function isFormImportTableHeaderRow(headerRow: string[] | undefined): boolean {
  if (!headerRow?.length) {
    return false;
  }
  const header = normalizeHeaderRow(headerRow);
  return FORM_IMPORT_TABLE_REQUIRED_COLUMNS.every((column) => header.includes(column));
}

/** Header mentions field_id but is missing required table columns — fail as table mode, not layout. */
export function isPartialFormImportTableHeader(headerRow: string[] | undefined): boolean {
  if (!headerRow?.length || isFormImportTableHeaderRow(headerRow)) {
    return false;
  }
  return normalizeHeaderRow(headerRow).includes('field_id');
}

export function parseFormImportProposalFromTableRows(
  rows: string[][],
  options: FormImportTableParseOptions,
): FormImportProposal {
  if (rows.length < 2) {
    throw new FormImportTableError('Template must include a header row and at least one field');
  }

  const headerRow = rows[0];
  if (!headerRow) {
    throw new FormImportTableError('Template must include a header row');
  }
  const header = normalizeHeaderRow(headerRow);
  for (const column of FORM_IMPORT_TABLE_REQUIRED_COLUMNS) {
    if (!header.includes(column)) {
      throw new FormImportTableError(`Missing required column: ${column}`);
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
      throw new FormImportTableError(`Row ${index + 1}: field_id is required`);
    }
    if (!fieldIdPattern.test(fieldId)) {
      throw new FormImportTableError(`Row ${index + 1}: invalid field_id "${fieldId}"`);
    }
    if (seenIds.has(fieldId)) {
      throw new FormImportTableError(`Row ${index + 1}: duplicate field_id "${fieldId}"`);
    }
    seenIds.add(fieldId);

    const type = normalizeFieldType(record.type, index + 1);
    const labelEn = record.label_en?.trim();
    if (!labelEn) {
      throw new FormImportTableError(`Row ${index + 1}: label_en is required`);
    }

    const candidate: FormImportFieldCandidate = {
      candidate_id: `${options.candidatePrefix}-${index}`,
      field_id: fieldId,
      type,
      label: {
        en: labelEn,
        ...(record.label_bn?.trim() ? { bn: record.label_bn.trim() } : {}),
        ...(record.label_hi?.trim() ? { hi: record.label_hi.trim() } : {}),
      },
      required: parseBoolean(record.required),
      confidence: options.confidence,
      disposition: 'accepted',
      source_hint: `${options.sourceHintPrefix}:${index + 1}`,
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
    throw new FormImportTableError('Template did not contain any field rows');
  }

  const proposal: FormImportProposal = {
    source_kind: options.sourceKind,
    source_filename: options.sourceFilename,
    service_code: options.serviceCode,
    overall_confidence: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
    fields,
  };

  const validation = validateImportProposalSchema(proposal, {
    service_code: options.serviceCode,
    version: 1,
  });
  if (!validation.ok) {
    throw new FormImportTableError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
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
    throw new FormImportTableError(
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
    throw new FormImportTableError(
      `Row ${rowNumber}: options column is required for choice fields`,
    );
  }
  const parts = text
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new FormImportTableError(`Row ${rowNumber}: options column is empty`);
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
