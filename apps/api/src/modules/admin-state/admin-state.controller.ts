import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminStateService } from './admin-state.service';
import { CreateImpersonationTokenDto, UpsertTenantDto } from './dto/state-admin.dto';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-state')
@ApiBearerAuth()
@Controller('admin/state')
export class AdminStateController {
  constructor(private readonly adminState: AdminStateService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'State-wide KPI snapshot for super-admin portal' })
  getAnalytics(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.getAnalytics(principal);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List tenants with state-wide counts' })
  listTenants(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.listTenants(principal);
  }

  @Get('tenants/:code')
  @ApiOperation({ summary: 'Tenant detail, health counts, warnings, and recent audit events' })
  getTenantDetail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.adminState.getTenantDetail(principal, code);
  }

  @Patch('tenants')
  @ApiOperation({ summary: 'Create or update a municipality tenant' })
  upsertTenant(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTenantDto,
  ) {
    return this.adminState.upsertTenant(principal, dto);
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Create or update a municipality tenant' })
  postTenant(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertTenantDto) {
    return this.adminState.upsertTenant(principal, dto);
  }

  @Post('impersonation')
  @ApiOperation({ summary: 'Create short-lived tenant impersonation token' })
  createImpersonation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateImpersonationTokenDto,
  ) {
    return this.adminState.createImpersonationToken(principal, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List recent state-admin audit events' })
  listAuditLogs(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('tenant_code') tenant_code?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminState.listAuditLogs(principal, {
      actor,
      action,
      tenant_code,
      from,
      to,
      cursor,
      limit,
    });
  }

  @Get('audit-logs.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="state-audit-logs.csv"')
  @ApiOperation({ summary: 'Export filtered state-admin audit events as CSV' })
  exportAuditLogs(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('tenant_code') tenant_code?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminState.exportAuditLogsCsv(principal, {
      actor,
      action,
      tenant_code,
      from,
      to,
    });
  }
}
