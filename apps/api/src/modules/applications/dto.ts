import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type { PaymentResponse } from '../payments/dto';
import type { FormSubmission } from '@enagar/forms';

export class CreateApplicationDto {
  @ApiProperty({ example: 'birth-cert' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  service_code!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  form_data!: FormSubmission;
}

export class CommentApplicationDto {
  @ApiProperty({ example: 'Please process urgently.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;
}

export class CancelApplicationDto {
  @ApiPropertyOptional({ example: 'Submitted by mistake.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

/** Citizen feedback at `citizen-feedback` stage (ADR-0012 Phase 12). */
export class ApplicationFeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

export interface ApplicationTimelineResponse {
  id: string;
  from_stage: string | null;
  to_stage: string;
  verb: string;
  actor_role: string;
  actor_designation?: string | null;
  comment: string | null;
  created_at: string;
}

export interface ApplicationCommentResponse {
  id: string;
  actor_role: string;
  body: string;
  created_at: string;
}

export interface ApplicationDocumentResponse {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  upload_status: 'intent_created' | 'uploaded' | 'rejected';
  scan_status: 'pending' | 'processing' | 'clean' | 'infected' | 'failed';
  object_key: string;
  created_at: string;
}

export interface ApplicationResponse {
  id: string;
  docket_no: string;
  tenant_id: string;
  tenant_code?: string;
  citizen_subject: string;
  service_code: string;
  service_name: string;
  form_version_id?: string;
  form_version: number;
  workflow_code: string;
  workflow_version: number;
  current_stage: string;
  status: string;
  status_label: string;
  pending_role: string | null;
  pending_designation?: string | null;
  /** Human-readable queue owner for citizen detail (designation + department or legacy role). */
  pending_at_label?: string | null;
  payment_status: 'not_required' | 'pending' | 'paid' | 'failed';
  payment_schedule?: 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';
  fee_settlement?: Partial<
    Record<
      'application' | 'approval',
      {
        status: 'not_required' | 'pending' | 'paid' | 'failed';
        payment_id: string | null;
        amount_paise: number | null;
      }
    >
  >;
  /** Set when dept head transition runs `generate_payment_link` (Phase 11). */
  payment_redirect_url?: string | null;
  active_payment_id?: string | null;
  form_data: FormSubmission;
  submitted_at: string;
  timeline: ApplicationTimelineResponse[];
  comments: ApplicationCommentResponse[];
  documents: ApplicationDocumentResponse[];
  citizen_feedback?: {
    rating: number;
    comment: string | null;
    submitted_at: string;
  } | null;
  work_order?: {
    id: string;
    work_order_no: string;
    status: string;
    vendor_id: string | null;
    assigned_user_id: string | null;
  } | null;
  /** Community-hall / linked booking: full fee breakdown (application + rent + deposit). */
  booking_charges?: {
    application_fee_paise: number;
    hall_rent_paise: number;
    security_deposit_paise: number;
    upfront_total_paise: number;
    upfront_paid_paise: number;
    application_fee_status: 'not_required' | 'pending' | 'paid' | 'failed';
    hall_rent_status: 'not_required' | 'pending' | 'paid' | 'failed';
    security_deposit_status: 'not_required' | 'pending' | 'paid' | 'failed';
    slot_summary: string | null;
    reservation_id: string | null;
  };
  /** ad-hoarding: permission fee + calculator tax breakdown for desk/citizen display. */
  hoarding_approval_fee?: {
    base_permission_fee_paise: number;
    hoarding_tax_paise: number;
    total_approval_paise: number;
  };
  /** ad-led: slot rent + security deposit due on approval payment. */
  led_approval_fee?: {
    rent_paise: number;
    deposit_paise: number;
    total_approval_paise: number;
  };
  /** Application fee + linked hall booking payments (for receipts on detail). */
  related_payments?: PaymentResponse[];
}

export type ApplicationSummaryResponse = Omit<
  ApplicationResponse,
  'form_data' | 'timeline' | 'comments' | 'documents'
>;

/** Portal hub vs workspace: optional active ULB (`X-Enagar-Tenant-Code`) for municipal filtering. */
export type ApplicationReadScope = {
  municipalityTenantCode?: string;
};
