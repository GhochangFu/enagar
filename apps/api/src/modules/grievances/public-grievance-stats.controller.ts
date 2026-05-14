import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { GrievancesService } from './grievances.service';

@Controller('public/grievances')
@Public()
@ApiTags('public grievances (Phase 4 backlog)')
export class PublicGrievanceStatsController {
  constructor(private readonly grievances: GrievancesService) {}

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
