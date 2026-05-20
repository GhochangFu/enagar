import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

/** Optional filing location: text hints + WGS-84 pin (Phase 4 backlog — GPS polish). */
export class GrievanceLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ward_hint?: string;

  @IsOptional()
  @IsNumber({}, { message: 'latitude must be a number' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'longitude must be a number' })
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CreateGrievanceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  subtype_code?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  description!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GrievanceLocationDto)
  location?: GrievanceLocationDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];

  @IsOptional()
  @IsIn([...PRIORITIES])
  grievance_priority?: (typeof PRIORITIES)[number];
}

export const GRIEVANCE_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export type GrievanceEvidenceMimeType = (typeof GRIEVANCE_EVIDENCE_MIME_TYPES)[number];

export class CreateGrievanceEvidenceUploadIntentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  original_name!: string;

  @IsIn(GRIEVANCE_EVIDENCE_MIME_TYPES)
  mime_type!: GrievanceEvidenceMimeType;

  @IsNumber()
  @Min(0.01)
  @Max(25)
  size_mb!: number;
}

export interface GrievanceEvidenceUploadIntentResponse {
  storage_key: string;
  upload_url: string;
  upload_expires_at: string;
  mime_type: GrievanceEvidenceMimeType;
  original_name: string;
}

/** Register MinIO-compatible object key after client upload (citizen-owned grievance). */
export class RegisterGrievanceAttachmentDto {
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  storage_key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  content_type?: string;
}

export class GrievanceCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  body!: string;
}

export class GrievanceFeedbackDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

/** Citizen Sprint 4.3 — reopen a resolved grievance within the policy window. */
export class GrievanceReopenDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reason?: string;
}

export class AssignGrievanceDto {
  @IsUUID('4')
  user_id!: string;
}

export class UpdateGrievanceStatusDto {
  @IsString()
  @IsIn(['submitted', 'under_review', 'in_progress', 'resolved', 'closed'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export type GrievanceAttachmentResponse = {
  id: string;
  storage_key: string;
  content_type: string;
  created_at: string;
};

export type GrievanceResponse = {
  id: string;
  tenant_id: string;
  citizen_id: string;
  grievance_no: string;
  category: string;
  subtype_code: string | null;
  description: string;
  location: unknown;
  photo_keys: string[];
  attachments?: GrievanceAttachmentResponse[];
  grievance_priority: string;
  status: string;
  routed_role_code: string | null;
  assigned_to_user_id: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  rating: number | null;
  feedback: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GrievanceTimelineResponse = {
  id: string;
  event_type: string;
  actor_subject: string;
  body: string | null;
  metadata: unknown;
  occurred_at: string;
};
