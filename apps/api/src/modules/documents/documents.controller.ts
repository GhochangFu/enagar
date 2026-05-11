import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { DocumentsService } from './documents.service';
import { CreateUploadIntentDto, UpdateScanResultDto } from './dto';

import type { DocumentDownloadResponse, DocumentResponse, UploadIntentResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('documents')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Optional ULB scope for portal JWT (same semantics as applications).',
  required: false,
})
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload-intent')
  createUploadIntent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateUploadIntentDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<UploadIntentResponse> {
    return this.documents.createUploadIntent(
      principal,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Post(':id/scan-result')
  updateScanResult(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateScanResultDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<DocumentResponse> {
    return this.documents.updateScanResult(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Get(':id/download')
  createDownloadUrl(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<DocumentDownloadResponse> {
    return this.documents.createDownloadUrl(
      principal,
      id,
      readScopeFromHeader(municipalityTenantCode),
    );
  }
}
