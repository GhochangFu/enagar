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

export type TariffCategory = 'property' | 'water' | 'conservancy' | 'sewerage';
export type NotificationChannel = 'push' | 'sms' | 'email' | 'whatsapp';
export type SupportedLocale = 'en' | 'bn' | 'hi';
export type KbArticleStatus = 'draft' | 'published' | 'archived';

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
