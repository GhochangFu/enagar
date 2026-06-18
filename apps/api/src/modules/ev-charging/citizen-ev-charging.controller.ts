import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  ConfirmEvSessionPaymentDto,
  EvChargingCreateHoldDto,
  EvChargingSessionActionDto,
  EvChargingTenantQueryDto,
  InitiateEvSessionPaymentDto,
} from './dto/ev-charging.dto';
import { EvChargingService } from './ev-charging.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('ev-charging')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Active ULB when using a portal (WBPORTAL) citizen JWT.',
  required: false,
})
@Controller('citizen/ev-charging')
export class CitizenEvChargingController {
  constructor(private readonly evCharging: EvChargingService) {}

  @Get('chargers')
  @ApiOperation({ summary: 'List EV chargers with availability (Sprint 8.2D)' })
  listChargers(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: EvChargingTenantQueryDto,
  ) {
    return this.evCharging.listChargersForCitizen(principal, query);
  }

  @Post('chargers/:code/holds')
  @ApiOperation({ summary: 'Reserve an EV charger slot (15 min hold) (Sprint 8.2D)' })
  createHold(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') chargerCode: string,
    @Body() dto: EvChargingCreateHoldDto,
  ) {
    return this.evCharging.createHoldForCitizen(principal, chargerCode, dto);
  }

  @Post('sessions/:id/start')
  @ApiOperation({ summary: 'Start EV charging session after hold (Sprint 8.2D)' })
  startSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') sessionId: string,
    @Body() dto: EvChargingSessionActionDto,
  ) {
    return this.evCharging.startSessionForCitizen(principal, sessionId, dto);
  }

  @Post('sessions/:id/stop')
  @ApiOperation({ summary: 'Stop EV charging session and compute kWh bill (Sprint 8.2D)' })
  stopSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') sessionId: string,
    @Body() dto: EvChargingSessionActionDto,
  ) {
    return this.evCharging.stopSessionForCitizen(principal, sessionId, dto);
  }

  @Post('sessions/:id/initiate-payment')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this EV charging payment attempt.',
  })
  @ApiOperation({ summary: 'Initiate EV charging payment for a stopped session (Sprint 8.2D)' })
  initiatePayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') sessionId: string,
    @Body() dto: InitiateEvSessionPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.evCharging.initiatePaymentForCitizen(principal, sessionId, dto, idempotencyKey);
  }

  @Post('sessions/:id/pay')
  @ApiOperation({ summary: 'Confirm EV charging payment after stub settlement (Sprint 8.2D)' })
  confirmPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') sessionId: string,
    @Body() dto: ConfirmEvSessionPaymentDto,
  ) {
    return this.evCharging.confirmPaymentForCitizen(principal, sessionId, dto);
  }
}
