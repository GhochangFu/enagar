export const FORM_SCHEMA_VERSION = 1 as const;

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
  equals_any?: Array<string | number | boolean>;
  includes?: string;
  not_empty?: boolean;
}

export type CrossFieldCompareOp = 'gt_field' | 'gte_field' | 'lt_field' | 'lte_field' | 'eq_field';

export interface CrossFieldRule {
  id: string;
  left: string;
  op: CrossFieldCompareOp;
  right: string;
  message?: LocaleMap;
  when?: ShowIfRule;
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
  cross_field_rules?: CrossFieldRule[];
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
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const crossFieldCompareOps = new Set<CrossFieldCompareOp>([
  'gt_field',
  'gte_field',
  'lt_field',
  'lte_field',
  'eq_field',
]);

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
    if (field.show_if) {
      validateShowIfRule(field.show_if, `fields.${index}.show_if`, ids, issues);
    }
  }

  validateCrossFieldRules(schema, ids, issues);

  return result(issues);
}

export function createBlankFormSchemaDraft(
  serviceCode: string,
  title: Partial<LocaleMap> = {},
  version = 1,
): EnagarFormSchema {
  const resolvedTitle = completeLocaleMap(title, 'New service form');

  return {
    schema_version: FORM_SCHEMA_VERSION,
    service_code: serviceCode,
    version,
    title: resolvedTitle,
    description: completeLocaleMap({}, 'Draft citizen form'),
    fields: [
      {
        id: 'applicant-section',
        type: 'section',
        label: completeLocaleMap({}, 'Applicant details'),
      },
      {
        id: 'applicant_name',
        type: 'text',
        label: completeLocaleMap({}, 'Applicant name'),
        required: true,
        min_length: 2,
        max_length: 120,
      },
    ],
  };
}

export function assertValidFormSchema(schema: EnagarFormSchema): EnagarFormSchema {
  const validation = validateFormSchema(schema);
  if (!validation.ok) {
    throw new Error(validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('; '));
  }

  return schema;
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

  validateCrossFieldSubmission(schema, submission, issues);

  return result(issues);
}

export function isFieldVisible(field: EnagarFormField, values: FormSubmission): boolean {
  return matchesShowIfRule(field.show_if, values);
}

