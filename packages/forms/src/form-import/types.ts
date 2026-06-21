import type { EnagarFormField, EnagarFormSchema, FormFieldType, LocaleMap } from '../index.js';

export const FORM_IMPORT_SOURCE_KINDS = [
  'excel',
  'word',
  'pdf_acroform',
  'pdf_digital',
  'pdf_ocr',
] as const;

export type FormImportSourceKind = (typeof FORM_IMPORT_SOURCE_KINDS)[number];

export const FORM_IMPORT_JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected',
] as const;

export type FormImportJobStatus = (typeof FORM_IMPORT_JOB_STATUSES)[number];

export const FORM_IMPORT_FIELD_DISPOSITIONS = ['accepted', 'rejected', 'needs_manual_fix'] as const;

export type FormImportFieldDisposition = (typeof FORM_IMPORT_FIELD_DISPOSITIONS)[number];

export const FORM_IMPORT_SCOPES = ['tenant', 'state'] as const;

export type FormImportScope = (typeof FORM_IMPORT_SCOPES)[number];

export interface FormImportChoiceOptionCandidate {
  value: string;
  label: Partial<LocaleMap>;
}

export interface FormImportFieldCandidate {
  candidate_id: string;
  field_id: string;
  type: FormFieldType;
  label: Partial<LocaleMap>;
  help_text?: Partial<LocaleMap>;
  required?: boolean;
  options?: FormImportChoiceOptionCandidate[];
  accept?: string[];
  max_size_mb?: number;
  multiple?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  min?: number;
  max?: number;
  min_date?: string;
  max_date?: string;
  confidence: number;
  disposition?: FormImportFieldDisposition;
  source_hint?: string;
}

export interface FormImportProposal {
  source_kind: FormImportSourceKind;
  source_filename: string;
  service_code: string;
  overall_confidence: number;
  fields: FormImportFieldCandidate[];
  warnings?: string[];
  rejection_reason?: string;
}

export interface FormImportApplyability {
  ok: boolean;
  reasons: string[];
}

export interface FormImportJobRecord {
  job_id: string;
  scope: FormImportScope;
  service_code: string;
  service_id?: string;
  status: FormImportJobStatus;
  source_filename: string;
  source_kind?: FormImportSourceKind;
  source_storage_key?: string;
  overall_confidence?: number;
  proposal?: FormImportProposal;
  proposed_schema?: EnagarFormSchema;
  rejection_reason?: string;
  source_preview?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportProposalToSchemaContext {
  service_code: string;
  version: number;
  title?: Partial<LocaleMap>;
  description?: Partial<LocaleMap>;
}

export interface ImportProposalToSchemaOptions {
  /** When true (default), only candidates with disposition !== 'rejected' are mapped. */
  acceptedOnly?: boolean;
}

export type MappedImportField = EnagarFormField;
