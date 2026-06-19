import {
  type FeeLineCode,
  type PaymentSchedule,
  type ResolvedServicePaymentConfig,
  requiredFeeLineCodes,
} from '../admin-tenant/admin-tenant-config.contracts';

export type FeeLineSettlementStatus = 'not_required' | 'pending' | 'paid' | 'failed';

export type FeeLineSettlement = {
  status: FeeLineSettlementStatus;
  payment_id: string | null;
  amount_paise: number | null;
};

export type FeeSettlementSnapshot = Partial<Record<FeeLineCode, FeeLineSettlement>>;

export type ApplicationPaymentRollup = 'not_required' | 'pending' | 'paid' | 'failed';

export const FEE_LINE_CODES = ['application', 'approval'] as const;

export function parseFeeLineCode(
  value: unknown,
  fallback: FeeLineCode = 'application',
): FeeLineCode {
  if (value === 'approval') {
    return 'approval';
  }
  if (value === 'application') {
    return 'application';
  }
  return fallback;
}

export function feeLineIsPaid(settlement: FeeSettlementSnapshot, feeCode: FeeLineCode): boolean {
  return settlement[feeCode]?.status === 'paid';
}

export function allRequiredFeeLinesPaid(
  schedule: PaymentSchedule,
  settlement: FeeSettlementSnapshot,
): boolean {
  return requiredFeeLineCodes(schedule).every((code) => feeLineIsPaid(settlement, code));
}

export function buildInitialFeeSettlement(
  payment: ResolvedServicePaymentConfig,
): FeeSettlementSnapshot {
  const settlement: FeeSettlementSnapshot = {};
  for (const code of requiredFeeLineCodes(payment.payment_schedule)) {
    settlement[code] = {
      status: 'not_required',
      payment_id: null,
      amount_paise: payment.fee_line_previews[code] ?? null,
    };
  }
  return settlement;
}

/**
 * Rollup rules (ADR-0013 §2):
 * - Any required line `pending` → `pending`
 * - Any required line `failed` → `failed`
 * - All required lines `paid` → `paid`
 * - Upfront application fee required but unpaid → `not_required`
 * - Deferred/dual approval fee not yet issued → `not_required`
 */
export function rollupPaymentStatus(
  schedule: PaymentSchedule,
  settlement: FeeSettlementSnapshot,
): ApplicationPaymentRollup {
  const required = requiredFeeLineCodes(schedule);
  if (required.length === 0) {
    return 'not_required';
  }

  if (required.some((code) => settlement[code]?.status === 'pending')) {
    return 'pending';
  }
  if (required.some((code) => settlement[code]?.status === 'failed')) {
    return 'failed';
  }
  if (required.every((code) => settlement[code]?.status === 'paid')) {
    return 'paid';
  }

  if (
    (schedule === 'upfront_only' || schedule === 'upfront_and_deferred') &&
    settlement.application?.status !== 'paid'
  ) {
    return 'not_required';
  }

  if (
    (schedule === 'deferred_only' || schedule === 'upfront_and_deferred') &&
    settlement.approval?.status !== 'paid'
  ) {
    return 'not_required';
  }

  return 'not_required';
}

export function patchFeeLineSettlement(
  _schedule: PaymentSchedule,
  settlement: FeeSettlementSnapshot,
  feeCode: FeeLineCode,
  patch: Partial<FeeLineSettlement>,
): FeeSettlementSnapshot {
  const current = settlement[feeCode] ?? {
    status: 'not_required' as const,
    payment_id: null,
    amount_paise: null,
  };
  const next: FeeSettlementSnapshot = {
    ...settlement,
    [feeCode]: {
      ...current,
      ...patch,
    },
  };
  return next;
}

export function feeLineAmountPaise(
  payment: ResolvedServicePaymentConfig,
  feeCode: FeeLineCode,
): number {
  const preview = payment.fee_line_previews[feeCode];
  if (typeof preview !== 'number' || !Number.isInteger(preview) || preview <= 0) {
    throw new Error(`Fee line "${feeCode}" is not payable as a fixed amount`);
  }
  return preview;
}

