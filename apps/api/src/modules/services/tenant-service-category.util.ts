/**
 * Maps global service_categories.code (seed) to citizen navigation codes (14) and default departments.
 * See docs/service-catalogue.md §2 and docs/workflow-designations.md Appendix A.
 */

/** Citizen PWA / spec navigation category codes (14). */
export type GlobalNavigationCategoryCode =
  | 'cert'
  | 'tax'
  | 'water'
  | 'building'
  | 'health'
  | 'adv'
  | 'rent'
  | 'smart'
  | 'tender'
  | 'fines'
  | 'info'
  | 'misc'
  | 'welfare';

const SEED_CODE_TO_NAV: Record<string, GlobalNavigationCategoryCode> = {
  certificates: 'cert',
  'tax-property': 'tax',
  'water-sanitation': 'water',
  'building-plan': 'building',
  'trade-licence': 'cert',
  health: 'health',
  welfare: 'welfare',
  grievances: 'misc',
  bookings: 'rent',
  'parking-transport': 'smart',
  advertising: 'adv',
  tenders: 'tender',
  'fines-challans': 'fines',
  rti: 'info',
};

const NAV_TO_DEPARTMENT: Record<GlobalNavigationCategoryCode, string> = {
  cert: 'birth-death',
  tax: 'assessment',
  water: 'water-works',
  building: 'building',
  health: 'health',
  adv: 'advertisement-hoarding',
  rent: 'market',
  smart: 'parking',
  tender: 'procurement',
  fines: 'collection',
  info: 'general',
  misc: 'general',
  welfare: 'nulm',
};

export function toGlobalNavigationCategoryCode(seedCategoryCode: string): string {
  const normalized = seedCategoryCode.trim().toLowerCase();
  return SEED_CODE_TO_NAV[normalized] ?? normalized;
}

export function defaultDepartmentCodeForGlobalCategory(globalCategoryCode: string): string {
  const nav = toGlobalNavigationCategoryCode(globalCategoryCode) as GlobalNavigationCategoryCode;
  return NAV_TO_DEPARTMENT[nav] ?? 'general';
}

export function tenantServiceCategoryCodeForGlobal(globalCategoryCode: string): string {
  return toGlobalNavigationCategoryCode(globalCategoryCode);
}
