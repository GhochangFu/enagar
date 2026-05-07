export const FORM_SCHEMA_VERSION = 1 as const;

export * from './fixtures.js';

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'radio',
  'select',
  'multiselect',
  'file',
  'section',
] as const;

export type LocaleCode = 'en' | 'bn' | 'hi';
export type LocaleMap = Record<LocaleCode, string>;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
export type FormPlatform = 'web' | 'native';
export type FormSubmissionValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | FileSubmission
  | FileSubmission[];
export type FormSubmission = Record<string, FormSubmissionValue | undefined>;
export type WidgetKind =
  | 'text-input'
  | 'textarea'
  | 'number-input'
  | 'date-input'
  | 'choice-list'
  | 'select'
  | 'multi-choice-list'
  | 'file-picker'
  | 'section';

export interface FileSubmission {
  name: string;
  mime_type: string;
  size_mb: number;
}

export interface FormOption {
  value: string;
  label: LocaleMap;
}

export interface ShowIfRule {
  field: string;
  equals?: string | number | boolean;
  includes?: string;
  not_empty?: boolean;
}

export interface BaseFormField {
  id: string;
  type: FormFieldType;
  label: LocaleMap;
  help_text?: LocaleMap;
  required?: boolean;
  show_if?: ShowIfRule;
}

export interface TextFormField extends BaseFormField {
  type: 'text' | 'textarea';
  min_length?: number;
  max_length?: number;
  pattern?: string;
}

export interface NumberFormField extends BaseFormField {
  type: 'number';
  min?: number;
  max?: number;
}

export interface DateFormField extends BaseFormField {
  type: 'date';
  min_date?: string;
  max_date?: string;
}

export interface ChoiceFormField extends BaseFormField {
  type: 'radio' | 'select' | 'multiselect';
  options: FormOption[];
}

export interface FileFormField extends BaseFormField {
  type: 'file';
  accept: string[];
  max_size_mb: number;
  multiple?: boolean;
}

export interface SectionFormField extends BaseFormField {
  type: 'section';
}

export type EnagarFormField =
  | TextFormField
  | NumberFormField
  | DateFormField
  | ChoiceFormField
  | FileFormField
  | SectionFormField;

export interface EnagarFormSchema {
  schema_version: typeof FORM_SCHEMA_VERSION;
  service_code: string;
  version: number;
  title: LocaleMap;
  description?: LocaleMap;
  fields: EnagarFormField[];
}

export interface FormValidationIssue {
  path: string;
  message: string;
}

export interface FormValidationResult {
  ok: boolean;
  issues: FormValidationIssue[];
}

export interface FormRenderNode {
  id: string;
  field_type: FormFieldType;
  widget: WidgetKind;
  label: string;
  help_text?: string;
  required: boolean;
  visible: boolean;
  options?: Array<{ value: string; label: string }>;
  accept?: string[];
  max_size_mb?: number;
  multiple?: boolean;
}

export interface CreateRenderPlanOptions {
  locale?: LocaleCode;
  platform?: FormPlatform;
  values?: FormSubmission;
}

export interface FormRenderPlan {
  schema_version: typeof FORM_SCHEMA_VERSION;
  service_code: string;
  version: number;
  title: string;
  description?: string;
  platform: FormPlatform;
  nodes: FormRenderNode[];
}

export interface JsonSchemaExport {
  $schema: 'https://json-schema.org/draft/2020-12/schema';
  type: 'object';
  additionalProperties: false;
  properties: Record<string, Record<string, unknown>>;
  required: string[];
}