/** Prefer application settlement amount when desk/citizen collects a computed total (e.g. hoarding tax + permission fee). */
export function resolvePayableFeeLineAmountPaise(
  payment: ResolvedServicePaymentConfig,
  feeCode: FeeLineCode,
  settlement: FeeSettlementSnapshot,
): number {
  const line = settlement[feeCode];
  if (
    typeof line?.amount_paise === 'number' &&
    Number.isInteger(line.amount_paise) &&
    line.amount_paise > 0
  ) {
    return line.amount_paise;
  }
  return feeLineAmountPaise(payment, feeCode);
}

export function submitRequiresApplicationFee(schedule: PaymentSchedule): boolean {
  return schedule === 'upfront_only' || schedule === 'upfront_and_deferred';
}

/** Zero or missing application preview — free / non-payable upfront services (ADR-0013 §13E). */
export function applicationFeeIsPayable(
  applicationFeePreviewPaise: number | null | undefined,
): boolean {
  return typeof applicationFeePreviewPaise === 'number' && applicationFeePreviewPaise > 0;
}

/** True when submit is allowed for schedules that require an upfront application fee line. */
export function applicationFeePaidForSubmit(
  schedule: PaymentSchedule,
  settlement: FeeSettlementSnapshot,
  options?: { applicationFeePreviewPaise?: number | null },
): boolean {
  if (!submitRequiresApplicationFee(schedule)) {
    return true;
  }
  if (options && !applicationFeeIsPayable(options.applicationFeePreviewPaise)) {
    return true;
  }
  return settlement.application?.status === 'paid';
}

export type ApplicationPaymentSnapshotInput = {
  payment_schedule?: PaymentSchedule;
  fee_settlement?: FeeSettlementSnapshot;
  payment_status?: ApplicationPaymentRollup;
};

export type HydratedApplicationPaymentSnapshot = {
  payment_schedule: PaymentSchedule;
  fee_settlement: FeeSettlementSnapshot;
  payment_status: ApplicationPaymentRollup;
  changed: boolean;
};

function legacyPendingFeeLineCode(schedule: PaymentSchedule): FeeLineCode {
  return schedule === 'upfront_only' ? 'application' : 'approval';
}

/** Map pre-13B rollup `payment_status` onto per-line settlement when `fee_settlement` is absent. */
export function migrateLegacyPaymentStatusToSettlement(
  schedule: PaymentSchedule,
  legacyStatus: ApplicationPaymentRollup,
  paymentConfig: ResolvedServicePaymentConfig,
): FeeSettlementSnapshot {
  const settlement = buildInitialFeeSettlement({
    ...paymentConfig,
    payment_schedule: schedule,
  });

  if (legacyStatus === 'paid') {
    for (const code of requiredFeeLineCodes(schedule)) {
      const line = settlement[code];
      if (line) {
        settlement[code] = { ...line, status: 'paid' };
      }
    }
    return settlement;
  }

  if (legacyStatus === 'pending' || legacyStatus === 'failed') {
    const code = legacyPendingFeeLineCode(schedule);
    const line = settlement[code];
    if (line) {
      settlement[code] = { ...line, status: legacyStatus };
    }
  }

  return settlement;
}

function settlementEquivalent(left: FeeSettlementSnapshot, right: FeeSettlementSnapshot): boolean {
  for (const code of FEE_LINE_CODES) {
    const a = left[code];
    const b = right[code];
    if (!a && !b) {
      continue;
    }
    if (!a || !b) {
      return false;
    }
    if (
      a.status !== b.status ||
      a.payment_id !== b.payment_id ||
      a.amount_paise !== b.amount_paise
    ) {
      return false;
    }
  }
  return true;
}

