import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminTenantService } from './admin-tenant.service';
import { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import { SaveServiceFormDraftDto, SaveServiceWorkflowDraftDto } from './dto/service-designer.dto';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant')
@ApiBearerAuth()
@Controller('admin/tenant')
export class AdminTenantController {
  constructor(private readonly adminTenant: AdminTenantService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tenant-scoped KPI snapshot for the admin portal dashboard' })
  getDashboard(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getDashboard(principal);
  }

  @Get('services')
  @ApiOperation({ summary: 'List Postgres-backed tenant services (`services` table)' })
  listServices(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listServices(principal);
  }

  @Patch('services/:serviceId')
  @ApiOperation({
    summary: 'Patch catalogue fields for one tenant service (active flag, labels, SLA days)',
  })
  patchService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: PatchTenantServiceDto,
  ) {
    return this.adminTenant.patchService(principal, serviceId, dto);
  }

  @Get('services/:serviceId/designer')
  @ApiOperation({ summary: 'Load form + workflow draft/published state for one service' })
  getServiceDesigner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    return this.adminTenant.getServiceDesigner(principal, serviceId);
  }

  @Patch('services/:serviceId/form-draft')
  @ApiOperation({ summary: 'Create or update the draft citizen form schema for a service' })
  saveFormDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: SaveServiceFormDraftDto,
  ) {
    return this.adminTenant.saveFormDraft(principal, serviceId, dto);
  }

  @Patch('services/:serviceId/form-draft/publish')
  @ApiOperation({ summary: 'Publish the latest draft form schema for a service' })
  publishFormDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    return this.adminTenant.publishFormDraft(principal, serviceId);
  }

  @Patch('services/:serviceId/workflow-draft')
  @ApiOperation({ summary: 'Create or update the draft workflow definition for a service' })
  saveWorkflowDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: SaveServiceWorkflowDraftDto,
  ) {
    return this.adminTenant.saveWorkflowDraft(principal, serviceId, dto);
  }

  @Patch('services/:serviceId/workflow-draft/publish')
  @ApiOperation({ summary: 'Publish the latest draft workflow for a service' })
  publishWorkflowDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    return this.adminTenant.publishWorkflowDraft(principal, serviceId);
  }
}
