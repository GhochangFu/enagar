import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class CreateGrievanceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  description!: string;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsIn([...PRIORITIES])
  grievance_priority?: (typeof PRIORITIES)[number];
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

export type GrievanceResponse = {
  id: string;
  tenant_id: string;
  citizen_id: string;
  grievance_no: string;
  category: string;
  description: string;
  location: unknown;
  photo_keys: string[];
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
