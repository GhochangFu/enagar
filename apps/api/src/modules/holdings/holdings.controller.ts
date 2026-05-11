import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { HoldingsService } from './holdings.service';

import type { HoldingLookupResponse, HoldingResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('holdings')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description:
    'Required for portal JWT — selects municipal scope. Ignored for non-portal principals (JWT tenant is used).',
  required: false,
})
@Controller('holdings')
export class HoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  @Get('search')
  search(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('q') query: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): HoldingResponse[] {
    return this.holdings.search(principal, query ?? '', municipalityTenantCode);
  }

  @Get(':holdingNumber')
  lookup(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('holdingNumber') holdingNumber: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): HoldingLookupResponse {
    return this.holdings.lookup(principal, holdingNumber, municipalityTenantCode);
  }
}
