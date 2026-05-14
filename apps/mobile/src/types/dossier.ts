import type { FormSubmission } from '@enagar/forms';

export type PaymentGatewayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

/** Mirrors `WorkspaceTypes` catalogue row from `apps/citizen-pwa`. */
export interface ServiceSummary {
  tenant_code: string;
  code: string;
  category_code: string;
  revenue_head_code: string | null;
  name: Record<'en' | 'bn' | 'hi', string>;
  description: Record<'en' | 'bn' | 'hi', string>;
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

export interface UploadIntentResponse {
  id: string;
  object_key: string;
  scan_status: string;
}
