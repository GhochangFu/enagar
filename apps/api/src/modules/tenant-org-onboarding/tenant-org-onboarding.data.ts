import type {
  LocalizedLabel,
  TenantOrgDesignationImport,
  TenantOrgImport,
} from './tenant-org-onboarding.types';

function loc(en: string): LocalizedLabel {
  return { en, bn: en, hi: en };
}

function deptDesignation(
  department_code: string,
  code: string,
  name: string,
  options?: { is_department_head?: boolean },
): TenantOrgDesignationImport {
  return {
    code,
    name: loc(name),
    scope: 'department',
    department_code,
    is_department_head: options?.is_department_head ?? false,
    can_reject_municipal: false,
  };
}

/** Appendix A — 24 standard ULB departments. */
export const STANDARD_DEPARTMENTS: TenantOrgImport['departments'] = [
  { code: 'public-works', name: loc('Public Works Department'), sort_order: 10 },
  { code: 'water-works', name: loc('Water Works Department'), sort_order: 20 },
  { code: 'public-health', name: loc('Public Health and Convenience'), sort_order: 30 },
  { code: 'birth-death', name: loc('Birth and Death'), sort_order: 40 },
  { code: 'collection', name: loc('Collection Department'), sort_order: 50 },
  { code: 'trade-licence', name: loc('Certificate for Enlistment of Trade'), sort_order: 60 },
  { code: 'assessment', name: loc('Assessment Department'), sort_order: 70 },
  { code: 'general', name: loc('General Department'), sort_order: 80 },
  { code: 'accounts', name: loc('Accounts Department'), sort_order: 90 },
  { code: 'health', name: loc('Health'), sort_order: 100 },
  { code: 'conservancy', name: loc('Conservancy / Sanitation'), sort_order: 110 },
  {
    code: 'swm',
    name: loc('Environment / Solid Waste Management (SWM)'),
    sort_order: 120,
  },
  { code: 'transport', name: loc('Vehicle / Transport Section'), sort_order: 130 },
  { code: 'building', name: loc('Building Plan / Building Department'), sort_order: 140 },
  { code: 'market', name: loc('Market Department'), sort_order: 150 },
  { code: 'stores', name: loc('Store / Purchase Department'), sort_order: 160 },
  { code: 'it-planning', name: loc('IT & Planning Section'), sort_order: 170 },
  { code: 'nuhm', name: loc('NUHM'), sort_order: 180 },
  { code: 'nulm', name: loc('NULM'), sort_order: 190 },
  { code: 'pmay', name: loc('PMAY'), sort_order: 200 },
  {
    code: 'advertisement-hoarding',
    name: loc('Advertisement & Hoarding Cell'),
    sort_order: 210,
  },
  { code: 'parking', name: loc('Parking Management Cell'), sort_order: 220 },
  { code: 'disaster', name: loc('Disaster Management Cell'), sort_order: 230 },
  { code: 'procurement', name: loc('Procurement & Stores'), sort_order: 240 },
];

const MUNICIPAL_DESIGNATIONS: TenantOrgDesignationImport[] = [
  {
    code: 'board_of_councillors',
    name: loc('Board of Councillors'),
    scope: 'municipality',
    department_code: null,
  },
  {
    code: 'executive_officer',
    name: loc('Executive Officer'),
    scope: 'municipality',
    department_code: null,
  },
  {
    code: 'cic',
    name: loc('Commissioner in Council'),
    scope: 'municipality',
    department_code: null,
  },
  {
    code: 'vice_chairperson',
    name: loc('Vice-Chairperson'),
    scope: 'municipality',
    department_code: null,
  },
  {
    code: 'chairperson',
    name: loc('Chairperson'),
    scope: 'municipality',
    department_code: null,
    can_reject_municipal: true,
  },
];

