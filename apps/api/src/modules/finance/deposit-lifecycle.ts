export const DEPOSIT_STATUSES = [
  'held',
  'eligible_for_release',
  'refund_pending_review',
  'refund_approved',
  'refunded',
  'forfeited',
] as const;

export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

const ALLOWED: Record<DepositStatus, DepositStatus[]> = {
  held: ['eligible_for_release', 'forfeited'],
  eligible_for_release: ['refund_pending_review', 'forfeited'],
  refund_pending_review: ['refund_approved', 'eligible_for_release'],
  refund_approved: ['refunded'],
  refunded: [],
  forfeited: [],
};

export function assertDepositTransition(from: DepositStatus, to: DepositStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`Illegal deposit transition ${from} → ${to}`);
  }
}

export function isDepositStatus(value: string): value is DepositStatus {
  return (DEPOSIT_STATUSES as readonly string[]).includes(value);
}
