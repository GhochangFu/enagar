import {
  buildHandwrittenRejectionProposal,
  extractAcroFormProposal,
  PdfAcroFormImportError,
} from './pdf-acroform.extractor';
import {
  extractDigitalTextFromPdf,
  extractDigitalTextProposal,
  PDF_DIGITAL_TEXT_MIN_CHARS,
  PdfDigitalTextImportError,
} from './pdf-digital-text.extractor';
import {
  extractOcrProposal,
  extractOcrTextFromPdf,
  isHandwrittenLikely,
  PdfOcrImportError,
  shouldAttemptOcr,
} from './pdf-ocr.extractor';

import type { FormImportUploadedFile } from '../dto/form-import.dto';
import type { FormImportProposal } from '@enagar/forms/form-import';

export const PDF_IMPORT_MIME_TYPES = new Set(['application/pdf', 'application/octet-stream']);

export class PdfFormImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfFormImportError';
  }
}

export function isPdfUpload(file: FormImportUploadedFile): boolean {
  const lower = file.originalname.toLowerCase();
  return lower.endsWith('.pdf') || PDF_IMPORT_MIME_TYPES.has(file.mimetype.toLowerCase());
}

export async function extractFormImportProposalFromPdf(
  file: FormImportUploadedFile,
  serviceCode: string,
): Promise<FormImportProposal> {
  if (!isPdfUpload(file)) {
    throw new PdfFormImportError('Upload must be a PDF (.pdf)');
  }

  try {
    const acroform = await extractAcroFormProposal(file, serviceCode);
    if (acroform) {
      return acroform;
    }

    const digitalText = await extractDigitalTextFromPdf(file.buffer);
    if (digitalText.length >= PDF_DIGITAL_TEXT_MIN_CHARS) {
      const digitalProposal = extractDigitalTextProposal(file, serviceCode, digitalText);
      if (digitalProposal) {
        return digitalProposal;
      }
    }

    let ocrText = '';
    let ocrConfidence = 0;
    if (shouldAttemptOcr(digitalText.length)) {
      const ocr = await extractOcrTextFromPdf(file.buffer);
      ocrText = ocr.text;
      ocrConfidence = ocr.confidence;
      const ocrProposal = extractOcrProposal(file, serviceCode, ocrText, ocrConfidence);
      if (ocrProposal) {
        return ocrProposal;
      }
    }

    if (
      isHandwrittenLikely({
        digitalTextLength: digitalText.length,
        ocrTextLength: ocrText.length,
        ocrConfidence,
      })
    ) {
      return buildHandwrittenRejectionProposal(file, serviceCode);
    }

    throw new PdfFormImportError(
      'PDF did not contain AcroForm fields or recognizable typed form labels',
    );
  } catch (error) {
    if (
      error instanceof PdfAcroFormImportError ||
      error instanceof PdfDigitalTextImportError ||
      error instanceof PdfOcrImportError
    ) {
      throw new PdfFormImportError(error.message);
    }
    throw error;
  }
}
