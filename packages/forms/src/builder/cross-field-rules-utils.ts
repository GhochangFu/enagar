import type { CrossFieldCompareOp, CrossFieldRule } from '../index';

export const CROSS_FIELD_COMPARE_OPS: Array<{ value: CrossFieldCompareOp; label: string }> = [
  { value: 'gt_field', label: 'After' },
  { value: 'gte_field', label: 'On or after' },
  { value: 'lt_field', label: 'Before' },
  { value: 'lte_field', label: 'On or before' },
  { value: 'eq_field', label: 'Equals' },
];

export function nextCrossFieldRuleId(existing: CrossFieldRule[]): string {
  let sequence = existing.length + 1;
  while (existing.some((rule) => rule.id === `cross_rule_${sequence}`)) {
    sequence += 1;
  }
  return `cross_rule_${sequence}`;
}

export function describeCrossFieldRule(rule: CrossFieldRule): string {
  const op = CROSS_FIELD_COMPARE_OPS.find((entry) => entry.value === rule.op)?.label ?? rule.op;
  return `${rule.left} ${op.toLowerCase()} ${rule.right}`;
}
