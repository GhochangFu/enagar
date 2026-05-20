import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { GrievanceCatalogueService } from './grievance-catalogue.service';
import { GrievancesService } from './grievances.service';

@Controller('public/grievances')
@Public()
@ApiTags('public grievances (Phase 4 backlog)')
export class PublicGrievanceStatsController {
  constructor(
    private readonly grievances: GrievancesService,
    private readonly catalogueService: GrievanceCatalogueService,
  ) {}

  @Get('catalogue')
  @ApiOperation({
    summary: 'Active grievance categories and sub-types for a tenant (no JWT)',
    description:
      'Used by citizen PWA/mobile pickers. Pass `tenant_code` (e.g. KMC). Returns only active rows.',
  })
  getCatalogue(@Query('tenant_code') tenantCode?: string) {
    if (!tenantCode?.trim()) {
      throw new BadRequestException('tenant_code query parameter is required');
    }
    return this.catalogueService.getActiveCatalogueByTenantCode(tenantCode);
  }

  @Get('aggregate-metrics')
  @ApiOperation({
    summary: 'Anonymised grievance counts (no narratives; optional tenant filter)',
    description:
      'Returns grouped counts suitable for dashboards / Phase-12-style open-data feeds. Omit `tenant_code` for whole-database aggregate in dev.',
  })
  aggregateMetrics(
    @Query('tenant_code') tenantCode?: string,
    @Query('window_days') windowDays?: string,
  ) {
    const parsed = windowDays !== undefined ? Number.parseInt(windowDays, 10) : undefined;
    return this.grievances.getPublicAggregate({
      tenantCode,
      windowDays: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
    });
  }
}
