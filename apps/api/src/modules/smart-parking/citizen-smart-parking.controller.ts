import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  ConfirmSmartParkingHoldDto,
  InitiateSmartParkingHoldPaymentDto,
  SmartParkingCreateHoldDto,
  SmartParkingQuoteDto,
  SmartParkingZoneBaysQueryDto,
  SmartParkingZonesQueryDto,
} from './dto/smart-parking.dto';
import { SmartParkingService } from './smart-parking.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('smart-parking')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Active ULB when using a portal (WBPORTAL) citizen JWT.',
  required: false,
})
@Controller('citizen/smart-parking')
export class CitizenSmartParkingController {
  constructor(private readonly smartParking: SmartParkingService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Quote smart parking rent for a bay and time window (Sprint 8.2B)' })
  quote(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: SmartParkingQuoteDto) {
    return this.smartParking.quoteForCitizen(principal, dto);
  }

  @Get('zones')
  @ApiOperation({
    summary: 'List smart parking zones with free and total bay counts (Sprint 8.2C)',
  })
  listZones(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: SmartParkingZonesQueryDto,
  ) {
    return this.smartParking.listZonesForCitizen(principal, query);
  }

  @Get('zones/:code/bays')
  @ApiOperation({ summary: 'List bays for a smart parking zone (Sprint 8.2C)' })
  listZoneBays(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') zoneCode: string,
    @Query() query: SmartParkingZoneBaysQueryDto,
  ) {
    return this.smartParking.listZoneBaysForCitizen(principal, zoneCode, query);
  }

  @Post('holds')
  @ApiOperation({ summary: 'Create a smart parking hold for a bay and time window (Sprint 8.2C)' })
  createHold(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: SmartParkingCreateHoldDto,
  ) {
    return this.smartParking.createHoldForCitizen(principal, dto);
  }

  @Post('holds/:id/initiate-payment')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this smart parking payment attempt.',
  })
  @ApiOperation({ summary: 'Initiate smart parking payment for a hold (Sprint 8.2C)' })
  initiateHoldPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') holdId: string,
    @Body() dto: InitiateSmartParkingHoldPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.smartParking.initiateHoldPaymentForCitizen(principal, holdId, dto, idempotencyKey);
  }

  @Post('holds/:id/confirm')
  @ApiOperation({ summary: 'Confirm smart parking hold after payment settles (Sprint 8.2C)' })
  confirmHold(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') holdId: string,
    @Body() dto: ConfirmSmartParkingHoldDto,
  ) {
    return this.smartParking.confirmHoldForCitizen(principal, holdId, dto);
  }
}
