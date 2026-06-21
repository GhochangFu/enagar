import {
  completeLocaleMap,
  validateFormSchema,
  type EnagarFormField,
  type EnagarFormSchema,
  type FormOption,
  type FormValidationResult,
} from '../index.js';

import { FORM_IMPORT_POLICY } from './policy.js';

import type {
  FormImportApplyability,
  FormImportFieldCandidate,
  FormImportProposal,
  ImportProposalToSchemaContext,
  ImportProposalToSchemaOptions,
} from './types.js';

const defaultFileAccept = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const defaultFileMaxMb = 5;

export function isAcceptedImportCandidate(candidate: FormImportFieldCandidate): boolean {
  return candidate.disposition !== 'rejected';
}

export function computeOverallImportConfidence(
  fields: FormImportFieldCandidate[],
  acceptedOnly = true,
): number {
  const pool = acceptedOnly ? fields.filter(isAcceptedImportCandidate) : fields;
  if (pool.length === 0) {
    return 0;
  }
  const total = pool.reduce((sum, field) => sum + field.confidence, 0);
  return total / pool.length;
}

export function assessImportProposalApplyability(
  proposal: FormImportProposal,
  policy = FORM_IMPORT_POLICY,
): FormImportApplyability {
  if (proposal.rejection_reason?.trim()) {
    return { ok: false, reasons: [proposal.rejection_reason.trim()] };
  }

  const reasons: string[] = [];

  const overall = computeOverallImportConfidence(proposal.fields);
  if (overall < policy.min_overall_confidence) {
    reasons.push(
      `Overall confidence ${overall.toFixed(2)} is below ${policy.min_overall_confidence}`,
    );
  }

  for (const field of proposal.fields.filter(isAcceptedImportCandidate)) {
    if (field.confidence < policy.min_accepted_field_confidence) {
      reasons.push(
        `Field "${field.field_id}" confidence ${field.confidence.toFixed(2)} is below ${policy.min_accepted_field_confidence}`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function importCandidateToFormField(candidate: FormImportFieldCandidate): EnagarFormField {
  const label = completeLocaleMap(candidate.label, candidate.field_id);
  const help_text = candidate.help_text ? completeLocaleMap(candidate.help_text, '') : undefined;

  const base = {
    id: candidate.field_id,
    label,
    help_text,
    required: candidate.required === true,
  };

  switch (candidate.type) {
    case 'text':
    case 'textarea':
      return {
        ...base,
        type: candidate.type,
        min_length: candidate.min_length,
        max_length: candidate.max_length,
        pattern: candidate.pattern,
      };
    case 'number':
      return {
        ...base,
        type: 'number',
        min: candidate.min,
        max: candidate.max,
      };
    case 'date':
      return {
        ...base,
        type: 'date',
        min_date: candidate.min_date,
        max_date: candidate.max_date,
      };
    case 'radio':
    case 'select':
    case 'multiselect':
      return {
        ...base,
        type: candidate.type,
        options: toFormOptions(candidate),
      };
    case 'file':
      return {
        ...base,
        type: 'file',
        accept: candidate.accept?.length ? candidate.accept : [...defaultFileAccept],
        max_size_mb: candidate.max_size_mb ?? defaultFileMaxMb,
        multiple: candidate.multiple === true,
      };
    case 'section':
      return {
        ...base,
        type: 'section',
      };
  }
}

export function importProposalToFormSchema(
  proposal: FormImportProposal,
  context: ImportProposalToSchemaContext,
  options: ImportProposalToSchemaOptions = {},
): EnagarFormSchema {
  const acceptedOnly = options.acceptedOnly !== false;
  const fields = proposal.fields
    .filter((candidate) => (acceptedOnly ? isAcceptedImportCandidate(candidate) : true))
    .map(importCandidateToFormField);

  return {
    schema_version: 1,
    service_code: context.service_code,
    version: context.version,
    title: completeLocaleMap(context.title ?? {}, `${context.service_code} form`),
    description: context.description ? completeLocaleMap(context.description, '') : undefined,
    fields,
  };
}

export function validateImportProposalSchema(
  proposal: FormImportProposal,
  context: ImportProposalToSchemaContext,
): FormValidationResult {
  return validateFormSchema(importProposalToFormSchema(proposal, context));
}

/** Replace draft fields with accepted import candidates; preserve title/description/rules (ADR-0014). */
export function applyImportProposalToDraft(
  existing: EnagarFormSchema,
  proposal: FormImportProposal,
): EnagarFormSchema {
  const imported = importProposalToFormSchema(proposal, {
    service_code: existing.service_code,
    version: existing.version,
    title: existing.title,
    description: existing.description,
  });
  return {
    ...existing,
    fields: imported.fields,
  };
}

function toFormOptions(candidate: FormImportFieldCandidate): FormOption[] {
  if (!candidate.options?.length) {
    return [
      {
        value: 'option_1',
        label: completeLocaleMap({}, 'Option 1'),
      },
    ];
  }

  return candidate.options.map((option) => ({
    value: option.value,
    label: completeLocaleMap(option.label, option.value),
  }));
}