/** Appendix B sample designations + hoarding pilot roles (Pattern C). */
const APPENDIX_B_DEPARTMENT_DESIGNATIONS: TenantOrgDesignationImport[] = [
  deptDesignation('public-works', 'pwd_junior_engineer', 'Junior Engineer'),
  deptDesignation('public-works', 'pwd_assistant_engineer', 'Assistant Engineer'),
  deptDesignation('public-works', 'pwd_executive_engineer', 'Executive Engineer', {
    is_department_head: true,
  }),
  deptDesignation('water-works', 'water_assistant_engineer', 'Assistant Engineer'),
  deptDesignation('water-works', 'water_sub_assistant_engineer', 'Sub-Assistant Engineer'),
  deptDesignation('water-works', 'water_pump_operator', 'Pump Operator'),
  deptDesignation('water-works', 'water_supply_supervisor', 'Water Supply Supervisor'),
  deptDesignation('water-works', 'water_meter_reader', 'Meter Reader'),
  deptDesignation('assessment', 'assessment_officer', 'Assessment Officer'),
  deptDesignation('assessment', 'assessment_revenue_officer', 'Revenue Officer'),
  deptDesignation('assessment', 'assessment_dealing_assistant', 'Dealing Assistant'),
  deptDesignation('assessment', 'assessment_inspector', 'Assessment Inspector'),
  deptDesignation('assessment', 'assessment_tax_surveyor', 'Tax Surveyor'),
  deptDesignation('assessment', 'assessment_data_entry', 'Data Entry Operator'),
  deptDesignation('collection', 'collection_revenue_officer', 'Revenue Officer'),
  deptDesignation('collection', 'collection_tax_collector', 'Tax Collector'),
  deptDesignation('collection', 'collection_sarkar', 'Collection Sarkar'),
  deptDesignation('collection', 'collection_cashier', 'Cashier'),
  deptDesignation('collection', 'collection_dealing_assistant', 'Dealing Assistant'),
  deptDesignation('trade-licence', 'trade_license_inspector', 'License Inspector'),
  deptDesignation('trade-licence', 'trade_license_clerk', 'License Clerk'),
  deptDesignation('trade-licence', 'trade_revenue_officer', 'Revenue Officer'),
  deptDesignation('trade-licence', 'trade_data_entry', 'Data Entry Operator'),
  deptDesignation('birth-death', 'bd_registrar', 'Registrar Birth & Death'),
  deptDesignation('birth-death', 'bd_sub_registrar', 'Sub-Registrar'),
  deptDesignation('birth-death', 'bd_registration_clerk', 'Registration Clerk'),
  deptDesignation('birth-death', 'bd_data_entry', 'Data Entry Operator'),
  deptDesignation('health', 'health_officer', 'Health Officer'),
  deptDesignation('health', 'health_sanitary_inspector', 'Sanitary Inspector'),
  deptDesignation('health', 'health_public_inspector', 'Public Health Inspector'),
  deptDesignation('health', 'health_medical_officer', 'Medical Officer'),
  deptDesignation('health', 'health_pharmacist', 'Pharmacist'),
  deptDesignation('health', 'health_lab_technician', 'Lab Technician'),
  deptDesignation('conservancy', 'conservancy_inspector', 'Conservancy Inspector'),
  deptDesignation('conservancy', 'conservancy_sanitary_supervisor', 'Sanitary Supervisor'),
  deptDesignation('conservancy', 'conservancy_mazdoor', 'Conservancy Mazdoor'),
  deptDesignation('conservancy', 'conservancy_driver', 'Driver'),
  deptDesignation('conservancy', 'conservancy_sweeper', 'Sweeper'),
  deptDesignation('swm', 'swm_supervisor', 'SWM Supervisor'),
  deptDesignation('advertisement-hoarding', 'hoarding_clerk', 'Hoarding Clerk'),
  deptDesignation('advertisement-hoarding', 'hoarding_inspector', 'Hoarding Inspector'),
  deptDesignation('advertisement-hoarding', 'hoarding_officer', 'Hoarding Officer', {
    is_department_head: true,
  }),
];

/** Default import applied on State wizard activate and `pnpm db:seed` org step. */
export const DEFAULT_TENANT_ORG_IMPORT: TenantOrgImport = {
  version: 1,
  departments: STANDARD_DEPARTMENTS,
  designations: [...MUNICIPAL_DESIGNATIONS, ...APPENDIX_B_DEPARTMENT_DESIGNATIONS],
};

export function parseTenantOrgImport(value: unknown): TenantOrgImport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Tenant org import must be a JSON object');
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.departments) || !Array.isArray(record.designations)) {
    throw new Error('Tenant org import requires departments[] and designations[]');
  }
  return {
    version: typeof record.version === 'number' ? record.version : 1,
    departments: record.departments as TenantOrgImport['departments'],
    designations: record.designations as TenantOrgImport['designations'],
  };
}
