import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { UpsertEvChargerDto } from './dto/ev-charging.dto';
import { EvChargingService } from './ev-charging.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant-ev-charging')
@ApiBearerAuth()
@Controller('admin/tenant/ev-charging')
export class EvChargingAdminController {
  constructor(private readonly evCharging: EvChargingService) {}

  @Get()
  @ApiOperation({ summary: 'List EV chargers and recent sessions (Sprint 8.2D)' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.evCharging.listForAdmin(principal);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List EV charging sessions read-only (Sprint 8.2D)' })
  listSessions(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.evCharging.listSessionsForAdmin(principal);
  }

  @Patch('chargers')
  @ApiOperation({ summary: 'Create or update an EV charger (Sprint 8.2D)' })
  upsertCharger(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertEvChargerDto,
  ) {
    return this.evCharging.upsertCharger(principal, dto);
  }
}
