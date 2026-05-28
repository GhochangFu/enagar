import type { ShowIfRule } from '../index';

export const TEXT_PATTERN_PRESETS = [
  { value: '', label: 'None' },
  { value: '^[6-9][0-9]{9}$', label: 'Mobile (India 10-digit)' },
  { value: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', label: 'Email' },
] as const;

export type ShowIfConditionKind = 'equals' | 'equals_any' | 'includes' | 'not_empty';

export function showIfConditionKind(rule: ShowIfRule | undefined): ShowIfConditionKind | null {
  if (!rule) {
    return null;
  }
  if (rule.not_empty) {
    return 'not_empty';
  }
  if (rule.includes !== undefined) {
    return 'includes';
  }
  if (rule.equals_any !== undefined && rule.equals_any.length > 0) {
    return 'equals_any';
  }
  if (rule.equals !== undefined) {
    return 'equals';
  }
  return null;
}

export function buildShowIfRule(
  controllingField: string,
  kind: ShowIfConditionKind,
  value: string,
  equalsAnyValues?: Array<string | number | boolean>,
): ShowIfRule {
  const rule: ShowIfRule = { field: controllingField };
  if (kind === 'not_empty') {
    rule.not_empty = true;
    return rule;
  }
  if (kind === 'includes') {
    rule.includes = value;
    return rule;
  }
  if (kind === 'equals_any') {
    rule.equals_any =
      equalsAnyValues ??
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    return rule;
  }
  rule.equals = value;
  return rule;
}

export function describeShowIf(rule: ShowIfRule): string {
  if (rule.not_empty) {
    return `${rule.field} is not empty`;
  }
  if (rule.includes !== undefined) {
    return `${rule.field} includes ${rule.includes}`;
  }
  if (rule.equals_any !== undefined && rule.equals_any.length > 0) {
    return `${rule.field} equals any of ${rule.equals_any.join(', ')}`;
  }
  if (rule.equals !== undefined) {
    return `${rule.field} = ${String(rule.equals)}`;
  }
  return rule.field;
}

export function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalNumber(value: string): number | undefined {
  return parseOptionalInt(value);
}
