import {
  FormImportTableError,
  parseFormImportProposalFromTableRows,
} from './form-import-table.parser';

import type { FormImportUploadedFile } from '../dto/form-import.dto';
import type { FormImportProposal } from '@enagar/forms/form-import';

export const EXCEL_IMPORT_REQUIRED_COLUMNS = ['field_id', 'label_en', 'type'] as const;

export const EXCEL_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

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

  try {
    const rows = parseWorkbookRows(file.buffer);
    return parseFormImportProposalFromTableRows(rows, {
      sourceKind: 'excel',
      sourceFilename: file.originalname,
      serviceCode,
      confidence: 0.95,
      candidatePrefix: 'excel',
      sourceHintPrefix: 'row',
    });
  } catch (error) {
    if (error instanceof FormImportTableError) {
      throw new ExcelFormImportError(error.message);
    }
    throw error;
  }
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
