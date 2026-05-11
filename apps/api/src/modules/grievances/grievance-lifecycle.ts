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
  resolved: ['closed'],
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