/** Backfill schedule-driven defaults and sync rollup from per-line settlement (Phase 13E). */
export function hydrateApplicationPaymentSnapshot(
  input: ApplicationPaymentSnapshotInput,
  paymentConfig: ResolvedServicePaymentConfig,
): HydratedApplicationPaymentSnapshot {
  const payment_schedule = input.payment_schedule ?? paymentConfig.payment_schedule;
  const existing = coerceFeeSettlementSnapshot(input.fee_settlement);
  const fee_settlement =
    Object.keys(existing).length === 0
      ? migrateLegacyPaymentStatusToSettlement(
          payment_schedule,
          input.payment_status ?? 'not_required',
          paymentConfig,
        )
      : mergeFeeSettlementPreservingStatus(
          existing,
          buildInitialFeeSettlement({ ...paymentConfig, payment_schedule }),
        );
  const payment_status = rollupPaymentStatus(payment_schedule, fee_settlement);
  const changed =
    input.payment_schedule !== payment_schedule ||
    input.payment_status !== payment_status ||
    !settlementEquivalent(existing, fee_settlement);

  return { payment_schedule, fee_settlement, payment_status, changed };
}

export function applicationPaymentSnapshotIncomplete(
  input: ApplicationPaymentSnapshotInput,
): boolean {
  if (!input.payment_schedule) {
    return true;
  }
  const settlement = coerceFeeSettlementSnapshot(input.fee_settlement);
  if (Object.keys(settlement).length === 0) {
    return true;
  }
  const required = requiredFeeLineCodes(input.payment_schedule);
  if (required.some((code) => !settlement[code])) {
    return true;
  }
  const rolled = rollupPaymentStatus(input.payment_schedule, settlement);
  return input.payment_status !== rolled;
}

export function feeLineAllowsCitizenInitiate(
  schedule: PaymentSchedule,
  feeCode: FeeLineCode,
  line: FeeLineSettlement | undefined,
): boolean {
  if (!line) {
    return false;
  }
  if (feeCode === 'approval' && schedule === 'upfront_only') {
    return false;
  }
  if (feeCode === 'application' && schedule === 'deferred_only') {
    return false;
  }
  if (feeCode === 'application') {
    return line.status === 'not_required' || line.status === 'failed';
  }
  // Approval line: citizen pays only after desk `generate_payment_link` (ADR-0013 §5).
  return line.status === 'pending' || line.status === 'failed';
}

export function mergeFeeSettlementPreservingStatus(
  existing: FeeSettlementSnapshot | undefined,
  fresh: FeeSettlementSnapshot,
): FeeSettlementSnapshot {
  const merged: FeeSettlementSnapshot = { ...fresh };
  for (const code of FEE_LINE_CODES) {
    const prior = existing?.[code];
    if (!prior) {
      continue;
    }
    merged[code] = {
      status: prior.status,
      payment_id: prior.payment_id,
      amount_paise: fresh[code]?.amount_paise ?? prior.amount_paise,
    };
  }
  return merged;
}

export function applyFeeSettlementPatch(
  schedule: PaymentSchedule,
  settlement: FeeSettlementSnapshot,
  feeCode: FeeLineCode,
  patch: Partial<FeeLineSettlement>,
): { fee_settlement: FeeSettlementSnapshot; payment_status: ApplicationPaymentRollup } {
  const fee_settlement = patchFeeLineSettlement(schedule, settlement, feeCode, patch);
  return {
    fee_settlement,
    payment_status: rollupPaymentStatus(schedule, fee_settlement),
  };
}

export function coerceFeeSettlementSnapshot(value: unknown): FeeSettlementSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const settlement: FeeSettlementSnapshot = {};
  for (const code of FEE_LINE_CODES) {
    const raw = record[code];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }
    const line = raw as Record<string, unknown>;
    const status = line.status;
    settlement[code] = {
      status:
        status === 'pending' || status === 'paid' || status === 'failed' ? status : 'not_required',
      payment_id: typeof line.payment_id === 'string' ? line.payment_id : null,
      amount_paise:
        typeof line.amount_paise === 'number' && Number.isInteger(line.amount_paise)
          ? line.amount_paise
          : null,
    };
  }
  return settlement;
}
