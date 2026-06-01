export type LocalizedLabel = { en: string; bn: string; hi: string };

export type TenantOrgDepartmentImport = {
  code: string;
  name: LocalizedLabel;
  sort_order: number;
};

export type TenantOrgDesignationImport = {
  code: string;
  name: LocalizedLabel;
  scope: 'municipality' | 'department';
  department_code?: string | null;
  is_department_head?: boolean;
  can_reject_municipal?: boolean;
};

/** State onboarding / seed import payload (ADR-0011 Phase 14). */
export type TenantOrgImport = {
  version: number;
  departments: TenantOrgDepartmentImport[];
  designations: TenantOrgDesignationImport[];
};

export type TenantOrgProvisionResult = {
  departments_upserted: number;
  designations_upserted: number;
};
