import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;
export const DOCUMENT_SCAN_STATUSES = ['clean', 'infected', 'failed'] as const;

export type DocumentMimeType = (typeof SUPPORTED_DOCUMENT_MIME_TYPES)[number];
export type DocumentScanStatus = 'pending' | 'processing' | (typeof DOCUMENT_SCAN_STATUSES)[number];
export type DocumentUploadStatus = 'intent_created' | 'uploaded' | 'rejected';

export class CreateUploadIntentDto {
  @ApiProperty({ example: '1bde73a1-9bb4-4df5-bd94-923b302773bc' })
  @IsString()
  @IsNotEmpty()
  application_id!: string;

  @ApiProperty({ example: 'hospital_discharge' })
  @IsString()
  @IsNotEmpty()
  document_code!: string;

  @ApiProperty({ example: 'birth-proof.pdf' })
  @IsString()
  @IsNotEmpty()
  original_name!: string;

  @ApiProperty({ enum: SUPPORTED_DOCUMENT_MIME_TYPES, example: 'application/pdf' })
  @IsIn(SUPPORTED_DOCUMENT_MIME_TYPES)
  mime_type!: DocumentMimeType;

  @ApiProperty({ example: 1.2, minimum: 0.01, maximum: 10 })
  @IsNumber()
  @Min(0.01)
  @Max(10)
  size_mb!: number;

  @ApiPropertyOptional({
    example: 'approver',
    description:
      "Workflow stage the uploader is currently sitting on. Staff context-action; ignored for citizens (defaults to 'submission').",
  })
  @IsString()
  @IsOptional()
  workflow_stage_code?: string;

  @ApiPropertyOptional({
    example: 'Site inspection report attached for verification.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateScanResultDto {
  @ApiProperty({ enum: DOCUMENT_SCAN_STATUSES, example: 'clean' })
  @IsIn(DOCUMENT_SCAN_STATUSES)
  scan_status!: Exclude<DocumentScanStatus, 'pending'>;

  @ApiPropertyOptional({ example: 'clamav-local' })
  @IsString()
  @IsOptional()
  scan_provider?: string;

  @ApiPropertyOptional({ example: 'sha256:e3b0c442...' })
  @IsString()
  @IsOptional()
  scan_signature?: string;
}

export interface UploadIntentResponse {
  id: string;
  application_id: string;
  document_code: string;
  original_name: string;
  mime_type: DocumentMimeType;
  size_mb: number;
  object_key: string;
  upload_url: string;
  upload_expires_at: string;
  upload_status: DocumentUploadStatus;
  scan_status: DocumentScanStatus;
  workflow_stage_code?: string;
  uploaded_by_role?: string;
  note?: string;
}

export interface DocumentResponse {
  id: string;
  application_id: string;
  document_code: string;
  original_name: string;
  mime_type: DocumentMimeType;
  size_mb: number;
  object_key: string;
  upload_status: DocumentUploadStatus;
  scan_status: DocumentScanStatus;
  created_at: string;
  workflow_stage_code?: string;
  uploaded_by_role?: string;
  note?: string;
}

export interface DocumentDownloadResponse {
  id: string;
  object_key: string;
  download_url: string;
  download_expires_at: string;
}
