export const GRIEVANCE_STATUSES = [
  'submitted',
  'under_review',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type GrievanceStatus = (typeof GRIEVANCE_STATUSES)[number];

const ALLOWED: Record<GrievanceStatus, GrievanceStatus[]> = {
  submitted: ['under_review', 'in_progress'],
  under_review: ['in_progress', 'resolved'],
  in_progress: ['under_review', 'resolved'],
  /** `under_review`: citizen Sprint 4.3 reopen (or staff admin correction via PATCH status). `closed`: staff-close / feedback-close path unchanged. */
  resolved: ['closed', 'under_review'],
  closed: [],
};

export function assertGrievanceTransition(from: GrievanceStatus, to: GrievanceStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`Illegal grievance transition ${from} → ${to}`);
  }
}

export function isGrievanceStatus(v: string): v is GrievanceStatus {
  return (GRIEVANCE_STATUSES as readonly string[]).includes(v);
}
