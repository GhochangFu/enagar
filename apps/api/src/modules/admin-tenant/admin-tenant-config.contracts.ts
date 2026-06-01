import { BadRequestException } from '@nestjs/common';

export type LocaleLabel = Record<string, string>;

export type FeeRule =
  | { type: 'free'; currency?: 'INR' }
  | { type: 'fixed'; amount_paise: number; currency?: 'INR' }
  | {
      type: 'slab';
      currency?: 'INR';
      input_key: string;
      slabs: Array<{ upto: number | null; amount_paise: number }>;
    }
  | {
      type: 'computed';
      currency?: 'INR';
      input_key: string;
      base_amount_paise: number;
      unit_amount_paise: number;
    }
  | { type: 'external'; provider: string; currency?: 'INR' };

export type DocumentChecklistItem = {
  code: string;
  label: LocaleLabel;
  required: boolean;
  accept: string[];
  max_size_mb: number;
};

export const PAYMENT_SCHEDULES = ['upfront_only', 'deferred_only', 'upfront_and_deferred'] as const;
export type PaymentSchedule = (typeof PAYMENT_SCHEDULES)[number];

export const FEE_LINE_CODES = ['application', 'approval'] as const;
export type FeeLineCode = (typeof FEE_LINE_CODES)[number];

export type ServiceFeeLine = {
  label: LocaleLabel;
  rule: FeeRule;
  revenue_head_code?: string;
  accounting_code?: string;
};

export type ServiceFeeLines = Partial<Record<FeeLineCode, ServiceFeeLine>>;

export type ServiceFeeLinePreviews = Partial<Record<FeeLineCode, number | null>>;

export type ResolvedServicePaymentConfig = {
  payment_schedule: PaymentSchedule;
  fee_lines: ServiceFeeLines;
  fee_line_previews: ServiceFeeLinePreviews;
  inferred_schedule: boolean;
};

export type TariffCategory = 'property' | 'water' | 'conservancy' | 'sewerage';
export type NotificationChannel = 'push' | 'sms' | 'email' | 'whatsapp';
export type SupportedLocale = 'en' | 'bn' | 'hi';
export type KbArticleStatus = 'draft' | 'published' | 'archived';
export type TenantBannerSeverity = 'info' | 'warning' | 'critical';

export function assertValidFeeRule(value: unknown): asserts value is FeeRule {
  if (!isRecord(value)) {
    throw new BadRequestException('Fee rule must be an object');
  }
  const type = value.type;
  if (!['free', 'fixed', 'slab', 'computed', 'external'].includes(String(type))) {
    throw new BadRequestException('Unsupported fee rule type');
  }
  if (value.currency !== undefined && value.currency !== 'INR') {
    throw new BadRequestException('Only INR fee rules are supported');
  }
  if (type === 'fixed') {
    assertNonNegativeInt(value.amount_paise, 'amount_paise');
  }
  if (type === 'slab') {
    assertNonEmptyString(value.input_key, 'input_key');
    if (!Array.isArray(value.slabs) || value.slabs.length === 0) {
      throw new BadRequestException('Slab fee rule requires at least one slab');
    }
    let sawOpenEnded = false;
    for (const slab of value.slabs) {
      if (!isRecord(slab)) {
        throw new BadRequestException('Each fee slab must be an object');
      }
      if (slab.upto === null) {
        sawOpenEnded = true;
      } else {
        assertPositiveNumber(slab.upto, 'slab.upto');
      }
      assertNonNegativeInt(slab.amount_paise, 'slab.amount_paise');
    }
    if (!sawOpenEnded) {
      throw new BadRequestException('Slab fee rule requires an open-ended final slab');
    }
  }
  if (type === 'computed') {
    assertNonEmptyString(value.input_key, 'input_key');
    assertNonNegativeInt(value.base_amount_paise, 'base_amount_paise');
    assertNonNegativeInt(value.unit_amount_paise, 'unit_amount_paise');
  }
  if (type === 'external') {
    assertNonEmptyString(value.provider, 'provider');
  }
}

