import { Body, Controller, Get, Put, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { PreviewHoardingQuoteDto, ReplaceHoardingRateMatrixDto } from './dto/advertising.dto';
import { AdvertisingService } from './advertising.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant-advertising')
@ApiBearerAuth()
@Controller('admin/tenant/advertising')
export class AdvertisingAdminController {
  constructor(private readonly advertising: AdvertisingService) {}

  @Get('hoarding-rates')
  @ApiOperation({ summary: 'Get hoarding ward rate matrix (Sprint 8.5A)' })
  getHoardingRates(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.advertising.getHoardingRateMatrix(principal);
  }

  @Put('hoarding-rates')
  @ApiOperation({ summary: 'Replace hoarding ward rate matrix (Sprint 8.5A)' })
  replaceHoardingRates(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ReplaceHoardingRateMatrixDto,
  ) {
    return this.advertising.replaceHoardingRateMatrix(principal, dto);
  }

  @Post('hoarding-rates/preview')
  @ApiOperation({ summary: 'Preview hoarding tax quote from current matrix (Sprint 8.5A)' })
  previewHoardingQuote(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: PreviewHoardingQuoteDto,
  ) {
    return this.advertising.previewHoardingQuote(principal, dto);
  }
}
