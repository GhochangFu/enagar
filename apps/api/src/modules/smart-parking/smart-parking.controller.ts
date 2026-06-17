import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  BulkCreateParkingBaysDto,
  UpdateParkingBayDto,
  UpsertParkingBayDto,
  UpsertSmartZoneDto,
} from './dto/smart-parking.dto';
import { SmartParkingService } from './smart-parking.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant-smart-parking')
@ApiBearerAuth()
@Controller('admin/tenant/smart-parking')
export class SmartParkingAdminController {
  constructor(private readonly smartParking: SmartParkingService) {}

  @Get()
  @ApiOperation({ summary: 'List smart parking zones and bays' })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.smartParking.listForAdmin(principal);
  }

  @Patch('zones')
  @ApiOperation({ summary: 'Create or update a smart parking zone' })
  upsertZone(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertSmartZoneDto,
  ) {
    return this.smartParking.upsertZone(principal, dto);
  }

  @Patch('bays')
  @ApiOperation({ summary: 'Create or update a parking bay' })
  upsertBay(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertParkingBayDto,
  ) {
    return this.smartParking.upsertBay(principal, dto);
  }

  @Post('bays/bulk')
  @ApiOperation({ summary: 'Bulk-create numbered parking bays for a zone' })
  bulkCreateBays(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: BulkCreateParkingBaysDto,
  ) {
    return this.smartParking.bulkCreateBays(principal, dto);
  }

  @Patch('bays/:id')
  @ApiOperation({ summary: 'Update parking bay status' })
  updateBay(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') bayId: string,
    @Body() dto: UpdateParkingBayDto,
  ) {
    return this.smartParking.updateBay(principal, bayId, dto);
  }

  @Get('zones/:code/bays/effective')
  @ApiOperation({ summary: 'Merged bay occupancy (DB + stub sensor) for admin grid (Sprint 8.2C)' })
  getEffectiveBays(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') zoneCode: string,
  ) {
    return this.smartParking.getZoneEffectiveBaysForAdmin(principal, zoneCode);
  }

  @Get('zones/:code/occupancy')
  @ApiOperation({ summary: 'Read stub sensor occupancy for a zone' })
  getOccupancy(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') zoneCode: string,
  ) {
    return this.smartParking.getZoneOccupancy(principal, zoneCode);
  }
}
