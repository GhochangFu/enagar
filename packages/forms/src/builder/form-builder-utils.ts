import { describeShowIf } from './validation-presets';

import type {
  EnagarFormField,
  EnagarFormSchema,
  FormFieldType,
  FormOption,
  LocaleMap,
} from '../index';

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function localeMap(en: string, bn = en, hi = en): LocaleMap {
  return { en, bn, hi };
}

export function defaultOptions(): FormOption[] {
  return [
    { value: 'yes', label: localeMap('Yes') },
    { value: 'no', label: localeMap('No') },
  ];
}

export function pickLocaleText(label: LocaleMap | undefined): string {
  return label?.en || 'Untitled';
}

export function slugify(input: string, fallback: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function nextSequence(fields: EnagarFormField[], type: FormFieldType): number {
  const prefix = type.replace(/[^a-z0-9]+/g, '_');
  let sequence = fields.length + 1;
  while (
    fields.some(
      (field) => field.id === `${prefix}_${sequence}` || field.id === `${prefix}-${sequence}`,
    )
  ) {
    sequence += 1;
  }
  return sequence;
}

export function isChoiceField(
  field: EnagarFormField,
): field is Extract<EnagarFormField, { options: FormOption[] }> {
  return field.type === 'radio' || field.type === 'select' || field.type === 'multiselect';
}

export function isMultiselectField(field: EnagarFormField | undefined): boolean {
  return field?.type === 'multiselect';
}

export function fieldSummary(field: EnagarFormField): string {
  const parts: string[] = [];
  if (field.type === 'section') {
    return 'Layout section';
  }
  if (field.required) {
    parts.push('required');
  }
  if (field.show_if) {
    parts.push(`show if ${describeShowIf(field.show_if)}`);
  }
  if (field.type === 'text' || field.type === 'textarea') {
    if (field.pattern) {
      parts.push('pattern');
    }
    if (field.min_length !== undefined || field.max_length !== undefined) {
      parts.push(`len ${field.min_length ?? '…'}-${field.max_length ?? '…'}`);
    }
  }
  if (field.type === 'number') {
    if (field.min !== undefined || field.max !== undefined) {
      parts.push(`range ${field.min ?? '…'}-${field.max ?? '…'}`);
    }
  }
  if (field.type === 'date') {
    if (field.min_date || field.max_date) {
      parts.push(`dates ${field.min_date ?? '…'}–${field.max_date ?? '…'}`);
    }
  }
  if (isChoiceField(field)) {
    parts.push(`${field.options.length} options`);
  }
  if (field.type === 'file') {
    parts.push(`${field.accept.join(', ')} · max ${field.max_size_mb} MB`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Optional input';
}

export function cloneFormSchema(schema: EnagarFormSchema): EnagarFormSchema {
  return JSON.parse(JSON.stringify(schema)) as EnagarFormSchema;
}
