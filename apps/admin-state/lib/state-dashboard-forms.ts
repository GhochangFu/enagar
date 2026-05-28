export type TenantDraft = {
  code: string;
  name: string;
  district: string;
  ward_count: string;
  theme_color: string;
  languages_enabled: string;
  status: string;
  inherit_default_services: string;
  default_language: string;
  support_email: string;
  service_category_codes: string[];
  grievance_category_codes: string[];
  tenant_admin_username: string;
  tenant_admin_email: string;
  tenant_admin_password: string;
  tenant_admin_first_name: string;
  tenant_admin_last_name: string;
};

export type LibraryDraft = {
  code: string;
  category_code: string;
  name_en: string;
  description_en: string;
  workflow_pattern: string;
  default_sla_days: string;
  fee_type: string;
  fee_amount_rupees: string;
  lifecycle_status: string;
  curator_notes: string;
  form_schema_json: string;
};

export type IntegrationDraft = {
  provider_key: string;
  environment: string;
  status: string;
  owner: string;
  notes: string;
  required_docs: string;
};

export const EMPTY_TENANT_DRAFT: TenantDraft = {
  code: '',
  name: '',
  district: '',
  ward_count: '',
  theme_color: '#0E7490',
  languages_enabled: 'en, bn',
  status: 'active',
  inherit_default_services: 'false',
  default_language: 'bn',
  support_email: '',
  service_category_codes: [],
  grievance_category_codes: [],
  tenant_admin_username: '',
  tenant_admin_email: '',
  tenant_admin_password: 'DummyDev_2026!ChangeMe',
  tenant_admin_first_name: 'Tenant',
  tenant_admin_last_name: 'Administrator',
};

export const EMPTY_LIBRARY_DRAFT: LibraryDraft = {
  code: 'community-hall-booking-state',
  category_code: 'municipal-services',
  name_en: 'Community Hall Booking',
  description_en: 'State-curated template for community hall booking.',
  workflow_pattern: 'single_window',
  default_sla_days: '7',
  fee_type: 'fixed',
  fee_amount_rupees: '500',
  lifecycle_status: 'draft',
  curator_notes: 'Sprint 6.12 smoke template.',
  form_schema_json: '{}',
};

export const EMPTY_INTEGRATION_DRAFT: IntegrationDraft = {
  provider_key: 'digilocker',
  environment: 'sandbox',
  status: 'manual_check_required',
  owner: 'DevOps',
  notes: 'Metadata only. Secrets remain outside eNagar.',
  required_docs: 'MoU, UAT credentials approval',
};

export function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

export function tenantDraftToPayload(draft: TenantDraft): Record<string, unknown> {
  const languages = draft.languages_enabled
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const code = draft.code.trim().toUpperCase();
  const slug = code.toLowerCase();
  const tenantAdminUsername = draft.tenant_admin_username.trim() || `${slug}-tenant-admin`;

  return {
    code,
    name: draft.name.trim(),
    district: draft.district.trim(),
    ward_count: draft.ward_count ? Number(draft.ward_count) : undefined,
    theme_color: draft.theme_color.trim(),
    logo_url: null,
    languages_enabled: languages.length ? languages : ['en'],
    status: draft.status,
    inherit_default_services: draft.inherit_default_services === 'true',
    service_category_codes: draft.service_category_codes,
    grievance_category_codes: draft.grievance_category_codes,
    tenant_admin_username: tenantAdminUsername,
    tenant_admin_email:
      draft.tenant_admin_email.trim() || `${tenantAdminUsername}@tenant.enagar.local`,
    tenant_admin_password: draft.tenant_admin_password.trim() || undefined,
    tenant_admin_first_name: draft.tenant_admin_first_name.trim() || 'Tenant',
    tenant_admin_last_name: draft.tenant_admin_last_name.trim() || 'Administrator',
    config: {
      default_language: draft.default_language,
      support_email: draft.support_email,
      onboarding_source: 'state_wizard',
      wizard_completed: true,
    },
  };
}

export function formSchemaToDraftJson(formSchema: unknown): string {
  if (!formSchema || typeof formSchema !== 'object' || Array.isArray(formSchema)) {
    return '{}';
  }
  if (Object.keys(formSchema as object).length === 0) {
    return '{}';
  }
  return JSON.stringify(formSchema, null, 2);
}

