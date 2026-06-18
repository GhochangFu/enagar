import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { ImportWaterMeterAccountsDto, UpsertWaterMeterAccountDto } from './dto/water-meter.dto';
import { WaterMeterService } from './water-meter.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant-iot-water')
@ApiBearerAuth()
@Controller('admin/tenant/iot-water')
export class WaterMeterAdminController {
  constructor(private readonly waterMeters: WaterMeterService) {}

  @Get()
  @ApiOperation({ summary: 'List water meters and recharge ledger (Sprint 8.2E)' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.waterMeters.listForAdmin(principal);
  }

  @Patch('accounts')
  @ApiOperation({ summary: 'Create or update a water meter account (Sprint 8.2E)' })
  upsertAccount(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertWaterMeterAccountDto,
  ) {
    return this.waterMeters.upsertAccount(principal, dto);
  }

  @Post('accounts/import')
  @ApiOperation({ summary: 'Import water meter accounts from parsed CSV rows (Sprint 8.2E)' })
  importAccounts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ImportWaterMeterAccountsDto,
  ) {
    return this.waterMeters.importAccounts(principal, dto);
  }
}
