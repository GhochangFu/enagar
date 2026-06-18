import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { InitiateWaterMeterRechargeDto, WaterMeterTenantQueryDto } from './dto/water-meter.dto';
import { WaterMeterService } from './water-meter.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('iot-water')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Active ULB when using a portal (WBPORTAL) citizen JWT.',
  required: false,
})
@Controller('citizen/iot-water')
export class CitizenWaterMeterController {
  constructor(private readonly waterMeters: WaterMeterService) {}

  @Get('water-meters/:meterId')
  @ApiOperation({ summary: 'Lookup prepaid IoT water meter balance (Sprint 8.2E)' })
  lookup(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('meterId') meterId: string,
    @Query() query: WaterMeterTenantQueryDto,
  ) {
    return this.waterMeters.lookupForCitizen(principal, meterId, query);
  }

  @Post('water-meters/:meterId/recharge')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this water recharge payment attempt.',
  })
  @ApiOperation({ summary: 'Initiate prepaid IoT water meter recharge (Sprint 8.2E)' })
  recharge(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('meterId') meterId: string,
    @Body() dto: InitiateWaterMeterRechargeDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.waterMeters.initiateRechargeForCitizen(principal, meterId, dto, idempotencyKey);
  }
}