export function calculateFeePreview(
  rule: FeeRule,
  inputs: Record<string, unknown> = {},
): number | null {
  switch (rule.type) {
    case 'free':
      return 0;
    case 'fixed':
      return rule.amount_paise;
    case 'slab': {
      const raw = Number(inputs[rule.input_key] ?? 0);
      if (!Number.isFinite(raw) || raw < 0) {
        return null;
      }
      const slab = rule.slabs.find((candidate) => candidate.upto === null || raw <= candidate.upto);
      return slab?.amount_paise ?? null;
    }
    case 'computed': {
      const raw = Number(inputs[rule.input_key] ?? 0);
      if (!Number.isFinite(raw) || raw < 0) {
        return null;
      }
      return rule.base_amount_paise + Math.ceil(raw) * rule.unit_amount_paise;
    }
    case 'external':
      return null;
  }
}

export function requiredFeeLineCodes(schedule: PaymentSchedule): FeeLineCode[] {
  switch (schedule) {
    case 'upfront_only':
      return ['application'];
    case 'deferred_only':
      return ['approval'];
    case 'upfront_and_deferred':
      return ['application', 'approval'];
  }
}

export function readPaymentScheduleFromConfig(overrideConfig: unknown): PaymentSchedule | null {
  if (!isRecord(overrideConfig)) {
    return null;
  }
  const schedule = overrideConfig.payment_schedule;
  return PAYMENT_SCHEDULES.includes(schedule as PaymentSchedule)
    ? (schedule as PaymentSchedule)
    : null;
}

export function readFeeLinesFromConfig(overrideConfig: unknown): ServiceFeeLines | null {
  if (!isRecord(overrideConfig) || !isRecord(overrideConfig.fee_lines)) {
    return null;
  }
  const feeLines = overrideConfig.fee_lines;
  const parsed: ServiceFeeLines = {};
  for (const code of FEE_LINE_CODES) {
    if (feeLines[code] !== undefined) {
      parsed[code] = feeLines[code] as ServiceFeeLine;
    }
  }
  return Object.keys(parsed).length > 0 ? parsed : null;
}

export function defaultFeeLineLabel(code: FeeLineCode): LocaleLabel {
  if (code === 'application') {
    return {
      en: 'Application fee',
      bn: 'আবেদন ফি',
      hi: 'आवेदन शुल्क',
    };
  }
  return {
    en: 'Licence fee',
    bn: 'লাইসেন্স ফি',
    hi: 'लाइसेंस शुल्क',
  };
}

export function legacyFeeRuleToFeeLine(code: FeeLineCode, rule: FeeRule): ServiceFeeLine {
  return {
    label: defaultFeeLineLabel(code),
    rule,
  };
}

export function migrateLegacyFeeRuleToFeeLines(
  schedule: PaymentSchedule,
  legacyFeeRule: FeeRule,
): ServiceFeeLines {
  const primaryCode = schedule === 'deferred_only' ? 'approval' : 'application';
  return {
    [primaryCode]: legacyFeeRuleToFeeLine(primaryCode, legacyFeeRule),
  };
}

export function workflowInfersDeferredPaymentSchedule(
  definition:
    | {
        stages?: Array<{ code?: string }>;
        transitions?: Array<{ effects?: Array<{ type?: string }> }>;
      }
    | null
    | undefined,
): boolean {
  if (!definition) {
    return false;
  }
  const hasPaymentPendingStage = (definition.stages ?? []).some(
    (stage) => stage.code === 'payment-pending',
  );
  const hasGenerateLink = (definition.transitions ?? []).some((transition) =>
    (transition.effects ?? []).some((effect) => effect.type === 'generate_payment_link'),
  );
  return hasPaymentPendingStage && hasGenerateLink;
}

export function inferPaymentSchedule(
  overrideConfig: unknown,
  workflowDefinition?: {
    stages?: Array<{ code?: string }>;
    transitions?: Array<{ effects?: Array<{ type?: string }> }>;
  } | null,
): PaymentSchedule {
  const explicit = readPaymentScheduleFromConfig(overrideConfig);
  if (explicit) {
    return explicit;
  }
  if (workflowInfersDeferredPaymentSchedule(workflowDefinition)) {
    return 'deferred_only';
  }
  return 'upfront_only';
}

