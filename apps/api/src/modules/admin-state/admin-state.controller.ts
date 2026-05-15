import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
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
  listAuditLogs(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.listAuditLogs(principal);
  }
}
