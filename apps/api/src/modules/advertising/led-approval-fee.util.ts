import { AD_LED_SERVICE_CODE, parseLedBookingSnapshot } from './led-booking-quote.util';

import type { FeeSettlementSnapshot } from '../payments/fee-settlement.util';

export type LedApprovalFeeBreakdown = {
  rent_paise: number;
  deposit_paise: number;
  total_approval_paise: number;
  has_booking_snapshot: boolean;
};

const MAX_COMBINED_APPROVAL_PAISE = 2_147_483_647;

export function resolveLedApprovalFeeBreakdown(
  formData: Record<string, unknown>,
): LedApprovalFeeBreakdown | null {
  const snapshot = parseLedBookingSnapshot(formData);
  if (!snapshot) {
    return null;
  }
  const total = snapshot.rent_paise + snapshot.deposit_paise;
  if (!Number.isFinite(total) || total <= 0 || total > MAX_COMBINED_APPROVAL_PAISE) {
    return null;
  }
  return {
    rent_paise: snapshot.rent_paise,
    deposit_paise: snapshot.deposit_paise,
    total_approval_paise: total,
    has_booking_snapshot: true,
  };
}

export function applyLedBookingToApprovalSettlement(
  settlement: FeeSettlementSnapshot,
  serviceCode: string,
  formData: Record<string, unknown>,
): FeeSettlementSnapshot {
  if (serviceCode !== AD_LED_SERVICE_CODE) {
    return settlement;
  }
  const breakdown = resolveLedApprovalFeeBreakdown(formData);
  if (!breakdown) {
    return settlement;
  }
  const approval = settlement.approval ?? {
    status: 'not_required' as const,
    payment_id: null,
    amount_paise: null,
  };
  return {
    ...settlement,
    approval: {
      ...approval,
      amount_paise: breakdown.total_approval_paise,
    },
  };
}