const fieldTypeSet = new Set<string>(FORM_FIELD_TYPES);
const fieldIdPattern = /^[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*$/;
const serviceCodePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function validateFormSchema(schema: EnagarFormSchema): FormValidationResult {
  const issues: FormValidationIssue[] = [];

  if (schema.schema_version !== FORM_SCHEMA_VERSION) {
    issues.push(issue('schema_version', `schema_version must be ${FORM_SCHEMA_VERSION}`));
  }
  if (!serviceCodePattern.test(schema.service_code)) {
    issues.push(issue('service_code', 'service_code must be lowercase and URL-safe'));
  }
  if (!Number.isInteger(schema.version) || schema.version < 1) {
    issues.push(issue('version', 'version must be a positive integer'));
  }
  validateLocaleMap(schema.title, 'title', issues);
  if (schema.description) {
    validateLocaleMap(schema.description, 'description', issues);
  }
  if (!Array.isArray(schema.fields) || schema.fields.length === 0) {
    issues.push(issue('fields', 'at least one field is required'));
    return result(issues);
  }

  const ids = new Set<string>();
  for (const [index, field] of schema.fields.entries()) {
    const path = `fields.${index}`;
    if (!fieldIdPattern.test(field.id)) {
      issues.push(issue(`${path}.id`, 'field id must be lowercase and stable'));
    }
    if (ids.has(field.id)) {
      issues.push(issue(`${path}.id`, `duplicate field id: ${field.id}`));
    }
    ids.add(field.id);
    if (!fieldTypeSet.has(field.type)) {
      issues.push(issue(`${path}.type`, `unsupported field type: ${field.type}`));
    }
    validateLocaleMap(field.label, `${path}.label`, issues);
    if (field.help_text) {
      validateLocaleMap(field.help_text, `${path}.help_text`, issues);
    }
    validateFieldSpecificShape(field, path, issues);
  }

  for (const [index, field] of schema.fields.entries()) {
    if (field.show_if && !ids.has(field.show_if.field)) {
      issues.push(issue(`fields.${index}.show_if.field`, `unknown field: ${field.show_if.field}`));
    }
  }

  return result(issues);
}

export function createRenderPlan(
  schema: EnagarFormSchema,
  options: CreateRenderPlanOptions = {},
): FormRenderPlan {
  const locale = options.locale ?? 'en';
  const platform = options.platform ?? 'web';
  const values = options.values ?? {};

  return {
    schema_version: schema.schema_version,
    service_code: schema.service_code,
    version: schema.version,
    title: pickLocale(schema.title, locale),
    description: schema.description ? pickLocale(schema.description, locale) : undefined,
    platform,
    nodes: schema.fields.map((field) => toRenderNode(field, locale, values, platform)),
  };
}

export function exportToJsonSchema(schema: EnagarFormSchema): JsonSchemaExport {
  const properties: JsonSchemaExport['properties'] = {};
  const required: string[] = [];

  for (const field of schema.fields) {
    if (field.type === 'section') {
      continue;
    }

    properties[field.id] = toJsonSchemaProperty(field);
    if (field.required) {
      required.push(field.id);
    }
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  };
}

export function validateSubmission(
  schema: EnagarFormSchema,
  submission: FormSubmission,
): FormValidationResult {
  const schemaValidation = validateFormSchema(schema);
  if (!schemaValidation.ok) {
    return schemaValidation;
  }

  const issues: FormValidationIssue[] = [];
  for (const field of schema.fields) {
    if (field.type === 'section' || !isFieldVisible(field, submission)) {
      continue;
    }

    const value = submission[field.id];
    if (field.required && isEmpty(value)) {
      issues.push(issue(field.id, 'required field is missing'));
      continue;
    }
    if (isEmpty(value)) {
      continue;
    }

    validateSubmissionValue(field, value, issues);
  }

  return result(issues);
}

export function isFieldVisible(field: EnagarFormField, values: FormSubmission): boolean {
  const rule = field.show_if;
  if (!rule) {
    return true;
  }

  const value = values[rule.field];
  if (rule.not_empty) {
    return !isEmpty(value);
  }
  if (rule.includes !== undefined) {
    return Array.isArray(value) && value.some((item) => item === rule.includes);
  }
  if (rule.equals !== undefined) {
    return value === rule.equals;
  }
  return true;
}

function toRenderNode(
  field: EnagarFormField,
  locale: LocaleCode,
  values: FormSubmission,
  platform: FormPlatform,
): FormRenderNode {
  const node: FormRenderNode = {
    id: field.id,
    field_type: field.type,
    widget: widgetForField(field, platform),
    label: pickLocale(field.label, locale),
    help_text: field.help_text ? pickLocale(field.help_text, locale) : undefined,
    required: field.required === true,
    visible: isFieldVisible(field, values),
  };

  if (isChoiceField(field)) {
    node.options = field.options.map((option) => ({
      value: option.value,
      label: pickLocale(option.label, locale),
    }));
  }
  if (field.type === 'file') {
    node.accept = field.accept;
    node.max_size_mb = field.max_size_mb;
    node.multiple = field.multiple === true;
  }

  return node;
}

function widgetForField(field: EnagarFormField, platform: FormPlatform): WidgetKind {
  switch (field.type) {
    case 'text':
      return 'text-input';
    case 'textarea':
      return 'textarea';
    case 'number':
      return 'number-input';
    case 'date':
      return 'date-input';
    case 'radio':
      return 'choice-list';
    case 'select':
      return platform === 'native' ? 'choice-list' : 'select';
    case 'multiselect':
      return 'multi-choice-list';
    case 'file':
      return 'file-picker';
    case 'section':
      return 'section';
  }
}

function toJsonSchemaProperty(
  field: Exclude<EnagarFormField, SectionFormField>,
): Record<string, unknown> {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return removeUndefined({
        type: 'string',
        minLength: field.min_length,
        maxLength: field.max_length,
        pattern: field.pattern,
      });
    case 'number':
      return removeUndefined({
        type: 'number',
        minimum: field.min,
        maximum: field.max,
      });
    case 'date':
      return {
        type: 'string',
        format: 'date',
      };
    case 'radio':
    case 'select':
      return {
        type: 'string',
        enum: field.options.map((option) => option.value),
      };
    case 'multiselect':
      return {
        type: 'array',
        items: {
          type: 'string',
          enum: field.options.map((option) => option.value),
        },
      };
    case 'file':
      return field.multiple
        ? { type: 'array', items: fileMetadataSchema(field) }
        : fileMetadataSchema(field);
  }
}

