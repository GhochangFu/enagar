import {
  applicationFeePaidForSubmit,
  buildInitialFeeSettlement,
  feeLineAllowsCitizenInitiate,
  hydrateApplicationPaymentSnapshot,
  migrateLegacyPaymentStatusToSettlement,
  patchFeeLineSettlement,
  rollupPaymentStatus,
  submitRequiresApplicationFee,
  resolvePayableFeeLineAmountPaise,
} from './fee-settlement.util';

describe('fee settlement rollup', () => {
  it('builds initial lines from resolved payment config', () => {
    const settlement = buildInitialFeeSettlement({
      payment_schedule: 'upfront_and_deferred',
      fee_lines: {},
      fee_line_previews: { application: 50_000, approval: 100_000 },
      inferred_schedule: false,
    });
    expect(settlement.application).toMatchObject({
      status: 'not_required',
      amount_paise: 50_000,
    });
    expect(settlement.approval).toMatchObject({
      status: 'not_required',
      amount_paise: 100_000,
    });
    expect(rollupPaymentStatus('upfront_and_deferred', settlement)).toBe('not_required');
  });

  it('rolls up pending when any line is pending', () => {
    const settlement = patchFeeLineSettlement(
      'upfront_and_deferred',
      buildInitialFeeSettlement({
        payment_schedule: 'upfront_and_deferred',
        fee_lines: {},
        fee_line_previews: { application: 50_000, approval: 100_000 },
        inferred_schedule: false,
      }),
      'approval',
      { status: 'pending', payment_id: 'pay-1' },
    );
    expect(rollupPaymentStatus('upfront_and_deferred', settlement)).toBe('pending');
  });

  it('rolls up paid when all required lines are paid', () => {
    let settlement = buildInitialFeeSettlement({
      payment_schedule: 'upfront_only',
      fee_lines: {},
      fee_line_previews: { application: 5000 },
      inferred_schedule: false,
    });
    settlement = patchFeeLineSettlement('upfront_only', settlement, 'application', {
      status: 'paid',
      payment_id: 'pay-1',
    });
    expect(rollupPaymentStatus('upfront_only', settlement)).toBe('paid');
  });
});

describe('submit application fee gate', () => {
  it('requires application fee for upfront schedules', () => {
    expect(submitRequiresApplicationFee('upfront_only')).toBe(true);
    expect(submitRequiresApplicationFee('upfront_and_deferred')).toBe(true);
    expect(submitRequiresApplicationFee('deferred_only')).toBe(false);
  });

  it('blocks submit until application line is paid', () => {
    const unpaid = buildInitialFeeSettlement({
      payment_schedule: 'upfront_only',
      fee_lines: {},
      fee_line_previews: { application: 5000 },
      inferred_schedule: false,
    });
    expect(applicationFeePaidForSubmit('upfront_only', unpaid)).toBe(false);

    const paid = patchFeeLineSettlement('upfront_only', unpaid, 'application', {
      status: 'paid',
      payment_id: 'pay-1',
    });
    expect(applicationFeePaidForSubmit('upfront_only', paid)).toBe(true);
  });

  it('allows submit for free upfront services with zero application preview', () => {
    const freeDraft = buildInitialFeeSettlement({
      payment_schedule: 'upfront_only',
      fee_lines: {},
      fee_line_previews: { application: 0 },
      inferred_schedule: false,
    });
    expect(
      applicationFeePaidForSubmit('upfront_only', freeDraft, { applicationFeePreviewPaise: 0 }),
    ).toBe(true);
  });
});

describe('legacy payment snapshot hydration (Phase 13E)', () => {
  const dualConfig = {
    payment_schedule: 'upfront_and_deferred' as const,
    fee_lines: {},
    fee_line_previews: { application: 50_000, approval: 100_000 },
    inferred_schedule: false,
  };

  it('hydrates missing fee_settlement from legacy rollup payment_status', () => {
    const hydrated = hydrateApplicationPaymentSnapshot({ payment_status: 'pending' }, dualConfig);
    expect(hydrated.changed).toBe(true);
    expect(hydrated.payment_schedule).toBe('upfront_and_deferred');
    expect(hydrated.fee_settlement.approval?.status).toBe('pending');
    expect(hydrated.payment_status).toBe('pending');
  });

  it('preserves paid lines when merging fresh catalogue previews', () => {
    const existing = patchFeeLineSettlement(
      'upfront_only',
      buildInitialFeeSettlement({
        payment_schedule: 'upfront_only',
        fee_lines: {},
        fee_line_previews: { application: 5000 },
        inferred_schedule: false,
      }),
      'application',
      { status: 'paid', payment_id: 'pay-1' },
    );
    const hydrated = hydrateApplicationPaymentSnapshot(
      {
        payment_schedule: 'upfront_only',
        fee_settlement: existing,
        payment_status: 'paid',
      },
      {
        payment_schedule: 'upfront_only',
        fee_lines: {},
        fee_line_previews: { application: 5000 },
        inferred_schedule: false,
      },
    );
    expect(hydrated.fee_settlement.application?.status).toBe('paid');
    expect(hydrated.payment_status).toBe('paid');
  });

  it('maps legacy paid rollup to all required lines', () => {
    const settlement = migrateLegacyPaymentStatusToSettlement('deferred_only', 'paid', {
      payment_schedule: 'deferred_only',
      fee_lines: {},
      fee_line_previews: { approval: 100_000 },
      inferred_schedule: false,
    });
    expect(settlement.approval?.status).toBe('paid');
    expect(rollupPaymentStatus('deferred_only', settlement)).toBe('paid');
  });
});

describe('citizen initiate gates (ADR-0013 §13D)', () => {
  const approvalLine = {
    status: 'not_required' as const,
    payment_id: null,
    amount_paise: 100_000,
  };
  const pendingApproval = {
    status: 'pending' as const,
    payment_id: 'pay-1',
    amount_paise: 100_000,
  };
  const applicationLine = {
    status: 'not_required' as const,
    payment_id: null,
    amount_paise: 50_000,
  };

  it('blocks approval fee before desk link', () => {
    expect(feeLineAllowsCitizenInitiate('upfront_and_deferred', 'approval', approvalLine)).toBe(
      false,
    );
    expect(feeLineAllowsCitizenInitiate('deferred_only', 'approval', approvalLine)).toBe(false);
  });

  it('allows approval fee after desk link sets line pending', () => {
    expect(feeLineAllowsCitizenInitiate('upfront_and_deferred', 'approval', pendingApproval)).toBe(
      true,
    );
  });

  it('allows application fee on draft schedules', () => {
    expect(
      feeLineAllowsCitizenInitiate('upfront_and_deferred', 'application', applicationLine),
    ).toBe(true);
  });
});

describe('resolvePayableFeeLineAmountPaise', () => {
  const config = {
    payment_schedule: 'deferred_only' as const,
    fee_lines: {},
    fee_line_previews: { approval: 5_000_000 },
    inferred_schedule: false,
  };

  it('prefers settlement amount over catalogue preview', () => {
    const amount = resolvePayableFeeLineAmountPaise(config, 'approval', {
      approval: { status: 'not_required', payment_id: null, amount_paise: 6_800_000 },
    });
    expect(amount).toBe(6_800_000);
  });

  it('falls back to catalogue preview when settlement amount missing', () => {
    const amount = resolvePayableFeeLineAmountPaise(config, 'approval', {
      approval: { status: 'not_required', payment_id: null, amount_paise: null },
    });
    expect(amount).toBe(5_000_000);
  });
});
