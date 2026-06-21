import {
  assessImportProposalApplyability,
  importProposalToFormSchema,
  type FormImportProposal,
  type FormImportSourceKind,
} from '@enagar/forms/form-import';

import {
  ExcelFormImportError,
  extractFormImportProposalFromExcel,
  isExcelUpload,
} from './extractors/excel-form-import.extractor';
import {
  PdfFormImportError,
  extractFormImportProposalFromPdf,
  isPdfUpload,
} from './extractors/pdf-form-import.extractor';
import {
  WordFormImportError,
  extractFormImportProposalFromWord,
  isWordUpload,
} from './extractors/word-form-import.extractor';

import type { FormImportUploadedFile } from './dto/form-import.dto';

export type FormImportExtractionResult = {
  proposal: FormImportProposal;
  sourceKind: FormImportSourceKind;
};

export type FormImportCompletionResult = {
  status: 'completed' | 'rejected';
  proposal: FormImportProposal;
  proposed_schema: ReturnType<typeof importProposalToFormSchema>;
  sourceKind: FormImportSourceKind;
  overallConfidence: number;
  rejectionReason?: string;
};

export async function extractFormImportFromUpload(
  file: FormImportUploadedFile,
  serviceCode: string,
): Promise<FormImportExtractionResult> {
  if (isExcelUpload(file)) {
    return {
      proposal: extractFormImportProposalFromExcel(file, serviceCode),
      sourceKind: 'excel',
    };
  }
  if (isWordUpload(file)) {
    return {
      proposal: await extractFormImportProposalFromWord(file, serviceCode),
      sourceKind: 'word',
    };
  }
  if (isPdfUpload(file)) {
    const proposal = await extractFormImportProposalFromPdf(file, serviceCode);
    return {
      proposal,
      sourceKind: proposal.source_kind ?? 'pdf_digital',
    };
  }
  throw new UnsupportedFormImportFormatError(
    'Supported formats: Excel (.xlsx), Word (.docx), and PDF (.pdf)',
  );
}

export function completeFormImportFromProposal(
  proposal: FormImportProposal,
  sourceKind: FormImportSourceKind,
  serviceCode: string,
): FormImportCompletionResult {
  const applyability = assessImportProposalApplyability(proposal);
  const proposed_schema = importProposalToFormSchema(proposal, {
    service_code: serviceCode,
    version: 1,
  });

  return {
    status: applyability.ok ? 'completed' : 'rejected',
    proposal,
    proposed_schema,
    sourceKind,
    overallConfidence: proposal.overall_confidence,
    rejectionReason: applyability.ok ? undefined : applyability.reasons.join('; '),
  };
}

export function isFormImportExtractionError(
  error: unknown,
): error is ExcelFormImportError | WordFormImportError | PdfFormImportError {
  return (
    error instanceof ExcelFormImportError ||
    error instanceof WordFormImportError ||
    error instanceof PdfFormImportError
  );
}

export class UnsupportedFormImportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormImportFormatError';
  }
}