export function parseFormSchemaJson(json: string): Record<string, unknown> | undefined {
  const trimmed = json.trim();
  if (!trimmed || trimmed === '{}') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function countPreviewFormFields(formSchemaJson: string): number {
  try {
    const parsed = JSON.parse(formSchemaJson) as { fields?: Array<{ type?: string }> };
    if (!Array.isArray(parsed.fields)) {
      return 0;
    }
    return parsed.fields.filter((field) => field.type && field.type !== 'section').length;
  } catch {
    return 0;
  }
}

export function libraryDraftToPayload(draft: LibraryDraft): Record<string, unknown> {
  const amountPaise = Math.round(Number(draft.fee_amount_rupees || '0') * 100);
  const formSchema = parseFormSchemaJson(draft.form_schema_json);
  return {
    code: draft.code.trim(),
    category_code: draft.category_code.trim(),
    name: { en: draft.name_en.trim(), bn: draft.name_en.trim(), hi: draft.name_en.trim() },
    description: { en: draft.description_en.trim() },
    workflow_pattern: draft.workflow_pattern,
    default_sla_days: Number(draft.default_sla_days || '0'),
    fee_config:
      draft.fee_type === 'fixed'
        ? { type: 'fixed', amount_paise: amountPaise }
        : { type: draft.fee_type },
    required_documents: [{ code: 'identity-proof', label: { en: 'Identity proof' } }],
    lifecycle_status: draft.lifecycle_status,
    curator_notes: draft.curator_notes,
    ...(formSchema ? { form_schema: formSchema } : {}),
  };
}

export type TenantOnboardingContext = {
  code: string;
  service_category_codes: string[];
  grievance_category_codes: string[];
  tenant_admin_username: string;
  default_language: string;
  support_email: string;
};

export function tenantRowToDraft(row: {
  code: string;
  name: string;
  district: string | null;
  ward_count: number | null;
  theme_color: string | null;
  languages_enabled: string[];
  is_active: boolean;
}): TenantDraft {
  const slug = row.code.trim().toLowerCase();
  return {
    code: row.code,
    name: row.name,
    district: row.district ?? '',
    ward_count: row.ward_count != null ? String(row.ward_count) : '',
    theme_color: row.theme_color ?? '#0E7490',
    languages_enabled: row.languages_enabled.join(', '),
    status: row.is_active ? 'active' : 'inactive',
    inherit_default_services: 'false',
    default_language: 'bn',
    support_email: `support@${slug}.example.gov.in`,
    service_category_codes: [],
    grievance_category_codes: [],
    tenant_admin_username: `${slug}-tenant-admin`,
    tenant_admin_email: `${slug}-tenant-admin@tenant.enagar.local`,
    tenant_admin_password: 'DummyDev_2026!ChangeMe',
    tenant_admin_first_name: 'Tenant',
    tenant_admin_last_name: 'Administrator',
  };
}

/** Merges directory row + API onboarding context for re-onboard wizard. */
export function tenantDraftForReonboard(
  row: Parameters<typeof tenantRowToDraft>[0],
  context: TenantOnboardingContext,
): TenantDraft {
  const base = tenantRowToDraft(row);
  const hasServiceCategories = context.service_category_codes.length > 0;
  return {
    ...base,
    service_category_codes: context.service_category_codes,
    grievance_category_codes: context.grievance_category_codes,
    tenant_admin_username: context.tenant_admin_username,
    tenant_admin_email: `${context.tenant_admin_username}@tenant.enagar.local`,
    default_language: context.default_language || base.default_language,
    support_email: context.support_email || base.support_email,
    inherit_default_services: hasServiceCategories ? 'false' : base.inherit_default_services,
  };
}

export function libraryRowToDraft(row: {
  code: string;
  category_code: string;
  name: unknown;
  lifecycle_status: string;
  default_sla_days: number | null;
  curator_notes: string | null;
  form_schema?: unknown;
}): LibraryDraft {
  return {
    code: row.code,
    category_code: row.category_code,
    name_en: pickLabel(row.name),
    description_en: pickLabel(row.name),
    workflow_pattern: 'single_window',
    default_sla_days: row.default_sla_days != null ? String(row.default_sla_days) : '7',
    fee_type: 'fixed',
    fee_amount_rupees: '500',
    lifecycle_status: row.lifecycle_status,
    curator_notes: row.curator_notes ?? '',
    form_schema_json: formSchemaToDraftJson(row.form_schema),
  };
}

export function integrationRowToDraft(row: {
  provider_key: string;
  environment: string;
  status: string;
  owner: string | null;
  notes: string | null;
}): IntegrationDraft {
  return {
    provider_key: row.provider_key,
    environment: row.environment,
    status: row.status,
    owner: row.owner ?? '',
    notes: row.notes ?? '',
    required_docs: '',
  };
}

export function integrationDraftToPayload(draft: IntegrationDraft): Record<string, unknown> {
  const docs = draft.required_docs
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    provider_key: draft.provider_key.trim(),
    environment: draft.environment,
    status: draft.status,
    owner: draft.owner.trim() || null,
    notes: draft.notes.trim() || null,
    required_docs: docs,
  };
}
