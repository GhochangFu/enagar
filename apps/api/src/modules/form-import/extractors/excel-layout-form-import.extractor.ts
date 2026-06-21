import {
  validateImportProposalSchema,
  type FormImportExtractionMode,
  type FormImportProposal,
} from '@enagar/forms/form-import';

import { inferFieldsFromLayoutLines } from './form-import-layout-heuristics';

import type { FormImportUploadedFile } from '../dto/form-import.dto';

export class ExcelLayoutFormImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcelLayoutFormImportError';
  }
}

export const EXCEL_LAYOUT_MAX_FIELD_CONFIDENCE = 0.8;

export interface ExcelWorkbookSheet {
  rows: string[][];
  mergeTitleRowIndexes: Set<number>;
}

export function readExcelWorkbookSheet(buffer: Buffer): ExcelWorkbookSheet {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ExcelLayoutFormImportError('Excel workbook has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ExcelLayoutFormImportError('Excel workbook sheet could not be read');
  }

  const rows = (
    XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as string[][]
  ).map((row) => row.map((cell) => String(cell ?? '').trim()));

  const mergeTitleRowIndexes = new Set<number>();
  for (const merge of sheet['!merges'] ?? []) {
    if (merge.s.c === 0 && merge.e.c > merge.s.c) {
      mergeTitleRowIndexes.add(merge.s.r);
    }
  }

  return { rows, mergeTitleRowIndexes };
}

export function extractFormImportProposalFromExcelLayout(
  file: FormImportUploadedFile,
  serviceCode: string,
  sheet: ExcelWorkbookSheet,
): FormImportProposal {
  const lines = sheetRowsToLayoutLines(sheet);
  if (lines.length === 0) {
    throw new ExcelLayoutFormImportError(
      'Excel layout sheet did not contain recognizable form fields',
    );
  }

  const fields = inferFieldsFromLayoutLines(lines, {
    sourceKind: 'pdf_digital',
    sourceFilename: file.originalname,
    serviceCode,
    candidatePrefix: 'excel-layout',
    maxConfidence: EXCEL_LAYOUT_MAX_FIELD_CONFIDENCE,
  }).map((field) => ({
    ...field,
    source_hint: field.source_hint?.replace(/^line:/, 'row:') ?? field.source_hint,
  }));

  if (fields.length === 0) {
    throw new ExcelLayoutFormImportError(
      'Excel layout sheet did not contain recognizable form fields',
    );
  }

  const proposal: FormImportProposal = {
    source_kind: 'excel',
    source_filename: file.originalname,
    service_code: serviceCode,
    extraction_mode: 'layout' satisfies FormImportExtractionMode,
    overall_confidence: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
    fields,
    warnings: ['Detected Excel form layout — check field types before Apply (EN-50).'],
  };

  const validation = validateImportProposalSchema(proposal, {
    service_code: serviceCode,
    version: 1,
  });
  if (!validation.ok) {
    throw new ExcelLayoutFormImportError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
}

function sheetRowsToLayoutLines(sheet: ExcelWorkbookSheet): string[] {
  const lines: string[] = [];

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
    if (sheet.mergeTitleRowIndexes.has(rowIndex)) {
      continue;
    }

    const row = sheet.rows[rowIndex] ?? [];
    const labelCell = row[0]?.trim() ?? '';
    const inputCell = row[1]?.trim() ?? '';
    if (!labelCell && !inputCell) {
      continue;
    }

    if (inputCell && /[☐☑]/.test(inputCell)) {
      const label = labelCell.replace(/:$/, '').trim();
      const options = inputCell.replace(/☐/g, '[ ]').replace(/☑/g, '[x]');
      lines.push(`${label}: ${options}`);
      continue;
    }

    if (/:\s*$/.test(labelCell) && !inputCell) {
      lines.push(`${labelCell} ____________________`);
      continue;
    }

    if (!labelCell.includes(':') && !inputCell && labelCell.length >= 4 && labelCell.length <= 64) {
      lines.push(labelCell.toUpperCase());
      continue;
    }

    if (labelCell.includes(':') && inputCell) {
      lines.push(`${labelCell} ${inputCell}`);
    }
  }

  return lines;
}
