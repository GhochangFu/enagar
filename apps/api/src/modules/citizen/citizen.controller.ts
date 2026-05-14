import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { CitizenHubDashboardService } from './citizen-hub-dashboard.service';
import { CitizenService } from './citizen.service';
import {
  PatchCitizenPreferencesDto,
  RegisterCitizenDto,
  SelectTenantDto,
  UpdateCitizenLanguageDto,
  UpdateCitizenProfileDto,
} from './dto';

import type {
  CitizenHubDashboardResponse,
  CitizenPreferencesResponse,
  CitizenProfileResponse,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('citizen')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Optional ULB scope on dashboard (same semantics as hub aggregate reads).',
  required: false,
})
@Controller('citizen')
export class CitizenController {
  constructor(
    private readonly citizens: CitizenService,
    private readonly hubDashboard: CitizenHubDashboardService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Hub dashboard — per-ULB counts (applications, payments, grievances)',
  })
  getDashboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<CitizenHubDashboardResponse> {
    return this.hubDashboard.getDashboard(principal, readScopeFromHeader(municipalityTenantCode));
  }

  @Post('register')
  register(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: RegisterCitizenDto,
  ): Promise<CitizenProfileResponse> {
    return this.citizens.register(principal, dto);
  }

  @Get('profile')
  getProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CitizenProfileResponse> {
    return this.citizens.getProfile(principal);
  }

  @Get('preferences')
  @ApiOperation({
    summary:
      'Sprint 4.16 — pinned ULBs and favourite service shortcuts (independent of selected_tenant_code)',
  })
  getPreferences(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<CitizenPreferencesResponse> {
    return this.citizens.getPreferences(principal);
  }

  @Get('notifications')
  @ApiOperation({
    summary: 'In-app notifications (e.g. SLA breach after staff sweep)',
  })
  listNotifications(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.citizens.listNotifications(principal);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markNotificationRead(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.citizens.markNotificationRead(principal, id);
  }

  @Patch('preferences')
  patchPreferences(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: PatchCitizenPreferencesDto,
  ): Promise<CitizenPreferencesResponse> {
    return this.citizens.patchPreferences(principal, dto);
  }

  @Patch('profile')
  updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateCitizenProfileDto,
  ): Promise<CitizenProfileResponse> {
    return this.citizens.updateProfile(principal, dto);
  }

  @Patch('language')
  updateLanguage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateCitizenLanguageDto,
  ): Promise<CitizenProfileResponse> {
    return this.citizens.updateLanguage(principal, dto);
  }

  @Post('select-tenant')
  selectTenant(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: SelectTenantDto,
  ): Promise<{
    selected_tenant_code: string;
    tenant_name: string;
    theme_color: string;
    ward_count: number;
  }> {
    return this.citizens.selectTenant(principal, dto);
  }
}
