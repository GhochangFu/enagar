/** Mirrors `CitizenHubDashboardResponse` from `apps/api` / citizen PWA. */

export type CitizenHubDashboardMunicipalityBucket = {
  tenant_id: string;
  tenant_code: string;
  theme_color: string;
  application_count: number;
  payment_count: number;
  grievance_count: number;
};

export type CitizenHubDashboardResponse = {
  generated_at: string;
  municipality_scope: string | null;
  municipalities: CitizenHubDashboardMunicipalityBucket[];
  distinct_active_service_codes: number;
};

export type PinnedServicePreference = {
  tenant_code: string;
  service_code: string;
};

export type CitizenPreferencesResponse = {
  pinned_tenant_codes: string[];
  pinned_services: PinnedServicePreference[];
};
