import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import { ListDocumentsQueryDto } from './dto/list-documents.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { RentalDocumentsService } from './rental-documents.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

class CreateUploadUrlDto {
  @IsUUID() agreementId!: string;
  @IsString() @MaxLength(255) fileName!: string;
  @IsString() @MaxLength(120) mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20 * 1024 * 1024) sizeBytes!: number;
}

class ConfirmUploadDto {
  @IsUUID() agreementId!: string;
  @IsString() @MaxLength(255) fileName!: string;
  @IsString() @MaxLength(120) mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20 * 1024 * 1024) sizeBytes!: number;
  @IsString() @MaxLength(64) sha256!: string;
  @IsString() @MaxLength(512) storageKey!: string;
}

const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

@ApiTags('rental-documents')
@ApiBearerAuth()
@Controller()
export class RentalDocumentsController {
  constructor(
    private readonly service: RentalDocumentsService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Post('rental-assets/agreements/:agreementId/documents/upload-url')
  @ApiOperation({ summary: 'Get a presigned PUT URL for uploading a lease document' })
  @HttpCode(200)
  async createUploadUrl(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('agreementId') agreementId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    assertTenantPortalStaff(principal);
    if (!ALLOWED_MIME.has(dto.mimeType)) {
      throw new BadRequestException(`Unsupported mime type: ${dto.mimeType}`);
    }
    if (!principal.tenantCode) throw new BadRequestException('Tenant code is required');
    const storageKey = `tenants/${principal.tenantCode}/lease-agreements/${agreementId}/${Date.now()}-${dto.fileName}`;
    const signed = await this.storage.presignUpload(storageKey, dto.mimeType);
    return { ...signed, storageKey, agreementId };
  }

  @Post('rental-assets/agreements/:agreementId/documents')
  @ApiOperation({ summary: 'Record a successfully uploaded lease document' })
  async recordUpload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('agreementId') agreementId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    assertTenantPortalStaff(principal);
    if (!principal.tenantId) throw new BadRequestException('Tenant id is required');
    return this.service.recordUpload({
      tenantId: principal.tenantId,
      agreementId,
      uploadedBy: principal.subject,
      file: {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        sha256: dto.sha256,
        storageKey: dto.storageKey,
      },
    });
  }

  @Get('rental-assets/documents')
  @ApiOperation({ summary: 'List lease documents for the operator review queue' })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListDocumentsQueryDto,
  ) {
    assertTenantPortalStaff(principal);
    if (!principal.tenantId) throw new BadRequestException('Tenant id is required');
    return this.service.listDocuments(principal.tenantId, query.status);
  }

  @Post('rental-assets/agreements/:agreementId/documents/:documentId/review')
  @ApiOperation({ summary: 'Approve or reject a pending lease document' })
  async review(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('agreementId') _agreementId: string,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    assertTenantPortalStaff(principal);
    if (!principal.tenantId) throw new BadRequestException('Tenant id is required');
    return this.service.reviewDocument({
      tenantId: principal.tenantId,
      documentId,
      actorUserId: principal.subject,
      decision: dto.decision,
      note: dto.note,
    });
  }
}