function fileMetadataSchema(field: FileFormField): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      mime_type: { type: 'string', enum: field.accept },
      size_mb: { type: 'number', maximum: field.max_size_mb },
    },
    required: ['name', 'mime_type', 'size_mb'],
  };
}

function validateFieldSpecificShape(
  field: EnagarFormField,
  path: string,
  issues: FormValidationIssue[],
): void {
  if (isChoiceField(field)) {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      issues.push(issue(`${path}.options`, 'choice fields require options'));
      return;
    }
    const values = new Set<string>();
    for (const [optionIndex, option] of field.options.entries()) {
      if (!option.value) {
        issues.push(issue(`${path}.options.${optionIndex}.value`, 'option value is required'));
      }
      if (values.has(option.value)) {
        issues.push(issue(`${path}.options.${optionIndex}.value`, 'duplicate option value'));
      }
      values.add(option.value);
      validateLocaleMap(option.label, `${path}.options.${optionIndex}.label`, issues);
    }
  }

  if (field.type === 'file') {
    if (!Array.isArray(field.accept) || field.accept.length === 0) {
      issues.push(issue(`${path}.accept`, 'file fields require accepted MIME types'));
    }
    if (!Number.isInteger(field.max_size_mb) || field.max_size_mb < 1 || field.max_size_mb > 10) {
      issues.push(issue(`${path}.max_size_mb`, 'file max_size_mb must be between 1 and 10'));
    }
  }
}

