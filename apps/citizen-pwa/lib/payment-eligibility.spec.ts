import {
  applicationFeePaid,
  citizenMayInitiatePayment,
  citizenPaymentAwaitingDeptLink,
  effectivePaymentRollup,
  resolveCitizenPaymentTarget,
} from './payment-eligibility';

describe('payment eligibility (ADR-0013)', () => {
  it('targets application fee on draft for upfront schedules', () => {
    const target = resolveCitizenPaymentTarget({
      current_stage: 'draft',
      status: 'draft',
      payment_status: 'not_required',
      payment_schedule: 'upfront_only',
      fee_settlement: {
        application: { status: 'not_required', amount_paise: 5000 },
      },
    });
    expect(target).toEqual({ feeCode: 'application', amountPaise: 5000 });
    expect(
      citizenMayInitiatePayment({
        current_stage: 'draft',
        status: 'draft',
        payment_status: 'not_required',
        payment_schedule: 'upfront_only',
        fee_settlement: { application: { status: 'not_required' } },
      }),
    ).toBe(true);
  });

  it('does not initiate application fee for deferred-only', () => {
    expect(
      citizenMayInitiatePayment({
        current_stage: 'draft',
        status: 'draft',
        payment_status: 'not_required',
        payment_schedule: 'deferred_only',
      }),
    ).toBe(false);
  });

  it('awaits dept link for deferred-only before approval line is issued', () => {
    const app = {
      current_stage: 'clerk-verification',
      payment_status: 'not_required',
      payment_schedule: 'deferred_only' as const,
      fee_settlement: {
        approval: { status: 'not_required' as const },
      },
    };
    expect(citizenPaymentAwaitingDeptLink(app)).toBe(true);
    expect(citizenMayInitiatePayment(app)).toBe(false);
  });

  it('awaits dept link for approval after application paid (dual)', () => {
    const app = {
      current_stage: 'maker-review',
      payment_status: 'not_required',
      payment_schedule: 'upfront_and_deferred' as const,
      fee_settlement: {
        application: { status: 'paid' as const },
        approval: { status: 'not_required' as const },
      },
    };
    expect(applicationFeePaid(app)).toBe(true);
    expect(citizenPaymentAwaitingDeptLink(app)).toBe(true);
    expect(citizenMayInitiatePayment(app)).toBe(false);
  });

  it('allows approval fee at payment-pending', () => {
    const app = {
      current_stage: 'payment-pending',
      payment_status: 'pending',
      payment_schedule: 'deferred_only' as const,
      active_payment_id: 'pay-1',
      fee_settlement: {
        approval: { status: 'pending' as const, amount_paise: 1000 },
      },
    };
    expect(resolveCitizenPaymentTarget(app)?.feeCode).toBe('approval');
    expect(citizenMayInitiatePayment(app)).toBe(true);
    expect(citizenPaymentAwaitingDeptLink(app)).toBe(false);
  });

  it('derives display rollup from fee_settlement when present', () => {
    expect(
      effectivePaymentRollup({
        current_stage: 'payment-pending',
        payment_status: 'not_required',
        fee_settlement: {
          approval: { status: 'pending' as const },
        },
      }),
    ).toBe('pending');
  });
});
