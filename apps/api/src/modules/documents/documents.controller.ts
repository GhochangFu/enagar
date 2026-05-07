import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { DocumentsService } from './documents.service';
import { CreateUploadIntentDto, UpdateScanResultDto } from './dto';

import type { DocumentDownloadResponse, DocumentResponse, UploadIntentResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload-intent')
  createUploadIntent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateUploadIntentDto,
  ): UploadIntentResponse {
    return this.documents.createUploadIntent(principal, dto);
  }

  @Post(':id/scan-result')
  updateScanResult(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateScanResultDto,
  ): DocumentResponse {
    return this.documents.updateScanResult(principal, id, dto);
  }

  @Get(':id/download')
  createDownloadUrl(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ): DocumentDownloadResponse {
    return this.documents.createDownloadUrl(principal, id);
  }
}
