import { FORM_IMPORT_POLICY } from '@enagar/forms/form-import';
import { validateImportProposalSchema, type FormImportProposal } from '@enagar/forms/form-import';

import { slugifyFieldId } from './form-import-layout-heuristics';

import type { FormImportUploadedFile } from '../dto/form-import.dto';

export class PdfAcroFormImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfAcroFormImportError';
  }
}

export async function extractAcroFormProposal(
  file: FormImportUploadedFile,
  serviceCode: string,
): Promise<FormImportProposal | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFDocument, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFTextField } =
    require('pdf-lib') as typeof import('pdf-lib');

  const pdfDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();
  if (pdfFields.length === 0) {
    return null;
  }

  const fields = pdfFields
    .map((field, index) => {
      const rawName = field.getName();
      const fieldId = slugifyFieldId(rawName);
      const label = humanizeFieldName(rawName);
      const base = {
        candidate_id: `pdf-acro-${index + 1}`,
        field_id: fieldId,
        label: { en: label },
        confidence: 0.88,
        disposition: 'accepted' as const,
        source_hint: `acro:${rawName}`,
      };

      if (field instanceof PDFTextField) {
        return {
          ...base,
          type: field.isMultiline() ? ('textarea' as const) : ('text' as const),
        };
      }
      if (field instanceof PDFDropdown) {
        const options = field.getOptions().map((option) => ({
          value: slugifyFieldId(option),
          label: { en: option },
        }));
        return {
          ...base,
          type: 'select' as const,
          options,
        };
      }
      if (field instanceof PDFRadioGroup) {
        const options = field.getOptions().map((option) => ({
          value: slugifyFieldId(option),
          label: { en: option },
        }));
        return {
          ...base,
          type: 'radio' as const,
          options,
        };
      }
      if (field instanceof PDFCheckBox) {
        return {
          ...base,
          type: 'radio' as const,
          options: [
            { value: 'yes', label: { en: 'Yes' } },
            { value: 'no', label: { en: 'No' } },
          ],
        };
      }
      return {
        ...base,
        type: 'text' as const,
      };
    })
    .filter(Boolean);

  if (fields.length === 0) {
    return null;
  }

  const proposal: FormImportProposal = {
    source_kind: 'pdf_acroform',
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
    throw new PdfAcroFormImportError(
      validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
    );
  }

  return proposal;
}

function humanizeFieldName(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function buildHandwrittenRejectionProposal(
  file: FormImportUploadedFile,
  serviceCode: string,
): FormImportProposal {
  return {
    source_kind: 'pdf_ocr',
    source_filename: file.originalname,
    service_code: serviceCode,
    overall_confidence: 0,
    fields: [],
    rejection_reason: FORM_IMPORT_POLICY.handwritten_rejection_message,
    warnings: ['Handwritten or unstructured PDF detected (EN-41).'],
  };
}
