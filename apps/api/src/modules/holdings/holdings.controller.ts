import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { HoldingsService } from './holdings.service';

import type { HoldingLookupResponse, HoldingResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('holdings')
@ApiBearerAuth()
@Controller('holdings')
export class HoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  @Get('search')
  search(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('q') query: string,
  ): HoldingResponse[] {
    return this.holdings.search(principal, query ?? '');
  }

  @Get(':holdingNumber')
  lookup(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('holdingNumber') holdingNumber: string,
  ): HoldingLookupResponse {
    return this.holdings.lookup(principal, holdingNumber);
  }
}
