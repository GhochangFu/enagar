import { AD_HOARDING_SERVICE_CODE } from './hoarding-rate.util';
import { parseHoardingCalculatorSnapshot } from './hoarding-quote.util';

import type { FeeSettlementSnapshot } from '../payments/fee-settlement.util';

export type HoardingApprovalFeeBreakdown = {
  base_permission_fee_paise: number;
  hoarding_tax_paise: number;
  total_approval_paise: number;
  has_calculator_snapshot: boolean;
};

const MAX_COMBINED_APPROVAL_PAISE = 2_147_483_647;

export function resolveHoardingApprovalFeeBreakdown(
  baseApprovalPaise: number,
  formData: Record<string, unknown>,
): HoardingApprovalFeeBreakdown | null {
  const snapshot = parseHoardingCalculatorSnapshot(formData);
  if (!snapshot) {
    return null;
  }
  const hoarding_tax_paise = snapshot.tax_paise;
  const total_approval_paise = baseApprovalPaise + hoarding_tax_paise;
  if (!Number.isFinite(total_approval_paise) || total_approval_paise > MAX_COMBINED_APPROVAL_PAISE) {
    return null;
  }
  return {
    base_permission_fee_paise: baseApprovalPaise,
    hoarding_tax_paise,
    total_approval_paise,
    has_calculator_snapshot: true,
  };
}

export function applyHoardingTaxToApprovalSettlement(
  settlement: FeeSettlementSnapshot,
  serviceCode: string,
  baseApprovalPaise: number | null | undefined,
  formData: Record<string, unknown>,
): FeeSettlementSnapshot {
  if (serviceCode !== AD_HOARDING_SERVICE_CODE) {
    return settlement;
  }
  if (typeof baseApprovalPaise !== 'number' || baseApprovalPaise < 0) {
    return settlement;
  }
  const breakdown = resolveHoardingApprovalFeeBreakdown(baseApprovalPaise, formData);
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
