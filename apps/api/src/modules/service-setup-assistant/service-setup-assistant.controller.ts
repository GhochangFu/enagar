import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { AdminTenantService } from '../admin-tenant/admin-tenant.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import { CreateSetupSessionDto, PatchSetupSessionStepDto } from './dto/session.dto';
import { ReadinessChecklistService } from './readiness-checklist.service';
import { SetupSessionService } from './setup-session.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('service-setup-assistant')
@ApiBearerAuth()
@Controller('admin/tenant/services/:serviceId/setup-assistant')
export class ServiceSetupAssistantController {
  constructor(
    private readonly adminTenant: AdminTenantService,
    private readonly sessions: SetupSessionService,
    private readonly readiness: ReadinessChecklistService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create setup-assistant session for a tenant service' })
  async createSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateSetupSessionDto,
  ) {
    assertTenantPortalStaff(principal);
    await this.adminTenant.getServiceDesigner(principal, serviceId);
    return this.sessions.createSession({
      tenantId: principal.tenantId,
      serviceId,
      staffSubjectId: principal.subject,
      scope: dto.scope,
    });
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get setup-assistant session state' })
  async getSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Param('sessionId') sessionId: string,
  ) {
    assertTenantPortalStaff(principal);
    const session = await this.sessions.getSession(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    const raw = await this.sessions.assertSessionAccess(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    if (raw.serviceId !== serviceId) {
      throw new ForbiddenException('Session does not belong to this service');
    }
    const checklist = await this.readiness.forService(principal.tenantId, serviceId);
    return { session, checklist };
  }

  @Patch('sessions/:sessionId/step')
  @ApiOperation({ summary: 'Update setup-assistant current step' })
  async patchSessionStep(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PatchSetupSessionStepDto,
  ) {
    assertTenantPortalStaff(principal);
    const raw = await this.sessions.assertSessionAccess(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    if (raw.serviceId !== serviceId) {
      throw new ForbiddenException('Session does not belong to this service');
    }
    return this.sessions.setCurrentStep(
      sessionId,
      principal.tenantId,
      principal.subject,
      dto.current_step,
    );
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness checklist for service setup layers' })
  getReadiness(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    assertTenantPortalStaff(principal);
    return this.readiness.forService(principal.tenantId, serviceId);
  }
}
