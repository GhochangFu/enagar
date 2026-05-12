import type { FormSubmission } from '@enagar/forms';

/** Language bundle keys used across tenant payloads in the PWA. */
export type PwaLocaleCode = 'en' | 'bn' | 'hi';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface ServiceSummary {
  tenant_code: string;
  code: string;
  category_code: string;
  revenue_head_code: string | null;
  name: Record<PwaLocaleCode, string>;
  description: Record<PwaLocaleCode, string>;
  workflow_pattern: string;
  active: boolean;
  fee_type: string;
  fee_config: Record<string, unknown>;
  sla_days: number | null;
  required_documents: string[];
  pushes_to_digilocker: boolean;
  source: string;
  popular: boolean;
}

export interface ApplicationSummary {
  id: string;
  docket_no: string;
  /** Municipal tenant (applications list includes these for portal citizens). */
  tenant_id?: string;
  tenant_code?: string;
  service_code: string;
  service_name: string;
  current_stage: string;
  status: string;
  status_label: string;
  pending_role: string | null;
  payment_status: string;
  submitted_at: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  form_data: FormSubmission;
  timeline: Array<{
    id: string;
    verb: string;
    to_stage: string;
    actor_role: string;
    comment: string | null;
    created_at: string;
  }>;
  comments: Array<{
    id: string;
    body: string;
    actor_role: string;
    created_at: string;
  }>;
  documents: Array<{
    id: string;
    document_code: string;
    original_name: string;
    mime_type: string;
    size_mb: number;
    scan_status: string;
    object_key: string;
  }>;
}

export type PaymentGatewayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface PaymentApiResponse {
  id: string;
  tenant_id: string;
  application_id: string;
  amount_paise: number;
  currency: 'INR';
  method: PaymentGatewayMethod;
  status: 'requires_action' | 'settled' | 'failed';
  gateway: 'stub';
  gateway_order_id: string;
  gateway_payment_id?: string | null;
  settled_at?: string | null;
  redirect_url: string;
  created_at: string;
  updated_at: string;
}

/** Mirrors `CitizenHubDashboardResponse` from `apps/api` (Sprint 2.2 / 4.1 hub). */
export interface CitizenHubDashboardMunicipalityBucket {
  tenant_id: string;
  tenant_code: string;
  theme_color: string;
  application_count: number;
  payment_count: number;
  grievance_count: number;
}

export interface CitizenHubDashboardResponse {
  generated_at: string;
  municipality_scope: string | null;
  municipalities: CitizenHubDashboardMunicipalityBucket[];
  /** Whole-portfolio distinct active catalogue service codes (Sprint 4.16 API). */
  distinct_active_service_codes: number;
}

export interface CitizenPreferencesResponse {
  pinned_tenant_codes: string[];
  pinned_services: Array<{ tenant_code: string; service_code: string }>;
}

export interface ReceiptCitizenPayload {
  id: string;
  receipt_number: string;
  payment_id: string;
  application_id: string;
  service_code: string;
  revenue_head_code: string;
  amount_paise: number;
  currency: 'INR';
  issued_at: string;
  verification_path: string;
  qr_contract: {
    format: 'enagar_receipt_verify_v1';
    version: number;
    verification_path: string;
  };
}
