import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminStateGrievanceLibraryService } from './admin-state-grievance-library.service';
import { AdminStateService } from './admin-state.service';
import {
  AdoptGrievanceCatalogueDto,
  PatchGlobalGrievanceCategoryDto,
  PatchGlobalGrievanceSubtypeDto,
  UpsertGlobalGrievanceCategoryDto,
  UpsertGlobalGrievanceSubtypeDto,
} from './dto/grievance-library.dto';
import {
  CreateImpersonationTokenDto,
  GlobalServiceLifecycleDto,
  UpsertGlobalServiceTemplateDto,
  UpsertStateIntegrationDto,
  UpsertTenantDto,
} from './dto/state-admin.dto';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-state')
@ApiBearerAuth()
@Controller('admin/state')
export class AdminStateController {
  constructor(
    private readonly adminState: AdminStateService,
    private readonly grievanceLibrary: AdminStateGrievanceLibraryService,
  ) {}

  @Get('analytics')
  @ApiOperation({ summary: 'State-wide KPI snapshot for super-admin portal' })
  getAnalytics(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.getAnalytics(principal);
  }

  @Get('analytics/v2')
  @ApiOperation({ summary: 'State-wide analytics with date ranges, deltas, and anomaly hints' })
  getAnalyticsV2(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminState.getAnalyticsV2(principal, { from, to });
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

  @Get('global-service-library')
  @ApiOperation({ summary: 'List global service templates for state curation' })
  listGlobalServiceLibrary(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.listGlobalServiceTemplates(principal);
  }

  @Get('global-service-library/:code/preview')
  @ApiOperation({ summary: 'Preview tenant impact before publishing a global service template' })
  previewGlobalServiceLibrary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.adminState.previewGlobalServiceTemplate(principal, code);
  }

  @Patch('global-service-library')
  @ApiOperation({ summary: 'Draft or update a global service template' })
  upsertGlobalServiceLibrary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertGlobalServiceTemplateDto,
  ) {
    return this.adminState.upsertGlobalServiceTemplate(principal, dto);
  }

  @Post('global-service-library/lifecycle')
  @ApiOperation({ summary: 'Publish or deprecate a global service template' })
  updateGlobalServiceLifecycle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: GlobalServiceLifecycleDto,
  ) {
    return this.adminState.updateGlobalServiceLifecycle(principal, dto);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'List external integration readiness metadata' })
  listIntegrations(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.listIntegrations(principal);
  }

  @Patch('integrations')
  @ApiOperation({ summary: 'Update metadata-only integration readiness status' })
  upsertIntegration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertStateIntegrationDto,
  ) {
    return this.adminState.upsertIntegration(principal, dto);
  }

  @Post('integrations/:providerKey/check')
  @ApiOperation({ summary: 'Run safe local/stub readiness check for an integration provider' })
  checkIntegration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('providerKey') providerKey: string,
  ) {
    return this.adminState.checkIntegration(principal, providerKey);
  }

  @Get('integrations.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="state-integrations.csv"')
  @ApiOperation({ summary: 'Export integration readiness metadata for DevOps review' })
  exportIntegrations(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.exportIntegrationsCsv(principal);
  }

  @Get('audit-coverage')
  @ApiOperation({ summary: 'Sprint 6.12 audit coverage matrix' })
  getAuditCoverage(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminState.getAuditCoverage(principal);
  }

  @Get('grievance-library/categories')
  @ApiOperation({ summary: 'List global grievance categories (state library)' })
  listGrievanceLibraryCategories(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievanceLibrary.listCategories(principal);
  }

  @Post('grievance-library/categories')
  @ApiOperation({ summary: 'Create a global grievance category' })
  createGrievanceLibraryCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertGlobalGrievanceCategoryDto,
  ) {
    return this.grievanceLibrary.createCategory(principal, dto);
  }

  @Patch('grievance-library/categories/:code')
  @ApiOperation({ summary: 'Update a global grievance category' })
  patchGrievanceLibraryCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: PatchGlobalGrievanceCategoryDto,
  ) {
    return this.grievanceLibrary.patchCategory(principal, code, dto);
  }

  @Get('grievance-library/categories/:code/subtypes')
  @ApiOperation({ summary: 'List sub-types for a global grievance category' })
  listGrievanceLibrarySubtypes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.grievanceLibrary.listSubtypes(principal, code);
  }

  @Post('grievance-library/categories/:code/subtypes')
  @ApiOperation({ summary: 'Create a global grievance sub-type' })
  createGrievanceLibrarySubtype(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: UpsertGlobalGrievanceSubtypeDto,
  ) {
    return this.grievanceLibrary.createSubtype(principal, code, dto);
  }

  @Patch('grievance-library/categories/:code/subtypes/:subtypeCode')
  @ApiOperation({ summary: 'Update a global grievance sub-type' })
  patchGrievanceLibrarySubtype(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Param('subtypeCode') subtypeCode: string,
    @Body() dto: PatchGlobalGrievanceSubtypeDto,
  ) {
    return this.grievanceLibrary.patchSubtype(principal, code, subtypeCode, dto);
  }

  @Get('tenants/:code/grievance-catalogue')
  @ApiOperation({ summary: 'Read-only tenant grievance catalogue vs global library' })
  getTenantGrievanceCatalogueOversight(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.grievanceLibrary.listTenantCatalogueOversight(principal, code);
  }

  @Post('tenants/:code/grievance-catalogue/adopt')
  @ApiOperation({ summary: 'Adopt global grievance categories for a municipality' })
  adoptTenantGrievanceCatalogue(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: AdoptGrievanceCatalogueDto,
  ) {
    return this.grievanceLibrary.adoptForTenant(principal, code, dto);
  }
}