export function matchesShowIfRule(rule: ShowIfRule | undefined, values: FormSubmission): boolean {
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
  if (rule.equals_any !== undefined && rule.equals_any.length > 0) {
    return rule.equals_any.some((candidate) => value === candidate);
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
      return removeUndefined({
        type: 'string',
        format: 'date',
        minimum: field.min_date,
        maximum: field.max_date,
      });
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

  if (field.type === 'date') {
    validateDateBounds(field, path, issues);
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
      validateDateValue(field, value, issues);
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

function validateDateBounds(
  field: DateFormField,
  path: string,
  issues: FormValidationIssue[],
): void {
  const minValid = field.min_date === undefined || isIsoDateString(field.min_date);
  const maxValid = field.max_date === undefined || isIsoDateString(field.max_date);

  if (field.min_date !== undefined && !minValid) {
    issues.push(issue(`${path}.min_date`, 'min_date must be YYYY-MM-DD'));
  }
  if (field.max_date !== undefined && !maxValid) {
    issues.push(issue(`${path}.max_date`, 'max_date must be YYYY-MM-DD'));
  }
  if (
    minValid &&
    maxValid &&
    field.min_date !== undefined &&
    field.max_date !== undefined &&
    field.min_date > field.max_date
  ) {
    issues.push(issue(`${path}.max_date`, 'max_date must be on or after min_date'));
  }
}

function validateDateValue(
  field: DateFormField,
  value: FormSubmissionValue | undefined,
  issues: FormValidationIssue[],
): void {
  if (typeof value !== 'string' || !isIsoDateString(value)) {
    issues.push(issue(field.id, 'date value must be YYYY-MM-DD'));
    return;
  }
  if (!isValidCalendarIsoDate(value)) {
    issues.push(issue(field.id, 'date value is not a valid calendar date'));
    return;
  }
  if (field.min_date !== undefined && isIsoDateString(field.min_date) && value < field.min_date) {
    issues.push(issue(field.id, `date must be on or after ${field.min_date}`));
  }
  if (field.max_date !== undefined && isIsoDateString(field.max_date) && value > field.max_date) {
    issues.push(issue(field.id, `date must be on or before ${field.max_date}`));
  }
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && isoDatePattern.test(value);
}

function isValidCalendarIsoDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validateShowIfRule(
  rule: ShowIfRule,
  path: string,
  ids: Set<string>,
  issues: FormValidationIssue[],
): void {
  if (!ids.has(rule.field)) {
    issues.push(issue(`${path}.field`, `unknown field: ${rule.field}`));
  }
  const activeKinds = [
    rule.not_empty ? 'not_empty' : null,
    rule.includes !== undefined ? 'includes' : null,
    rule.equals !== undefined ? 'equals' : null,
    rule.equals_any !== undefined ? 'equals_any' : null,
  ].filter(Boolean);
  if (activeKinds.length !== 1) {
    issues.push(
      issue(path, 'show_if must set exactly one of equals, equals_any, includes, or not_empty'),
    );
  }
  if (rule.equals_any !== undefined) {
    if (!Array.isArray(rule.equals_any) || rule.equals_any.length === 0) {
      issues.push(issue(`${path}.equals_any`, 'equals_any must be a non-empty array'));
    }
  }
}

function validateCrossFieldRules(
  schema: EnagarFormSchema,
  ids: Set<string>,
  issues: FormValidationIssue[],
): void {
  if (schema.cross_field_rules === undefined) {
    return;
  }
  if (!Array.isArray(schema.cross_field_rules)) {
    issues.push(issue('cross_field_rules', 'cross_field_rules must be an array'));
    return;
  }

  const fieldById = new Map(schema.fields.map((field) => [field.id, field]));
  const ruleIds = new Set<string>();

  for (const [index, rule] of schema.cross_field_rules.entries()) {
    const path = `cross_field_rules.${index}`;
    if (!rule || typeof rule !== 'object') {
      issues.push(issue(path, 'cross-field rule must be an object'));
      continue;
    }
    if (typeof rule.id !== 'string' || !fieldIdPattern.test(rule.id)) {
      issues.push(issue(`${path}.id`, 'rule id must be lowercase and stable'));
    } else if (ruleIds.has(rule.id)) {
      issues.push(issue(`${path}.id`, `duplicate cross-field rule id: ${rule.id}`));
    } else {
      ruleIds.add(rule.id);
    }
    if (!ids.has(rule.left)) {
      issues.push(issue(`${path}.left`, `unknown field: ${rule.left}`));
    }
    if (!ids.has(rule.right)) {
      issues.push(issue(`${path}.right`, `unknown field: ${rule.right}`));
    }
    if (rule.left === rule.right) {
      issues.push(issue(`${path}.right`, 'left and right fields must differ'));
    }
    if (!crossFieldCompareOps.has(rule.op)) {
      issues.push(issue(`${path}.op`, 'unsupported cross-field compare op'));
    }
    if (rule.message) {
      validateLocaleMap(rule.message, `${path}.message`, issues);
    }
    if (rule.when) {
      validateShowIfRule(rule.when, `${path}.when`, ids, issues);
    }

    const leftField = fieldById.get(rule.left);
    const rightField = fieldById.get(rule.right);
    if (leftField?.type === 'section' || rightField?.type === 'section') {
      issues.push(issue(path, 'cross-field rules cannot reference section fields'));
    }
    if (leftField && rightField && !isCrossFieldCompareSupported(rule.op, leftField, rightField)) {
      issues.push(
        issue(path, `op ${rule.op} is not supported for ${leftField.type} vs ${rightField.type}`),
      );
    }
  }
}

function validateCrossFieldSubmission(
  schema: EnagarFormSchema,
  submission: FormSubmission,
  issues: FormValidationIssue[],
): void {
  if (!schema.cross_field_rules?.length) {
    return;
  }

  const fieldById = new Map(schema.fields.map((field) => [field.id, field]));

  for (const rule of schema.cross_field_rules) {
    if (rule.when && !matchesShowIfRule(rule.when, submission)) {
      continue;
    }

    const leftField = fieldById.get(rule.left);
    const rightField = fieldById.get(rule.right);
    if (!leftField || !rightField) {
      continue;
    }
    if (!isFieldVisible(leftField, submission) || !isFieldVisible(rightField, submission)) {
      continue;
    }

    const leftValue = submission[rule.left];
    const rightValue = submission[rule.right];
    if (
      leftValue === undefined ||
      rightValue === undefined ||
      isEmpty(leftValue) ||
      isEmpty(rightValue)
    ) {
      continue;
    }

    if (evaluateCrossFieldRule(rule, leftField, leftValue, rightField, rightValue)) {
      continue;
    }

    issues.push(
      issue(
        rule.left,
        rule.message?.en ?? defaultCrossFieldRuleMessage(rule, leftField, rightField),
      ),
    );
  }
}

function isCrossFieldCompareSupported(
  op: CrossFieldCompareOp,
  leftField: EnagarFormField,
  rightField: EnagarFormField,
): boolean {
  if (leftField.type !== rightField.type) {
    return false;
  }
  if (op === 'eq_field') {
    return leftField.type === 'date' || leftField.type === 'number' || leftField.type === 'text';
  }
  return leftField.type === 'date' || leftField.type === 'number';
}

function evaluateCrossFieldRule(
  rule: CrossFieldRule,
  leftField: EnagarFormField,
  leftValue: FormSubmissionValue,
  rightField: EnagarFormField,
  rightValue: FormSubmissionValue,
): boolean {
  const leftComparable = toComparableValue(leftField, leftValue);
  const rightComparable = toComparableValue(rightField, rightValue);
  if (leftComparable === null || rightComparable === null) {
    return true;
  }

  switch (rule.op) {
    case 'eq_field':
      return leftComparable === rightComparable;
    case 'gt_field':
      return leftComparable > rightComparable;
    case 'gte_field':
      return leftComparable >= rightComparable;
    case 'lt_field':
      return leftComparable < rightComparable;
    case 'lte_field':
      return leftComparable <= rightComparable;
  }
}

function toComparableValue(
  field: EnagarFormField,
  value: FormSubmissionValue,
): string | number | null {
  if (field.type === 'date') {
    return typeof value === 'string' && isIsoDateString(value) ? value : null;
  }
  if (field.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (field.type === 'text' || field.type === 'textarea') {
    return typeof value === 'string' ? value : null;
  }
  return null;
}

function defaultCrossFieldRuleMessage(
  rule: CrossFieldRule,
  leftField: EnagarFormField,
  rightField: EnagarFormField,
): string {
  const leftLabel = leftField.label.en;
  const rightLabel = rightField.label.en;
  switch (rule.op) {
    case 'eq_field':
      return `${leftLabel} must match ${rightLabel}`;
    case 'gt_field':
      return `${leftLabel} must be after ${rightLabel}`;
    case 'gte_field':
      return `${leftLabel} must be on or after ${rightLabel}`;
    case 'lt_field':
      return `${leftLabel} must be before ${rightLabel}`;
    case 'lte_field':
      return `${leftLabel} must be on or before ${rightLabel}`;
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

export function completeLocaleMap(partial: Partial<LocaleMap>, fallback: string): LocaleMap {
  return {
    en: partial.en?.trim() || fallback,
    bn: partial.bn?.trim() || partial.en?.trim() || fallback,
    hi: partial.hi?.trim() || partial.en?.trim() || fallback,
  };
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

/** Schema key prefix for RN grievance composer offline drafts (@enagar/mobile). */
export const MOBILE_GRIEVANCE_DRAFT_SCHEMA = 'mobile.grievance.compose@v1';

/**
 * Storage-agnostic envelope for persisted form payloads (offline drafts — Master Sprint 5.2+).
 */
export interface FormDraftEnvelope<TPayload extends Record<string, unknown>> {
  schemaKey: string;
  tenantCode: string;
  updatedAtIso: string;
  payload: TPayload;
}

export function createFormDraftEnvelope<TPayload extends Record<string, unknown>>(
  schemaKey: string,
  tenantCode: string,
  payload: TPayload,
): FormDraftEnvelope<TPayload> {
  return {
    schemaKey,
    tenantCode,
    updatedAtIso: new Date().toISOString(),
    payload,
  };
}

/** Parse JSON written by `@enagar/mobile` or other callers; rejects malformed shapes. */
export function parseFormDraftJson<TPayload extends Record<string, unknown>>(
  raw: string,
): FormDraftEnvelope<TPayload> | null {
  try {
    const parsed = JSON.parse(raw) as FormDraftEnvelope<TPayload>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (
      typeof (parsed as FormDraftEnvelope<TPayload>).schemaKey !== 'string' ||
      typeof (parsed as FormDraftEnvelope<TPayload>).tenantCode !== 'string'
    ) {
      return null;
    }
    if (
      typeof (parsed as FormDraftEnvelope<TPayload>).payload !== 'object' ||
      (parsed as FormDraftEnvelope<TPayload>).payload === null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
