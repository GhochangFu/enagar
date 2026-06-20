import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import { ListDocumentsQueryDto } from './dto/list-documents.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { RentalDocumentsService } from './rental-documents.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Request } from 'express';

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
    @Req() req: Request,
  ) {
    assertTenantPortalStaff(principal);
    if (!ALLOWED_MIME.has(dto.mimeType)) {
      throw new BadRequestException(`Unsupported mime type: ${dto.mimeType}`);
    }
    if (!principal.tenantCode) throw new BadRequestException('Tenant code is required');
    const storageKey = `tenants/${principal.tenantCode}/lease-agreements/${agreementId}/${Date.now()}-${dto.fileName}`;
    // Stub mode (no real S3): the browser can't PUT to a `minio://` URL, so
    // hand back a same-origin API URL the API itself can serve. The
    // _stub-upload endpoint below writes the bytes to the in-memory stub
    // store and the subsequent `record-upload` step finds them via
    // `ObjectStorageService.headObject`.
    if (!this.storage.isEnabled()) {
      const stubUrl = this.buildStubUploadUrl(req, agreementId, storageKey);
      return {
        url: stubUrl,
        storageKey,
        agreementId,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    }
    const signed = await this.storage.presignUpload(storageKey, dto.mimeType);
    return { ...signed, storageKey, agreementId };
  }

  /**
   * Stub-mode upload sink. Accepts raw bytes via PUT and writes them to the
   * in-memory stub store. Only active when `ObjectStorageService.isEnabled()`
   * is false; otherwise returns 404 so production S3 traffic never reaches
   * this path. The `expires_at` query param is accepted but not enforced —
   * the stub store is best-effort dev infrastructure.
   */
  @Put('rental-assets/agreements/:agreementId/documents/_stub-upload')
  @ApiExcludeEndpoint()
  async stubUpload(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('agreementId') _agreementId: string,
    @Query('key') key: string,
    @Body() body: Buffer,
  ): Promise<{ ok: true; storageKey: string; sizeBytes: number }> {
    if (this.storage.isEnabled()) {
      throw new NotFoundException('Stub upload endpoint is disabled');
    }
    assertTenantPortalStaff(principal);
    if (!key) throw new BadRequestException('Missing key query parameter');
    this.storage.assertTenantObjectKey(key, await this.tenantCodeFor(principal));
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Empty or missing request body');
    }
    await this.storage.putObject(key, body, 'application/octet-stream');
    return { ok: true, storageKey: key, sizeBytes: body.byteLength };
  }

  private buildStubUploadUrl(req: Request, agreementId: string, storageKey: string): string {
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
      req.protocol ||
      'http';
    const host = req.headers.host ?? `${req.protocol}://localhost:3001`;
    return `${proto}://${host}/api/rental-assets/agreements/${agreementId}/documents/_stub-upload?key=${encodeURIComponent(storageKey)}`;
  }

  private async tenantCodeFor(principal: AuthenticatedPrincipal): Promise<string> {
    if (!principal.tenantCode) throw new BadRequestException('Tenant code is required');
    return principal.tenantCode;
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
    return this.service.listDocuments(principal.tenantId, query);
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