function validateSubmissionValue(
  field: EnagarFormField,
  value: FormSubmissionValue | undefined,
  issues: FormValidationIssue[],
): void {
  switch (field.type) {
    case 'text':
    case 'textarea':
      validateTextValue(field, value, issues);
      return;
    case 'number':
      validateNumberValue(field, value, issues);
      return;
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        issues.push(issue(field.id, 'date value must be YYYY-MM-DD'));
      }
      return;
    case 'radio':
    case 'select':
      if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
        issues.push(issue(field.id, 'value must be one of the allowed options'));
      }
      return;
    case 'multiselect':
      if (
        !Array.isArray(value) ||
        !value.every((item) => field.options.some((option) => option.value === item))
      ) {
        issues.push(issue(field.id, 'value must be an array of allowed options'));
      }
      return;
    case 'file':
      validateFileValue(field, value, issues);
      return;
    case 'section':
      return;
  }
}

function validateTextValue(
  field: TextFormField,
  value: FormSubmissionValue | undefined,
  issues: FormValidationIssue[],
): void {
  if (typeof value !== 'string') {
    issues.push(issue(field.id, 'value must be a string'));
    return;
  }
  if (field.min_length !== undefined && value.length < field.min_length) {
    issues.push(issue(field.id, `value must be at least ${field.min_length} characters`));
  }
  if (field.max_length !== undefined && value.length > field.max_length) {
    issues.push(issue(field.id, `value must be at most ${field.max_length} characters`));
  }
  if (field.pattern && !new RegExp(field.pattern).test(value)) {
    issues.push(issue(field.id, 'value does not match required pattern'));
  }
}

function validateNumberValue(
  field: NumberFormField,
  value: FormSubmissionValue | undefined,
  issues: FormValidationIssue[],
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    issues.push(issue(field.id, 'value must be a number'));
    return;
  }
  if (field.min !== undefined && value < field.min) {
    issues.push(issue(field.id, `value must be at least ${field.min}`));
  }
  if (field.max !== undefined && value > field.max) {
    issues.push(issue(field.id, `value must be at most ${field.max}`));
  }
}

function validateFileValue(
  field: FileFormField,
  value: FormSubmissionValue | undefined,
  issues: FormValidationIssue[],
): void {
  const files = Array.isArray(value) ? value : [value];
  if (!field.multiple && Array.isArray(value)) {
    issues.push(issue(field.id, 'field accepts only one file'));
    return;
  }

  for (const file of files) {
    if (!isFileSubmission(file)) {
      issues.push(issue(field.id, 'file metadata is invalid'));
      return;
    }
    if (!field.accept.includes(file.mime_type)) {
      issues.push(issue(field.id, `file MIME type ${file.mime_type} is not accepted`));
    }
    if (file.size_mb > field.max_size_mb) {
      issues.push(issue(field.id, `file exceeds ${field.max_size_mb} MB`));
    }
  }
}

function isChoiceField(field: EnagarFormField): field is ChoiceFormField {
  return field.type === 'radio' || field.type === 'select' || field.type === 'multiselect';
}

function isFileSubmission(value: unknown): value is FileSubmission {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybeFile = value as Partial<FileSubmission>;
  return (
    typeof maybeFile.name === 'string' &&
    typeof maybeFile.mime_type === 'string' &&
    typeof maybeFile.size_mb === 'number'
  );
}

function validateLocaleMap(
  value: LocaleMap | undefined,
  path: string,
  issues: FormValidationIssue[],
): void {
  for (const locale of ['en', 'bn', 'hi'] as const) {
    if (!value?.[locale]) {
      issues.push(issue(`${path}.${locale}`, `${locale} translation is required`));
    }
  }
}

function pickLocale(value: LocaleMap, locale: LocaleCode): string {
  return value[locale] || value.en;
}

function isEmpty(value: FormSubmissionValue | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function issue(path: string, message: string): FormValidationIssue {
  return { path, message };
}

function result(issues: FormValidationIssue[]): FormValidationResult {
  return { ok: issues.length === 0, issues };
}

function removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}
