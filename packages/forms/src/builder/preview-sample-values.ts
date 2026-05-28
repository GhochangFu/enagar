import { isChoiceField, pickLocaleText } from './form-builder-utils';

import type { EnagarFormField, EnagarFormSchema, FormSubmission } from '../index';

export type PreviewSamplePreset = 'empty' | 'first-options' | 'show-if-smoke';

export function buildPreviewSampleValues(
  schema: EnagarFormSchema,
  preset: PreviewSamplePreset,
): FormSubmission {
  if (preset === 'empty') {
    return {};
  }

  const values: FormSubmission = {};
  for (const field of schema.fields) {
    assignPreviewValue(
      field,
      values,
      preset === 'first-options' ? 'first-options' : 'show-if-smoke',
    );
  }

  if (preset === 'show-if-smoke') {
    applyShowIfSmokeValues(schema, values);
  }

  return values;
}

function assignPreviewValue(
  field: EnagarFormField,
  values: FormSubmission,
  mode: 'first-options' | 'show-if-smoke',
): void {
  if (field.type === 'section') {
    return;
  }
  if (field.type === 'text' || field.type === 'textarea') {
    values[field.id] =
      mode === 'first-options'
        ? pickLocaleText(field.label).slice(0, 24) || 'Sample text'
        : 'Preview text';
    return;
  }
  if (field.type === 'number') {
    values[field.id] = field.min ?? 1;
    return;
  }
  if (field.type === 'date') {
    values[field.id] = field.min_date ?? '2026-06-01';
    return;
  }
  if (isChoiceField(field)) {
    const first = field.options[0]?.value ?? 'option';
    values[field.id] = field.type === 'multiselect' ? [first] : first;
    return;
  }
  if (field.type === 'file') {
    values[field.id] = {
      name: 'preview.pdf',
      mime_type: field.accept[0] ?? 'application/pdf',
      size_mb: 1,
    };
  }
}

function applyShowIfSmokeValues(schema: EnagarFormSchema, values: FormSubmission): void {
  for (const field of schema.fields) {
    const rule = field.show_if;
    if (!rule) {
      continue;
    }
    const controlling = schema.fields.find((candidate) => candidate.id === rule.field);
    if (rule.not_empty) {
      if (controlling?.type === 'number') {
        values[rule.field] = 1;
      } else if (controlling && isChoiceField(controlling)) {
        values[rule.field] =
          controlling.type === 'multiselect'
            ? [controlling.options[0]?.value ?? 'option']
            : (controlling.options[0]?.value ?? 'option');
      } else {
        values[rule.field] = 'preview';
      }
      continue;
    }
    if (rule.includes !== undefined) {
      values[rule.field] = [rule.includes];
      continue;
    }
    if (rule.equals_any !== undefined && rule.equals_any.length > 0) {
      values[rule.field] = rule.equals_any[0];
      continue;
    }
    if (rule.equals !== undefined) {
      values[rule.field] = rule.equals;
    }
  }
}