export function assertValidServiceFeeLine(
  value: unknown,
  field: string,
): asserts value is ServiceFeeLine {
  if (!isRecord(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  assertLocaleLabel(value.label, `${field}.label`);
  if (!isRecord(value.rule)) {
    throw new BadRequestException(`${field}.rule must be an object`);
  }
  assertValidFeeRule(value.rule);
  if (value.revenue_head_code !== undefined) {
    assertCode(value.revenue_head_code, `${field}.revenue_head_code`);
  }
  if (value.accounting_code !== undefined && typeof value.accounting_code !== 'string') {
    throw new BadRequestException(`${field}.accounting_code must be a string`);
  }
}

export function assertValidFeeLines(value: unknown): asserts value is ServiceFeeLines {
  if (!isRecord(value)) {
    throw new BadRequestException('fee_lines must be an object');
  }
  for (const code of FEE_LINE_CODES) {
    if (value[code] === undefined) {
      continue;
    }
    assertValidServiceFeeLine(value[code], `fee_lines.${code}`);
  }
}

export function assertValidPaymentSchedule(
  schedule: unknown,
  feeLines: unknown,
): asserts schedule is PaymentSchedule {
  if (!PAYMENT_SCHEDULES.includes(String(schedule) as PaymentSchedule)) {
    throw new BadRequestException('Unsupported payment_schedule');
  }
  assertValidFeeLines(feeLines);
  const lines = feeLines as ServiceFeeLines;
  const required = requiredFeeLineCodes(schedule as PaymentSchedule);
  for (const code of required) {
    if (!lines[code]) {
      throw new BadRequestException(`payment_schedule "${schedule}" requires fee_lines.${code}`);
    }
  }
  for (const code of FEE_LINE_CODES) {
    if (lines[code] && !required.includes(code)) {
      throw new BadRequestException(
        `payment_schedule "${schedule}" must not include fee_lines.${code}`,
      );
    }
  }
}

export function previewFeeLines(
  feeLines: ServiceFeeLines,
  inputs: Record<string, unknown> = {},
): ServiceFeeLinePreviews {
  const previews: ServiceFeeLinePreviews = {};
  for (const code of FEE_LINE_CODES) {
    const line = feeLines[code];
    if (!line) {
      continue;
    }
    try {
      assertValidFeeRule(line.rule);
      previews[code] = calculateFeePreview(line.rule, inputs);
    } catch {
      previews[code] = null;
    }
  }
  return previews;
}

export function primaryFeeLineCode(schedule: PaymentSchedule): FeeLineCode {
  return schedule === 'deferred_only' ? 'approval' : 'application';
}

export function resolveServicePaymentConfig(
  overrideConfig: unknown,
  legacyFeeRule: unknown,
  workflowDefinition?: {
    stages?: Array<{ code?: string }>;
    transitions?: Array<{ effects?: Array<{ type?: string }> }>;
  } | null,
): ResolvedServicePaymentConfig {
  const explicitSchedule = readPaymentScheduleFromConfig(overrideConfig);
  const payment_schedule = inferPaymentSchedule(overrideConfig, workflowDefinition);
  const storedLines = readFeeLinesFromConfig(overrideConfig);
  let fee_lines: ServiceFeeLines = storedLines ?? {};

  if (Object.keys(fee_lines).length === 0) {
    try {
      assertValidFeeRule(legacyFeeRule);
      fee_lines = migrateLegacyFeeRuleToFeeLines(payment_schedule, legacyFeeRule as FeeRule);
    } catch {
      fee_lines = {};
    }
  }

  for (const code of requiredFeeLineCodes(payment_schedule)) {
    if (!fee_lines[code]) {
      try {
        assertValidFeeRule(legacyFeeRule);
        fee_lines = {
          ...fee_lines,
          [code]: legacyFeeRuleToFeeLine(code, legacyFeeRule as FeeRule),
        };
      } catch {
        // leave missing — validation on PATCH will catch incomplete configs
      }
    }
  }

  return {
    payment_schedule,
    fee_lines,
    fee_line_previews: previewFeeLines(fee_lines),
    inferred_schedule: explicitSchedule === null,
  };
}

function titleFromDocumentCode(code: string): string {
  return code
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

/** Legacy catalogue seeds store document codes as strings; expand to checklist objects. */
export function normalizeDocumentChecklist(value: unknown): DocumentChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    if (typeof item === 'string') {
      const code = item.trim() || `document-${index + 1}`;
      const label = titleFromDocumentCode(code);
      return {
        code,
        label: { en: label },
        required: true,
        accept: ['application/pdf', 'image/jpeg'],
        max_size_mb: 5,
      };
    }
    if (!isRecord(item)) {
      throw new BadRequestException('Document checklist item must be an object');
    }
    const code =
      typeof item.code === 'string' && item.code.trim() ? item.code : `document-${index + 1}`;
    const label = isRecord(item.label)
      ? {
          en:
            typeof item.label.en === 'string' && item.label.en.trim()
              ? item.label.en
              : titleFromDocumentCode(code),
          ...(typeof item.label.bn === 'string' && item.label.bn.trim()
            ? { bn: item.label.bn }
            : {}),
          ...(typeof item.label.hi === 'string' && item.label.hi.trim()
            ? { hi: item.label.hi }
            : {}),
        }
      : { en: titleFromDocumentCode(code) };
    const accept = Array.isArray(item.accept)
      ? item.accept.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry))
      : ['application/pdf', 'image/jpeg'];
    const maxSize = Number(item.max_size_mb);
    return {
      code,
      label,
      required: typeof item.required === 'boolean' ? item.required : true,
      accept: accept.length > 0 ? accept : ['application/pdf', 'image/jpeg'],
      max_size_mb: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 5,
    };
  });
}

