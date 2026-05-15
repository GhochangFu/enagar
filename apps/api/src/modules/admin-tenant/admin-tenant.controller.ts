import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminTenantService } from './admin-tenant.service';
import { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import {
  PatchTenantServiceConfigDto,
  UpsertAddressMasterDto,
  UpsertRevenueHeadDto,
  UpsertTariffDto,
} from './dto/service-config.dto';
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

  @Get('services/:serviceId/config')
  @ApiOperation({ summary: 'Load fee, document checklist, and revenue mapping for a service' })
  getServiceConfig(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    return this.adminTenant.getServiceConfig(principal, serviceId);
  }

  @Patch('services/:serviceId/config')
  @ApiOperation({
    summary: 'Patch fee rule, document checklist, and revenue mapping for a service',
  })
  patchServiceConfig(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: PatchTenantServiceConfigDto,
  ) {
    return this.adminTenant.patchServiceConfig(principal, serviceId, dto);
  }

  @Get('revenue-heads')
  @ApiOperation({ summary: 'List revenue heads and GL mappings available to tenant services' })
  listRevenueHeads(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listRevenueHeads(principal);
  }

  @Patch('revenue-heads')
  @ApiOperation({ summary: 'Create or update a revenue head and GL mapping' })
  upsertRevenueHead(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertRevenueHeadDto,
  ) {
    return this.adminTenant.upsertRevenueHead(principal, dto);
  }

  @Post('revenue-heads')
  @ApiOperation({ summary: 'Create or update a revenue head and GL mapping' })
  postRevenueHead(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertRevenueHeadDto,
  ) {
    return this.adminTenant.upsertRevenueHead(principal, dto);
  }

  @Get('address-master')
  @ApiOperation({ summary: 'List tenant address master rows' })
  listAddressMaster(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listAddressMaster(principal);
  }

  @Patch('address-master')
  @ApiOperation({ summary: 'Create or update a tenant address master row' })
  upsertAddressMaster(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertAddressMasterDto,
  ) {
    return this.adminTenant.upsertAddressMaster(principal, dto);
  }

  @Post('address-master')
  @ApiOperation({ summary: 'Create or update a tenant address master row' })
  postAddressMaster(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertAddressMasterDto,
  ) {
    return this.adminTenant.upsertAddressMaster(principal, dto);
  }

  @Get('tariffs')
  @ApiOperation({ summary: 'List tenant tax and tariff master rows' })
  listTariffs(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listTariffs(principal);
  }

  @Patch('tariffs')
  @ApiOperation({ summary: 'Create or update a tenant tax/tariff master row' })
  upsertTariff(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTariffDto,
  ) {
    return this.adminTenant.upsertTariff(principal, dto);
  }

  @Post('tariffs')
  @ApiOperation({ summary: 'Create or update a tenant tax/tariff master row' })
  postTariff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertTariffDto) {
    return this.adminTenant.upsertTariff(principal, dto);
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
