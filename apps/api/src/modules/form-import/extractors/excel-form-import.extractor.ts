import {
  ExcelLayoutFormImportError,
  extractFormImportProposalFromExcelLayout,
  readExcelWorkbookSheet,
} from './excel-layout-form-import.extractor';
import {
  FormImportTableError,
  isFormImportTableHeaderRow,
  isPartialFormImportTableHeader,
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
    const sheet = readExcelWorkbookSheet(file.buffer);
    if (isFormImportTableHeaderRow(sheet.rows[0])) {
      const proposal = parseFormImportProposalFromTableRows(sheet.rows, {
        sourceKind: 'excel',
        sourceFilename: file.originalname,
        serviceCode,
        confidence: 0.95,
        candidatePrefix: 'excel',
        sourceHintPrefix: 'row',
      });
      return { ...proposal, extraction_mode: 'table' };
    }

    if (isPartialFormImportTableHeader(sheet.rows[0])) {
      parseFormImportProposalFromTableRows(sheet.rows, {
        sourceKind: 'excel',
        sourceFilename: file.originalname,
        serviceCode,
        confidence: 0.95,
        candidatePrefix: 'excel',
        sourceHintPrefix: 'row',
      });
    }

    return extractFormImportProposalFromExcelLayout(file, serviceCode, sheet);
  } catch (error) {
    if (error instanceof FormImportTableError || error instanceof ExcelLayoutFormImportError) {
      throw new ExcelFormImportError(error.message);
    }
    throw error;
  }
}