export function assertValidDocumentChecklist(
  value: unknown,
): asserts value is DocumentChecklistItem[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Document checklist must be an array');
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) {
      throw new BadRequestException('Document checklist item must be an object');
    }
    assertCode(item.code, 'document code');
    if (seen.has(item.code)) {
      throw new BadRequestException(`Duplicate document code "${item.code}"`);
    }
    seen.add(item.code);
    assertLocaleLabel(item.label, 'document label');
    if (typeof item.required !== 'boolean') {
      throw new BadRequestException('Document required flag must be boolean');
    }
    if (!Array.isArray(item.accept) || !item.accept.every((x) => typeof x === 'string' && x)) {
      throw new BadRequestException('Document accept list must contain mime types');
    }
    assertNonNegativeInt(item.max_size_mb, 'document max_size_mb');
    if (item.max_size_mb <= 0 || item.max_size_mb > 25) {
      throw new BadRequestException('Document max_size_mb must be between 1 and 25');
    }
  }
}

export function assertValidTariffCategory(value: unknown): asserts value is TariffCategory {
  if (!['property', 'water', 'conservancy', 'sewerage'].includes(String(value))) {
    throw new BadRequestException('Unsupported tariff category');
  }
}

export function assertValidNotificationChannel(
  value: unknown,
): asserts value is NotificationChannel {
  if (!['push', 'sms', 'email', 'whatsapp'].includes(String(value))) {
    throw new BadRequestException('Unsupported notification channel');
  }
}

export function assertSupportedLocale(value: unknown): asserts value is SupportedLocale {
  if (!['en', 'bn', 'hi'].includes(String(value))) {
    throw new BadRequestException('Unsupported locale');
  }
}

export function assertTenantBannerSeverity(value: unknown): asserts value is TenantBannerSeverity {
  if (!['info', 'warning', 'critical'].includes(String(value))) {
    throw new BadRequestException('Unsupported banner severity');
  }
}

