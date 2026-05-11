export const CHALLAN_STATUSES = ['issued', 'paid', 'disputed', 'waived'] as const;

export type ChallanStatus = (typeof CHALLAN_STATUSES)[number];

const ALLOWED: Record<ChallanStatus, ChallanStatus[]> = {
  issued: ['paid', 'disputed', 'waived'],
  disputed: ['issued', 'waived', 'paid'],
  paid: [],
  waived: [],
};

export function assertChallanTransition(from: ChallanStatus, to: ChallanStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`Illegal challan transition ${from} → ${to}`);
  }
}

export function isChallanStatus(value: string): value is ChallanStatus {
  return (CHALLAN_STATUSES as readonly string[]).includes(value);
}
