export const REFUND_DISPATCH_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'completed_without_psp',
] as const;

export type RefundDispatchStatus = (typeof REFUND_DISPATCH_STATUSES)[number];

const ALLOWED: Record<RefundDispatchStatus, RefundDispatchStatus[]> = {
  pending_review: ['approved', 'rejected'],
  approved: ['completed_without_psp'],
  rejected: [],
  completed_without_psp: [],
};

export function assertRefundDispatchTransition(
  from: RefundDispatchStatus,
  to: RefundDispatchStatus,
): void {
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`Illegal refund dispatch transition ${from} → ${to}`);
  }
}

export function isRefundDispatchStatus(value: string): value is RefundDispatchStatus {
  return (REFUND_DISPATCH_STATUSES as readonly string[]).includes(value);
}