export function assertOptionalIsoDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be an ISO date string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be an ISO date string`);
  }
  return parsed;
}

export function assertValidNotificationVariables(
  variables: unknown,
  body: string,
  subject?: string | null,
): asserts variables is string[] {
  if (!Array.isArray(variables) || !variables.every((item) => typeof item === 'string')) {
    throw new BadRequestException('Template variables must be an array of strings');
  }
  const unique = new Set<string>();
  for (const variable of variables) {
    assertTemplateVariable(variable);
    unique.add(variable);
  }
  if (unique.size !== variables.length) {
    throw new BadRequestException('Template variables must be unique');
  }

  const templateText = `${subject ?? ''}\n${body}`;
  const placeholders = [...templateText.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)]
    .map((match) => match[1])
    .filter((value): value is string => typeof value === 'string');
  for (const placeholder of placeholders) {
    if (!unique.has(placeholder)) {
      throw new BadRequestException(`Template placeholder "${placeholder}" is not declared`);
    }
  }
}

export function assertValidBranding(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BadRequestException('branding must be an object');
  }
  if (value.theme_color !== undefined && !isHexColor(value.theme_color)) {
    throw new BadRequestException('branding.theme_color must be a #RRGGBB color');
  }
  if (value.logo_url !== undefined && !isOptionalUrl(value.logo_url)) {
    throw new BadRequestException('branding.logo_url must be a URL or empty string');
  }
  if (value.hero_image_url !== undefined && !isOptionalUrl(value.hero_image_url)) {
    throw new BadRequestException('branding.hero_image_url must be a URL or empty string');
  }
}

export function assertValidFeatureFlags(value: unknown): asserts value is Record<string, boolean> {
  if (!isRecord(value)) {
    throw new BadRequestException('feature_flags must be an object');
  }
  for (const [key, enabled] of Object.entries(value)) {
    assertFeatureFlagCode(key);
    if (typeof enabled !== 'boolean') {
      throw new BadRequestException(`feature flag "${key}" must be boolean`);
    }
  }
}

export function assertValidKbArticleStatus(value: unknown): asserts value is KbArticleStatus {
  if (!['draft', 'published', 'archived'].includes(String(value))) {
    throw new BadRequestException('Unsupported KB article status');
  }
}

export function assertValidLocalizedMarkdown(value: unknown, field: string): void {
  assertLocaleLabel(value, field);
  const body = value as Record<string, unknown>;
  for (const [locale, text] of Object.entries(body)) {
    assertSupportedLocale(locale);
    if (typeof text !== 'string' || !text.trim()) {
      throw new BadRequestException(`${field}.${locale} must be a non-empty string`);
    }
    if (/<script[\s>]/i.test(text)) {
      throw new BadRequestException(`${field}.${locale} cannot contain script tags`);
    }
  }
}

export function assertValidTagList(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new BadRequestException('tags must be an array of at most 20 values');
  }
  const seen = new Set<string>();
  for (const tag of value) {
    assertCode(tag, 'tag');
    seen.add(tag);
  }
  if (seen.size !== value.length) {
    throw new BadRequestException('tags must be unique');
  }
}

export function assertValidLanguageList(value: unknown): asserts value is SupportedLocale[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('languages_enabled must be a non-empty array');
  }
  for (const locale of value) {
    assertSupportedLocale(locale);
  }
}

export function assertLocaleLabel(value: unknown, field: string): asserts value is LocaleLabel {
  if (!isRecord(value) || typeof value.en !== 'string' || !value.en.trim()) {
    throw new BadRequestException(`${field} must include an English label`);
  }
}

export function assertCode(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)) {
    throw new BadRequestException(`${field} must be kebab-case`);
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function assertTemplateVariable(value: unknown): asserts value is string {
  assertNonEmptyString(value, 'template variable');
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new BadRequestException('template variable must be snake_case');
  }
}

function assertFeatureFlagCode(value: unknown): asserts value is string {
  assertNonEmptyString(value, 'feature flag');
  if (!/^[a-z][a-z0-9_-]*$/.test(value)) {
    throw new BadRequestException('feature flag must be snake_case or kebab-case');
  }
}

function isOptionalUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (!value.trim()) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function assertPositiveNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
}

function assertNonNegativeInt(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
