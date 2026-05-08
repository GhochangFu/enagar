import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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

export interface ApplicationTimelineResponse {
  id: string;
  from_stage: string | null;
  to_stage: string;
  verb: string;
  actor_role: string;
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
  scan_status: 'pending' | 'clean' | 'infected' | 'failed';
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
  form_version: number;
  workflow_code: string;
  workflow_version: number;
  current_stage: string;
  status: string;
  status_label: string;
  pending_role: string | null;
  payment_status: 'not_required' | 'pending' | 'paid' | 'failed';
  form_data: FormSubmission;
  submitted_at: string;
  timeline: ApplicationTimelineResponse[];
  comments: ApplicationCommentResponse[];
  documents: ApplicationDocumentResponse[];
}

export type ApplicationSummaryResponse = Omit<
  ApplicationResponse,
  'form_data' | 'timeline' | 'comments' | 'documents'
>;
