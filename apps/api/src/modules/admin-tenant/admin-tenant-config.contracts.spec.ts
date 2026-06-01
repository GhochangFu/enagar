import { BadRequestException } from '@nestjs/common';

import {
  assertValidPaymentSchedule,
  inferPaymentSchedule,
  migrateLegacyFeeRuleToFeeLines,
  normalizeDocumentChecklist,
  resolveServicePaymentConfig,
  workflowInfersDeferredPaymentSchedule,
} from './admin-tenant-config.contracts';

describe('payment schedule contracts', () => {
  const fixedRule = { type: 'fixed' as const, amount_paise: 50_000, currency: 'INR' as const };

  it('validates schedule-specific fee line requirements', () => {
    expect(() =>
      assertValidPaymentSchedule('upfront_only', {
        application: { label: { en: 'Application fee' }, rule: fixedRule },
      }),
    ).not.toThrow();

    expect(() =>
      assertValidPaymentSchedule('deferred_only', {
        approval: { label: { en: 'Licence fee' }, rule: fixedRule },
      }),
    ).not.toThrow();

    expect(() =>
      assertValidPaymentSchedule('upfront_and_deferred', {
        application: { label: { en: 'Application fee' }, rule: fixedRule },
        approval: { label: { en: 'Licence fee' }, rule: fixedRule },
      }),
    ).not.toThrow();
  });

  it('rejects missing or extra fee lines for a schedule', () => {
    expect(() =>
      assertValidPaymentSchedule('upfront_only', {
        approval: { label: { en: 'Licence fee' }, rule: fixedRule },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertValidPaymentSchedule('deferred_only', {
        application: { label: { en: 'Application fee' }, rule: fixedRule },
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertValidPaymentSchedule('upfront_and_deferred', {
        application: { label: { en: 'Application fee' }, rule: fixedRule },
      }),
    ).toThrow(BadRequestException);
  });

  it('migrates legacy fee_rule to the primary line for each schedule', () => {
    expect(migrateLegacyFeeRuleToFeeLines('upfront_only', fixedRule).application?.rule).toEqual(
      fixedRule,
    );
    expect(migrateLegacyFeeRuleToFeeLines('deferred_only', fixedRule).approval?.rule).toEqual(
      fixedRule,
    );
    expect(
      migrateLegacyFeeRuleToFeeLines('upfront_and_deferred', fixedRule).application?.rule,
    ).toEqual(fixedRule);
  });

  it('infers deferred schedule from payment-pending workflow block', () => {
    const workflow = {
      stages: [{ code: 'payment-pending' }],
      transitions: [{ effects: [{ type: 'generate_payment_link' }] }],
    };
    expect(workflowInfersDeferredPaymentSchedule(workflow)).toBe(true);
    expect(inferPaymentSchedule({}, workflow)).toBe('deferred_only');
  });

  it('resolves explicit override config and previews per line', () => {
    const resolved = resolveServicePaymentConfig(
      {
        payment_schedule: 'upfront_and_deferred',
        fee_lines: {
          application: { label: { en: 'Application fee' }, rule: fixedRule },
          approval: {
            label: { en: 'Licence fee' },
            rule: { type: 'fixed', amount_paise: 100_000, currency: 'INR' },
          },
        },
      },
      fixedRule,
      null,
    );

    expect(resolved.payment_schedule).toBe('upfront_and_deferred');
    expect(resolved.inferred_schedule).toBe(false);
    expect(resolved.fee_line_previews.application).toBe(50_000);
    expect(resolved.fee_line_previews.approval).toBe(100_000);
  });

  it('migrates legacy fee_rule when schedule is omitted', () => {
    const resolved = resolveServicePaymentConfig({}, fixedRule, null);
    expect(resolved.payment_schedule).toBe('upfront_only');
    expect(resolved.inferred_schedule).toBe(true);
    expect(resolved.fee_lines.application?.rule).toEqual(fixedRule);
    expect(resolved.fee_line_previews.application).toBe(50_000);
  });
});

describe('document checklist contracts', () => {
  it('normalizes legacy string codes from catalogue seeds', () => {
    const normalized = normalizeDocumentChecklist(['site-photo', 'creative-mock', 'address-proof']);
    expect(normalized).toHaveLength(3);
    expect(normalized[0]).toMatchObject({
      code: 'site-photo',
      label: { en: 'Site Photo' },
      required: true,
      accept: ['application/pdf', 'image/jpeg'],
      max_size_mb: 5,
    });
  });
});
