import {
  completeLocaleMap,
  FORM_FIELD_TYPES,
  type EnagarFormField,
  type LocaleMap,
  FormFieldType,
} from '@enagar/forms';

const FIELD_TYPE_ALIASES: Record<string, FormFieldType> = {
  text: 'text',
  string: 'text',
  textarea: 'textarea',
  number: 'number',
  date: 'date',
  radio: 'radio',
  select: 'select',
  multiselect: 'multiselect',
  file: 'file',
  section: 'section',
};

export type NormalizedFieldInsert = {
  field: EnagarFormField;
  insertAfterId?: string;
};

const VALIDATION_PRESETS: Record<string, string> = {
  email: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
  phone: '^[6-9][0-9]{9}$',
  mobile: '^[6-9][0-9]{9}$',
  indian_mobile: '^[6-9][0-9]{9}$',
};

function inferValidationPreset(label: string, id: string): string | undefined {
  const hay = `${label} ${id}`.toLowerCase();
  if (hay.includes('email') || hay.includes('e-mail')) {
    return VALIDATION_PRESETS.email;
  }
  if (hay.includes('phone') || hay.includes('mobile') || hay.includes('contact number')) {
    return VALIDATION_PRESETS.phone;
  }
  return undefined;
}

function resolvePattern(
  record: Record<string, unknown>,
  labelFallback: string,
  id: string,
): string | undefined {
  if (typeof record.pattern === 'string' && record.pattern.trim()) {
    return record.pattern.trim();
  }
  const presetKey = String(record.validationPreset ?? record.validation_preset ?? '')
    .trim()
    .toLowerCase();
  if (presetKey && VALIDATION_PRESETS[presetKey]) {
    return VALIDATION_PRESETS[presetKey];
  }
  return inferValidationPreset(labelFallback, id);
}

export function formatFormFieldsForPrompt(fields: EnagarFormField[]): string {
  if (fields.length === 0) {
    return '(no fields yet — start from blank draft)';
  }
  return fields
    .map((field) => {
      const label = field.label?.en?.trim() || field.id;
      const flags = [
        field.type,
        field.required ? 'required' : null,
        field.type === 'text' || field.type === 'textarea'
          ? (field as { pattern?: string }).pattern
            ? 'validated'
            : null
          : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `- ${field.id}: "${label}" (${flags})`;
    })
    .join('\n');
}

function slugifyFieldId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return slug || 'field';
}

function labelEn(field: EnagarFormField): string {
  return field.label?.en?.trim().toLowerCase() ?? '';
}

function resolveReferenceFieldId(
  reference: string,
  existing: EnagarFormField[],
): string | undefined {
  const needle = reference.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  for (const field of existing) {
    if (field.id.toLowerCase() === needle || field.id.toLowerCase() === slugifyFieldId(reference)) {
      return field.id;
    }
    if (labelEn(field) === needle) {
      return field.id;
    }
  }
  return undefined;
}

function normalizeFieldType(raw: unknown): FormFieldType {
  const key = String(raw ?? 'text')
    .trim()
    .toLowerCase();
  const mapped = FIELD_TYPE_ALIASES[key];
  if (mapped) {
    return mapped;
  }
  if ((FORM_FIELD_TYPES as readonly string[]).includes(key)) {
    return key as FormFieldType;
  }
  return 'text';
}

function normalizeLabel(raw: unknown, fallback: string): LocaleMap {
  if (typeof raw === 'string') {
    return completeLocaleMap({}, raw.trim() || fallback);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return completeLocaleMap(raw as Partial<LocaleMap>, fallback);
  }
  return completeLocaleMap({}, fallback);
}

/** Coerce LLM-shaped field objects into valid EnagarFormField + optional insert position. */
export function normalizeLlmProposedField(
  raw: unknown,
  existing: EnagarFormField[],
): NormalizedFieldInsert | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;

  const labelRaw = record.label ?? record.name;
  const labelFallback =
    typeof labelRaw === 'string'
      ? labelRaw
      : typeof record.name === 'string'
        ? record.name
        : 'Field';

  const id =
    typeof record.id === 'string'
      ? record.id.trim()
      : typeof record.field_id === 'string'
        ? record.field_id.trim()
        : slugifyFieldId(labelFallback);

  const type = normalizeFieldType(record.type);
  const label = normalizeLabel(labelRaw, labelFallback || id);

  const field = {
    id,
    type,
    label,
    ...(record.required === true ? { required: true } : {}),
  } as EnagarFormField;

  if (type === 'text' || type === 'textarea') {
    const pattern = resolvePattern(record, labelFallback, id);
    Object.assign(field, {
      min_length: typeof record.min_length === 'number' ? record.min_length : 2,
      max_length: typeof record.max_length === 'number' ? record.max_length : 120,
      ...(pattern ? { pattern } : {}),
    });
  }

  if (type === 'number') {
    if (typeof record.min === 'number') {
      Object.assign(field, { min: record.min });
    }
    if (typeof record.max === 'number') {
      Object.assign(field, { max: record.max });
    }
  }

  const reference =
    record.referenceField ?? record.reference_field ?? record.insert_after ?? record.after_field;
  const position = String(record.position ?? 'after').toLowerCase();
  let insertAfterId: string | undefined;
  if (typeof reference === 'string' && (position === 'after' || position === '')) {
    insertAfterId = resolveReferenceFieldId(reference, existing);
  }

  return { field, insertAfterId };
}

export function normalizeLlmProposedFields(
  rawFields: unknown[],
  existing: EnagarFormField[],
): NormalizedFieldInsert[] {
  const inserts: NormalizedFieldInsert[] = [];
  let working = [...existing];
  for (const raw of rawFields) {
    const normalized = normalizeLlmProposedField(raw, working);
    if (!normalized) {
      continue;
    }
    inserts.push(normalized);
    working = insertProposedFields(working, [normalized]);
  }
  return inserts;
}

export function insertProposedFields(
  baseFields: EnagarFormField[],
  inserts: NormalizedFieldInsert[],
): EnagarFormField[] {
  const result = [...baseFields];
  for (const { field, insertAfterId } of inserts) {
    const existingIdx = result.findIndex((row) => row.id === field.id);
    if (existingIdx >= 0) {
      if (insertAfterId && insertAfterId !== field.id) {
        result.splice(existingIdx, 1);
        const afterIdx = result.findIndex((row) => row.id === insertAfterId);
        if (afterIdx >= 0) {
          result.splice(afterIdx + 1, 0, field);
        } else {
          result.push(field);
        }
      } else {
        result[existingIdx] = field;
      }
      continue;
    }
    if (insertAfterId) {
      const afterIdx = result.findIndex((row) => row.id === insertAfterId);
      if (afterIdx >= 0) {
        result.splice(afterIdx + 1, 0, field);
        continue;
      }
    }
    result.push(field);
  }
  return result;
}

export function summarizeFieldChanges(
  baseFields: EnagarFormField[],
  inserts: NormalizedFieldInsert[],
): { added: number; moved: number; updated: number } {
  let added = 0;
  let moved = 0;
  let updated = 0;
  for (const insert of inserts) {
    const exists = baseFields.some((field) => field.id === insert.field.id);
    if (!exists) {
      added += 1;
      continue;
    }
    if (insert.insertAfterId) {
      moved += 1;
      continue;
    }
    updated += 1;
  }
  return { added, moved, updated };
}
