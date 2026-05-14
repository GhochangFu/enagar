/**
 * Canonical category slug values for API + SLA routing ({@link apps/api grievances.service} accepts any non-empty category string).
 */
export const GRIEVANCE_CATEGORY_SLUGS = [
  'roads',
  'sanitation',
  'streetlights',
  'water',
  'drainage',
  'stray_dogs',
  'parks',
  'encroachment',
  'trade',
  'other',
] as const;

export type GrievanceCategorySlug = (typeof GRIEVANCE_CATEGORY_SLUGS)[number];
