import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminTenantService } from './admin-tenant.service';
import { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import {
  PatchTenantServiceConfigDto,
  ImportAddressMasterCsvDto,
  UpsertAddressMasterDto,
  UpsertRevenueHeadDto,
  UpsertTariffDto,
} from './dto/service-config.dto';
import { SaveServiceFormDraftDto, SaveServiceWorkflowDraftDto } from './dto/service-designer.dto';
import {
  PatchTenantSettingsDto,
  UpsertKbArticleDto,
  UpsertNotificationTemplateDto,
  UpsertRoleStageMapDto,
  UpsertStaffDto,
  UpsertTenantBannerDto,
} from './dto/tenant-operations.dto';

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

  @Get('dashboard/deep')
  @ApiOperation({ summary: 'Tenant dashboard trends and SLA drill-down queues' })
  getDashboardDeep(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getDashboardDeep(principal);
  }

  @Get('exports/applications.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="applications.csv"')
  @ApiOperation({ summary: 'Export tenant applications as CSV' })
  exportApplications(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminTenant.exportApplicationsCsv(principal, { from, to });
  }

  @Get('exports/payments.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="payments.csv"')
  @ApiOperation({ summary: 'Export tenant payments as CSV' })
  exportPayments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminTenant.exportPaymentsCsv(principal, { from, to });
  }

  @Get('exports/grievances.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="grievances.csv"')
  @ApiOperation({ summary: 'Export tenant grievances as CSV' })
  exportGrievances(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminTenant.exportGrievancesCsv(principal, { from, to });
  }

  @Get('exports/sla-summary.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="sla-summary.csv"')
  @ApiOperation({ summary: 'Export tenant SLA summary as CSV' })
  exportSlaSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.exportSlaSummaryCsv(principal);
  }

  @Get('services')
  @ApiOperation({ summary: 'List Postgres-backed tenant services (`services` table)' })
  listServices(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listServices(principal);
  }

  @Get('catalogue/inherited')
  @ApiOperation({ summary: 'List global/inherited service catalogue governance rows' })
  listCatalogueGovernance(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listCatalogueGovernance(principal);
  }

  @Post('catalogue/:globalCode/adopt')
  @ApiOperation({ summary: 'Adopt or reactivate a global service for this tenant' })
  adoptCatalogueService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('globalCode') globalCode: string,
  ) {
    return this.adminTenant.adoptCatalogueService(principal, globalCode);
  }

  @Post('catalogue/:serviceCode/fork')
  @ApiOperation({ summary: 'Fork a global or tenant service into a tenant-owned local copy' })
  forkCatalogueService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceCode') serviceCode: string,
  ) {
    return this.adminTenant.forkCatalogueService(principal, serviceCode);
  }

  @Post('catalogue/:serviceCode/deactivate')
  @ApiOperation({
    summary: 'Deactivate this tenant view of a service without changing global template',
  })
  deactivateCatalogueService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceCode') serviceCode: string,
  ) {
    return this.adminTenant.deactivateCatalogueService(principal, serviceCode);
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

  @Post('address-master/import-csv')
  @ApiOperation({ summary: 'Dry-run or import tenant address master CSV rows' })
  importAddressMasterCsv(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ImportAddressMasterCsvDto,
  ) {
    return this.adminTenant.importAddressMasterCsv(principal, dto.csv, dto.dry_run ?? false);
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

  @Get('settings')
  @ApiOperation({ summary: 'Load tenant branding, languages, and feature flags' })
  getSettings(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getSettings(principal);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Patch tenant branding, languages, and feature flags' })
  patchSettings(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: PatchTenantSettingsDto,
  ) {
    return this.adminTenant.patchSettings(principal, dto);
  }

  @Get('banners')
  @ApiOperation({ summary: 'List tenant-scoped maintenance and outage banners' })
  listBanners(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listBanners(principal);
  }

  @Patch('banners')
  @ApiOperation({ summary: 'Create or update a tenant-scoped maintenance banner' })
  upsertBanner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTenantBannerDto,
  ) {
    return this.adminTenant.upsertBanner(principal, dto);
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create or update a tenant-scoped maintenance banner' })
  postBanner(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTenantBannerDto,
  ) {
    return this.adminTenant.upsertBanner(principal, dto);
  }

  @Get('notification-templates')
  @ApiOperation({ summary: 'List tenant notification templates' })
  listNotificationTemplates(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listNotificationTemplates(principal);
  }

  @Patch('notification-templates')
  @ApiOperation({ summary: 'Create or update a tenant notification template' })
  upsertNotificationTemplate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertNotificationTemplateDto,
  ) {
    return this.adminTenant.upsertNotificationTemplate(principal, dto);
  }

  @Post('notification-templates')
  @ApiOperation({ summary: 'Create or update a tenant notification template' })
  postNotificationTemplate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertNotificationTemplateDto,
  ) {
    return this.adminTenant.upsertNotificationTemplate(principal, dto);
  }

  @Get('kb-articles')
  @ApiOperation({ summary: 'List tenant knowledge-base articles' })
  listKbArticles(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listKbArticles(principal);
  }

  @Patch('kb-articles')
  @ApiOperation({ summary: 'Create or update a tenant knowledge-base article' })
  upsertKbArticle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertKbArticleDto,
  ) {
    return this.adminTenant.upsertKbArticle(principal, dto);
  }

  @Post('kb-articles')
  @ApiOperation({ summary: 'Create or update a tenant knowledge-base article' })
  postKbArticle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertKbArticleDto,
  ) {
    return this.adminTenant.upsertKbArticle(principal, dto);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List role codes available for tenant staff assignments' })
  listRoles(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listRoles(principal);
  }

  @Get('staff')
  @ApiOperation({ summary: 'List tenant staff and role assignments' })
  listStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listStaff(principal);
  }

  @Patch('staff')
  @ApiOperation({ summary: 'Create or update a tenant staff record and role assignments' })
  upsertStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertStaffDto) {
    return this.adminTenant.upsertStaff(principal, dto);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create or update a tenant staff record and role assignments' })
  postStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpsertStaffDto) {
    return this.adminTenant.upsertStaff(principal, dto);
  }

  @Get('role-stage-maps')
  @ApiOperation({ summary: 'List workflow stage role mappings' })
  listRoleStageMaps(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listRoleStageMaps(principal);
  }

  @Patch('role-stage-maps')
  @ApiOperation({ summary: 'Create or update workflow stage role mapping' })
  upsertRoleStageMap(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertRoleStageMapDto,
  ) {
    return this.adminTenant.upsertRoleStageMap(principal, dto);
  }

  @Post('role-stage-maps')
  @ApiOperation({ summary: 'Create or update workflow stage role mapping' })
  postRoleStageMap(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertRoleStageMapDto,
  ) {
    return this.adminTenant.upsertRoleStageMap(principal, dto);
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
