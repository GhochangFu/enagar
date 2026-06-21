import {
  FORM_IMPORT_JOB_STATUSES,
  FORM_IMPORT_SCOPES,
  FORM_IMPORT_SOURCE_KINDS,
  type FormImportJobRecord,
  type FormImportProposal,
} from '@enagar/forms/form-import';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import type { EnagarFormSchema } from '@enagar/forms';

/** Minimal upload shape for multipart `file` field (Nest + multer). */
export interface FormImportUploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Multipart upload body for `POST …/form-import` (Slice 1+). Phase 0 documents the contract only. */
export class CreateFormImportJobDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Source municipal form file (.xlsx, .docx, or .pdf depending on slice)',
  })
  file!: FormImportUploadedFile;
}

export class FormImportJobResponseDto implements FormImportJobRecord {
  @ApiProperty({ example: '01JXYZFORMIMPORT' })
  @IsString()
  job_id!: string;

  @ApiProperty({ enum: FORM_IMPORT_SCOPES })
  @IsIn([...FORM_IMPORT_SCOPES])
  scope!: FormImportJobRecord['scope'];

  @ApiProperty({ example: 'birth-certificate' })
  @IsString()
  service_code!: string;

  @ApiPropertyOptional({ description: 'Tenant service UUID when scope=tenant' })
  @IsOptional()
  @IsString()
  service_id?: string;

  @ApiProperty({ enum: FORM_IMPORT_JOB_STATUSES })
  @IsIn([...FORM_IMPORT_JOB_STATUSES])
  status!: FormImportJobRecord['status'];

  @ApiProperty({ example: 'birth-cert-template.xlsx' })
  @IsString()
  source_filename!: string;

  @ApiPropertyOptional({ enum: FORM_IMPORT_SOURCE_KINDS })
  @IsOptional()
  @IsIn([...FORM_IMPORT_SOURCE_KINDS])
  source_kind?: FormImportJobRecord['source_kind'];

  @ApiPropertyOptional({ description: 'Object storage key when source file is persisted' })
  @IsOptional()
  @IsString()
  source_storage_key?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  overall_confidence?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  proposal?: FormImportProposal;

  @ApiPropertyOptional({
    description: 'Validated schema preview derived from accepted proposal fields',
  })
  @IsOptional()
  @IsObject()
  proposed_schema?: EnagarFormSchema;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejection_reason?: string;

  @ApiPropertyOptional({ description: 'Plain-text or HTML snippet of parsed source layout' })
  @IsOptional()
  @IsString()
  source_preview?: string;

  @ApiProperty({ format: 'date-time' })
  @IsString()
  created_at!: string;

  @ApiProperty({ format: 'date-time' })
  @IsString()
  updated_at!: string;
}

export class FormImportNotImplementedResponseDto {
  @ApiProperty({ example: 'Form import extractors are not wired yet (EN-32+).' })
  message!: string;

  @ApiProperty({ example: 'EN-32' })
  follow_up_ticket!: string;
}

export class FormImportApplyReviewDto {
  @ApiProperty({ type: Object })
  @IsObject()
  proposal!: FormImportProposal;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  existing_draft?: EnagarFormSchema;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  context?: {
    service_code: string;
    version: number;
  };
}
