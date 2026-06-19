import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { CitizenHoardingQuoteDto, CitizenHoardingTenantQueryDto } from './dto/advertising.dto';
import { AdvertisingService } from './advertising.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('citizen-advertising')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Active ULB when using a portal (WBPORTAL) citizen JWT.',
  required: false,
})
@Controller('citizen/advertising')
export class CitizenAdvertisingController {
  constructor(private readonly advertising: AdvertisingService) {}

  @Get('hoarding/context')
  @ApiOperation({ summary: 'Ward list for hoarding calculator (Sprint 8.5B)' })
  getHoardingContext(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: CitizenHoardingTenantQueryDto,
  ) {
    return this.advertising.getHoardingContextForCitizen(principal, query.tenant_code);
  }

  @Post('hoarding/quote')
  @ApiOperation({ summary: 'Quote hoarding tax for ward, size, and duration (Sprint 8.5B)' })
  quoteHoarding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CitizenHoardingQuoteDto,
  ) {
    return this.advertising.quoteHoardingForCitizen(principal, dto);
  }
}
