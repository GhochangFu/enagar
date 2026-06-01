import type { PaymentSchedule } from './service-payment';

type FeeLineStatus = 'not_required' | 'pending' | 'paid' | 'failed';

type FeeSettlement = Partial<
  Record<
    'application' | 'approval',
    {
      status: FeeLineStatus;
      payment_id?: string | null;
      amount_paise?: number | null;
    }
  >
>;

type ApplicationPaymentShape = {
  current_stage: string;
  status?: string;
  payment_status: string;
  payment_schedule?: PaymentSchedule;
  fee_settlement?: FeeSettlement;
  payment_redirect_url?: string | null;
  active_payment_id?: string | null;
};

export type CitizenPaymentTarget = {
  feeCode: 'application' | 'approval';
  amountPaise: number | null;
};

export function applicationFeePaid(application: ApplicationPaymentShape): boolean {
  return application.fee_settlement?.application?.status === 'paid';
}

function approvalLineOpen(line: FeeSettlement['approval']): boolean {
  return line?.status === 'pending' || line?.status === 'failed';
}

function approvalPaymentIssued(application: ApplicationPaymentShape): boolean {
  const line = application.fee_settlement?.approval;
  return (
    application.current_stage === 'payment-pending' ||
    Boolean(application.payment_redirect_url?.trim()) ||
    Boolean(application.active_payment_id?.trim()) ||
    approvalLineOpen(line)
  );
}

export function resolveCitizenPaymentTarget(
  application: ApplicationPaymentShape,
): CitizenPaymentTarget | null {
  const schedule = application.payment_schedule;

  if (application.current_stage === 'draft' || application.status === 'draft') {
    if (schedule === 'deferred_only') {
      return null;
    }
    const line = application.fee_settlement?.application;
    if (line?.status === 'paid') {
      return null;
    }
    if (typeof line?.amount_paise === 'number' && line.amount_paise <= 0) {
      return null;
    }
    if (line?.status === 'pending' || line?.status === 'failed') {
      return {
        feeCode: 'application',
        amountPaise: line.amount_paise ?? null,
      };
    }
    if (schedule === 'upfront_only' || schedule === 'upfront_and_deferred' || !schedule) {
      return {
        feeCode: 'application',
        amountPaise: line?.amount_paise ?? null,
      };
    }
  }

  if (schedule === 'upfront_only') {
    return null;
  }

  const approvalLine = application.fee_settlement?.approval;
  if (approvalPaymentIssued(application)) {
    return {
      feeCode: 'approval',
      amountPaise: approvalLine?.amount_paise ?? null,
    };
  }

  return null;
}

/** Citizen may pay when the active fee line is open (ADR-0013 + ADR-0012 desk link). */
export function citizenMayInitiatePayment(
  application: ApplicationPaymentShape,
  options?: { feeCode?: 'application' | 'approval' },
): boolean {
  const target = resolveCitizenPaymentTarget(application);
  const feeCode = options?.feeCode ?? target?.feeCode;
  if (!feeCode) {
    return false;
  }
  if (target && target.feeCode !== feeCode) {
    return false;
  }

  if (feeCode === 'application') {
    if (application.payment_schedule === 'deferred_only') {
      return false;
    }
    const line = application.fee_settlement?.application;
    if (typeof line?.amount_paise === 'number' && line.amount_paise <= 0) {
      return false;
    }
    return line?.status === 'not_required' || line?.status === 'failed';
  }

  const line = application.fee_settlement?.approval;
  if (line?.status === 'paid') {
    return false;
  }
  if (approvalLineOpen(line)) {
    return true;
  }
  return approvalPaymentIssued(application);
}

export function citizenPaymentAwaitingDeptLink(application: ApplicationPaymentShape): boolean {
  const schedule = application.payment_schedule;
  if (schedule === 'upfront_only') {
    return false;
  }
  if (
    application.current_stage === 'payment-pending' ||
    application.current_stage === 'payment-received'
  ) {
    return false;
  }
  if (application.active_payment_id?.trim() || application.payment_redirect_url?.trim()) {
    return false;
  }

  const approvalStatus = application.fee_settlement?.approval?.status;
  if (schedule === 'upfront_and_deferred') {
    return applicationFeePaid(application) && approvalStatus === 'not_required';
  }

  if (schedule === 'deferred_only') {
    return approvalStatus === 'not_required';
  }

  return approvalStatus !== 'paid';
}

/** Prefer per-line settlement rollup for display when fee_settlement is present (Phase 13E). */
export function effectivePaymentRollup(application: ApplicationPaymentShape): string {
  const settlement = application.fee_settlement;
  if (!settlement) {
    return application.payment_status;
  }

  const lines = [settlement.application, settlement.approval].filter(Boolean);
  if (lines.some((line) => line?.status === 'pending')) {
    return 'pending';
  }
  if (lines.some((line) => line?.status === 'failed')) {
    return 'failed';
  }
  if (lines.length > 0 && lines.every((line) => line?.status === 'paid')) {
    return 'paid';
  }
  return application.payment_status;
}
