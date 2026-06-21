import { validateImportProposalSchema, type FormImportProposal } from '@enagar/forms/form-import';

import { inferFieldsFromLayoutLines, splitPdfTextIntoLines } from './form-import-layout-heuristics';
import { PDF_DIGITAL_TEXT_MIN_CHARS } from './pdf-digital-text.extractor';

import type { FormImportUploadedFile } from '../dto/form-import.dto';

export class PdfOcrImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfOcrImportError';
  }
}

export const PDF_OCR_MIN_CONFIDENCE = 0.35;
export const PDF_OCR_FIELD_MAX_CONFIDENCE = 0.72;

export async function extractOcrTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pdfToPng } = require('pdf-to-png-converter') as {
      pdfToPng: (
        input: Buffer,
        options?: { pagesToProcess?: number[]; disableFontFace?: boolean },
      ) => Promise<Array<{ content: Buffer }>>;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Tesseract = require('tesseract.js') as typeof import('tesseract.js');

    const pages = await pdfToPng(buffer, { pagesToProcess: [1], disableFontFace: true });
    const firstPage = pages[0]?.content;
    if (!firstPage?.length) {
      return { text: '', confidence: 0 };
    }

    const result = await Tesseract.recognize(firstPage, 'eng');
    const confidence = (result.data.confidence ?? 0) / 100;
    return {
      text: (result.data.text ?? '').trim(),
      confidence,
    };
  } catch {
    return { text: '', confidence: 0 };
  }
}

export function extractOcrProposal(
  file: FormImportUploadedFile,
  serviceCode: string,
  text: string,
  ocrConfidence: number,
): FormImportProposal | null {
  if (ocrConfidence < PDF_OCR_MIN_CONFIDENCE) {
    return null;
  }

  const lines = splitPdfTextIntoLines(text);
  const fields = inferFieldsFromLayoutLines(lines, {
    sourceKind: 'pdf_ocr',
    sourceFilename: file.originalname,
    serviceCode,
    candidatePrefix: 'pdf-ocr',
    maxConfidence: PDF_OCR_FIELD_MAX_CONFIDENCE,
  }).map((field) => ({
    ...field,
    confidence: Math.min(field.confidence, ocrConfidence, PDF_OCR_FIELD_MAX_CONFIDENCE),
  }));

  if (fields.length === 0) {
    return null;
  }

  const proposal: FormImportProposal = {
    source_kind: 'pdf_ocr',
    source_filename: file.originalname,
    service_code: serviceCode,
    overall_confidence: fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
    fields,
    warnings: ['Extracted via basic OCR — review carefully before Apply (EN-42).'],
  };

  const validation = validateImportProposalSchema(proposal, {
    service_code: serviceCode,
    version: 1,
  });
  if (!validation.ok) {
    throw new PdfOcrImportError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
}

export function isHandwrittenLikely(input: {
  digitalTextLength: number;
  ocrTextLength: number;
  ocrConfidence: number;
}): boolean {
  const totalText = Math.max(input.digitalTextLength, input.ocrTextLength);
  if (totalText >= PDF_DIGITAL_TEXT_MIN_CHARS) {
    return false;
  }
  return input.ocrConfidence < PDF_OCR_MIN_CONFIDENCE;
}

export { PDF_DIGITAL_TEXT_MIN_CHARS };

export function shouldAttemptOcr(digitalTextLength: number): boolean {
  return digitalTextLength < PDF_DIGITAL_TEXT_MIN_CHARS;
}
