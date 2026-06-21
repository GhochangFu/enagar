import { validateImportProposalSchema, type FormImportProposal } from '@enagar/forms/form-import';

import { inferFieldsFromLayoutLines, splitPdfTextIntoLines } from './form-import-layout-heuristics';

import type { FormImportUploadedFile } from '../dto/form-import.dto';

export class PdfDigitalTextImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfDigitalTextImportError';
  }
}

export async function extractDigitalTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text?: string }>;
  // pdf-parse/pdf.js rejects some Buffer views under ts-node; copy before parsing.
  const pdfData = Buffer.from(buffer);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = await pdfParse(pdfData);
      const text = (parsed.text ?? '').trim();
      if (text.length > 0) {
        return text;
      }
    } catch {
      // pdf.js occasionally fails on the first parse in dev — retry once.
    }
  }

  return '';
}

export function extractDigitalTextProposal(
  file: FormImportUploadedFile,
  serviceCode: string,
  text: string,
): FormImportProposal | null {
  const lines = splitPdfTextIntoLines(text);
  const fields = inferFieldsFromLayoutLines(lines, {
    sourceKind: 'pdf_digital',
    sourceFilename: file.originalname,
    serviceCode,
    candidatePrefix: 'pdf-digital',
    maxConfidence: 0.78,
  });

  if (fields.length === 0) {
    return null;
  }

  const proposal: FormImportProposal = {
    source_kind: 'pdf_digital',
    source_filename: file.originalname,
    service_code: serviceCode,
    overall_confidence: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
    fields,
    warnings: ['Detected from digital PDF text — review inferred field types (EN-40).'],
  };

  const validation = validateImportProposalSchema(proposal, {
    service_code: serviceCode,
    version: 1,
  });
  if (!validation.ok) {
    throw new PdfDigitalTextImportError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
}

export const PDF_DIGITAL_TEXT_MIN_CHARS = 40;
