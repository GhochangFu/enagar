import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { BookingsService } from '../bookings/bookings.service';
import { BookingCancelDto } from '../bookings/dto/bookings.dto';
import {
  FormImportJobResponseDto,
  type FormImportUploadedFile,
} from '../form-import/dto/form-import.dto';
import { FormImportService } from '../form-import/form-import.service';

import { AdminTenantGrievanceConfigService } from './admin-tenant-grievance-config.service';
import { AdminTenantGrievanceGovernanceService } from './admin-tenant-grievance-governance.service';
import { AdminTenantOrgService } from './admin-tenant-org.service';
import { AdminTenantService } from './admin-tenant.service';
import {
  PatchGrievanceCategoryDto,
  PatchGrievanceSubtypeDto,
  ReplaceGrievanceRoutingRulesDto,
  ReplaceSlaPoliciesDto,
  UpsertGrievanceCategoryDto,
  UpsertGrievanceSubtypeDto,
} from './dto/grievance-config.dto';
import {
  PatchTenantDepartmentDto,
  PatchTenantDesignationDto,
  ReplaceUserDesignationsDto,
  UpsertDesignationStageMapDto,
  UpsertTenantDepartmentDto,
  UpsertTenantDesignationDto,
} from './dto/org-designations.dto';
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
  CreateStaffInviteDto,
  CreateStaffDto,
  ImportStaffCsvDto,
  DeskApplicationTransitionDto,
  DeskWorkOrderAssignDto,
  DeskCommentDto,
  DeskGrievanceAssignDto,
  DeskGrievanceStatusDto,
  PatchTenantSettingsDto,
  RequeueKbArticleDto,
  UpdateStaffInviteDto,
  UpsertBookableAssetDto,
  BulkBookableAvailabilityDto,
  UpsertBookableAvailabilityDto,
  UpsertBookingReservationDto,
  CreateBrandingAssetUploadIntentDto,
  UpsertBrandingAssetDto,
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
  constructor(
    private readonly adminTenant: AdminTenantService,
    private readonly formImport: FormImportService,
    private readonly bookings: BookingsService,
    private readonly grievanceConfig: AdminTenantGrievanceConfigService,
    private readonly grievanceGovernance: AdminTenantGrievanceGovernanceService,
    private readonly org: AdminTenantOrgService,
  ) {}

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

  @Get('dashboard/booking-summary')
  @ApiOperation({ summary: 'Tenant booking summary for dashboard (Sprint 8.5F2)' })
  getBookingSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getBookingSummary(principal);
  }

  @Get('dashboard/payment-summary')
  @ApiOperation({ summary: 'Tenant payment summary for dashboard' })
  getPaymentSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getPaymentSummary(principal);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Tenant payment ledger with filters' })
  listPayments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.adminTenant.listPayments(principal, {
      status,
      source,
      from,
      to,
      q,
      limit,
      cursor,
    });
  }

  @Get('payments/breakdown')
  @ApiOperation({ summary: 'Tenant payment aggregates by source, status, or service' })
  getPaymentBreakdown(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('group') group?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminTenant.getPaymentBreakdown(principal, {
      group,
      status,
      source,
      from,
      to,
    });
  }

  @Get('desk/me')
  @ApiOperation({ summary: 'Current Tenant Desk operator profile and role scope' })
  getDeskMe(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getDeskMe(principal);
  }

  @Get('desk/inbox/summary')
  @ApiOperation({ summary: 'Tenant Desk pending work counts for applications and grievances' })
  getDeskSummary(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getDeskSummary(principal);
  }

  @Get('desk/inbox/applications')
  @ApiOperation({ summary: 'Tenant Desk application inbox by operator role' })
  listDeskApplications(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('queue') queue?: string,
    @Query('dept') dept?: string,
    @Query('department_id') departmentId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.adminTenant.listDeskApplications(principal, queue ?? 'my', {
      dept,
      department_id: departmentId,
      page,
      page_size: pageSize,
    });
  }

  @Get('desk/applications/:docketNo')
  @ApiOperation({ summary: 'Tenant Desk application dossier with allowed transitions' })
  getDeskApplication(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('docketNo') docketNo: string,
  ) {
    return this.adminTenant.getDeskApplication(principal, docketNo);
  }

  @Get('desk/applications/:applicationId/documents/:documentId/blob')
  @ApiOperation({ summary: 'Tenant Desk application document blob for inline preview' })
  getDeskApplicationDocumentBlob(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.adminTenant
      .getDeskApplicationDocumentBlob(principal, applicationId, documentId)
      .then(
        ({ buffer, contentType, fileName }) =>
          new StreamableFile(buffer, {
            type: contentType,
            disposition: `inline; filename="${fileName.replace(/"/g, '')}"`,
          }),
      );
  }

  @Post('desk/applications/:applicationId/transitions')
  @ApiOperation({ summary: 'Execute a published workflow transition for an application' })
  transitionDeskApplication(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('applicationId') applicationId: string,
    @Body() dto: DeskApplicationTransitionDto,
  ) {
    return this.adminTenant.transitionDeskApplication(principal, applicationId, dto);
  }

  @Patch('desk/applications/:applicationId/work-order')
  @ApiOperation({ summary: 'Assign vendor or staff to the linked work order (Phase 12)' })
  assignDeskWorkOrder(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('applicationId') applicationId: string,
    @Body() dto: DeskWorkOrderAssignDto,
  ) {
    return this.adminTenant.assignDeskWorkOrder(principal, applicationId, dto);
  }

  @Get('desk/inbox/grievances')
  @ApiOperation({ summary: 'Tenant Desk grievance inbox by routed role or assignment' })
  listDeskGrievances(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('queue') queue?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.adminTenant.listDeskGrievances(principal, queue ?? 'my', {
      page,
      page_size: pageSize,
    });
  }

  @Get('desk/grievances/:grievanceId')
  @ApiOperation({ summary: 'Tenant Desk grievance detail with lifecycle actions' })
  getDeskGrievance(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('grievanceId') grievanceId: string,
  ) {
    return this.adminTenant.getDeskGrievance(principal, grievanceId);
  }

  @Get('desk/grievances/:grievanceId/attachments/:attachmentId/blob')
  @ApiOperation({ summary: 'Tenant Desk grievance evidence blob for inline preview' })
  getDeskGrievanceAttachmentBlob(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('grievanceId') grievanceId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.adminTenant
      .getDeskGrievanceAttachmentBlob(principal, grievanceId, attachmentId)
      .then(
        ({ buffer, contentType }) =>
          new StreamableFile(buffer, {
            type: contentType,
            disposition: 'inline',
          }),
      );
  }

  @Patch('desk/grievances/:grievanceId/status')
  @ApiOperation({ summary: 'Tenant Desk grievance status transition' })
  updateDeskGrievanceStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('grievanceId') grievanceId: string,
    @Body() dto: DeskGrievanceStatusDto,
  ) {
    return this.adminTenant.updateDeskGrievanceStatus(principal, grievanceId, dto);
  }

  @Post('desk/grievances/:grievanceId/assign')
  @ApiOperation({ summary: 'Tenant Desk admin assignment for a grievance' })
  assignDeskGrievance(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('grievanceId') grievanceId: string,
    @Body() dto: DeskGrievanceAssignDto,
  ) {
    return this.adminTenant.assignDeskGrievance(principal, grievanceId, dto.user_id);
  }

  @Post('desk/grievances/:grievanceId/comment')
  @ApiOperation({ summary: 'Tenant Desk comment on a grievance timeline' })
  commentDeskGrievance(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('grievanceId') grievanceId: string,
    @Body() dto: DeskCommentDto,
  ) {
    return this.adminTenant.commentDeskGrievance(principal, grievanceId, dto.body);
  }

  @Post('desk/grievances/staff/sweep-sla')
  @ApiOperation({ summary: 'Tenant Desk admin SLA sweep for overdue grievances' })
  sweepDeskGrievanceSla(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.sweepDeskGrievanceSla(principal);
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

  @Get('exports/:kind.pdf')
  @Header('content-type', 'application/pdf')
  @ApiOperation({ summary: 'Export tenant report summary as a PDF' })
  exportReportPdf(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('kind') kind: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminTenant.exportReportPdf(principal, kind, { from, to }).then(
      (buffer) =>
        new StreamableFile(buffer, {
          type: 'application/pdf',
          disposition: `attachment; filename="${kind}.pdf"`,
        }),
    );
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
    summary:
      'Patch catalogue fields for one tenant service (active flag, labels, SLA days, department)',
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

  @Post('kb-articles/requeue-index')
  @ApiOperation({ summary: 'Requeue a published KB article for RAG indexing' })
  requeueKbArticle(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: RequeueKbArticleDto,
  ) {
    return this.adminTenant.requeueKbArticle(principal, dto);
  }

  @Get('branding-assets')
  @ApiOperation({ summary: 'List tenant-scoped logo/hero branding assets' })
  listBrandingAssets(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listBrandingAssets(principal);
  }

  @Post('branding-assets/upload-intent')
  @ApiOperation({ summary: 'Presigned upload target for tenant logo/hero branding asset' })
  createBrandingAssetUploadIntent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateBrandingAssetUploadIntentDto,
  ) {
    return this.adminTenant.createBrandingAssetUploadIntent(principal, dto);
  }

  @Patch('branding-assets')
  @ApiOperation({ summary: 'Register or update a tenant branding asset' })
  upsertBrandingAsset(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertBrandingAssetDto,
  ) {
    return this.adminTenant.upsertBrandingAsset(principal, dto);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List bookable assets, availability windows, and reservations' })
  listBookings(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listBookableAssets(principal);
  }

  @Patch('bookings/assets')
  @ApiOperation({ summary: 'Create or update a bookable asset' })
  upsertBookableAsset(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertBookableAssetDto,
  ) {
    return this.adminTenant.upsertBookableAsset(principal, dto);
  }

  @Post('bookings/availability')
  @ApiOperation({ summary: 'Add availability or blackout window for a bookable asset' })
  addBookableAvailability(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertBookableAvailabilityDto,
  ) {
    return this.adminTenant.addBookableAvailability(principal, dto);
  }

  @Post('bookings/availability/bulk')
  @ApiOperation({
    summary:
      'Bulk-generate availability or blackout windows (IST date range + weekdays + daily hours)',
  })
  bulkAddBookableAvailability(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: BulkBookableAvailabilityDto,
  ) {
    return this.adminTenant.bulkAddBookableAvailability(principal, dto);
  }

  @Post('bookings/reservations')
  @ApiOperation({ summary: 'Create a conflict-checked reservation hold or booking' })
  addBookingReservation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertBookingReservationDto,
  ) {
    return this.adminTenant.addBookingReservation(principal, dto);
  }

  @Post('bookings/reservations/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking reservation (staff, Sprint 8.1B)' })
  cancelBookingReservation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') reservationId: string,
    @Body() dto: BookingCancelDto,
  ) {
    return this.bookings.cancelReservation(principal, reservationId, dto);
  }

  @Get('org/departments')
  @ApiOperation({ summary: 'List tenant departments (workflow designations — Masters)' })
  listOrgDepartments(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.org.listDepartments(principal);
  }

  @Post('org/departments')
  @ApiOperation({ summary: 'Create a tenant department' })
  createOrgDepartment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTenantDepartmentDto,
  ) {
    return this.org.createDepartment(principal, dto);
  }

  @Patch('org/departments/:code')
  @ApiOperation({ summary: 'Update a tenant department' })
  patchOrgDepartment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: PatchTenantDepartmentDto,
  ) {
    return this.org.patchDepartment(principal, code, dto);
  }

  @Get('org/designations')
  @ApiOperation({ summary: 'List tenant designations (optional department_id filter)' })
  listOrgDesignations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('department_id') departmentId?: string,
  ) {
    return this.org.listDesignations(principal, departmentId);
  }

  @Post('org/designations')
  @ApiOperation({ summary: 'Create a tenant designation' })
  createOrgDesignation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertTenantDesignationDto,
  ) {
    return this.org.createDesignation(principal, dto);
  }

  @Patch('org/designations/:code')
  @ApiOperation({ summary: 'Update a tenant designation' })
  patchOrgDesignation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: PatchTenantDesignationDto,
  ) {
    return this.org.patchDesignation(principal, code, dto);
  }

  @Get('org/users/:userId/designations')
  @ApiOperation({ summary: 'List designations assigned to a staff user' })
  listUserOrgDesignations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('userId') userId: string,
  ) {
    return this.org.listUserDesignations(principal, userId);
  }

  @Put('org/users/:userId/designations')
  @ApiOperation({ summary: 'Replace designations assigned to a staff user' })
  replaceUserOrgDesignations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('userId') userId: string,
    @Body() dto: ReplaceUserDesignationsDto,
  ) {
    return this.org.replaceUserDesignations(principal, userId, dto);
  }

  @Get('org/designation-stage-maps')
  @ApiOperation({ summary: 'List designation ↔ workflow stage permission rows' })
  listDesignationStageMaps(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.org.listDesignationStageMaps(principal);
  }

  @Post('org/designation-stage-maps')
  @ApiOperation({ summary: 'Upsert designation ↔ workflow stage permissions' })
  upsertDesignationStageMap(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertDesignationStageMapDto,
  ) {
    return this.org.upsertDesignationStageMap(principal, dto);
  }

  @Put('org/designation-stage-maps')
  @ApiOperation({ summary: 'Upsert designation ↔ workflow stage permissions (idempotent)' })
  putDesignationStageMap(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertDesignationStageMapDto,
  ) {
    return this.org.upsertDesignationStageMap(principal, dto);
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

  @Get('staff-invites')
  @ApiOperation({ summary: 'List guided tenant staff invite/provisioning records' })
  listStaffInvites(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listStaffInvites(principal);
  }

  @Post('staff/create')
  @ApiOperation({ summary: 'Create tenant staff with Keycloak identity and default password' })
  createStaff(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateStaffDto) {
    return this.adminTenant.createStaff(principal, dto);
  }

  @Post('staff/import-csv')
  @ApiOperation({ summary: 'Bulk create tenant staff from CSV (Keycloak + eNagar records)' })
  importStaffCsv(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ImportStaffCsvDto,
  ) {
    return this.adminTenant.importStaffCsv(principal, dto.csv, dto.dry_run ?? false);
  }

  @Post('staff-invites')
  @ApiOperation({ summary: 'Create a guided tenant staff invite with dry-run Keycloak fallback' })
  createStaffInvite(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateStaffInviteDto,
  ) {
    return this.adminTenant.createStaffInvite(principal, dto);
  }

  @Patch('staff-invites')
  @ApiOperation({ summary: 'Retry, disable, or mark a tenant staff invite as provisioned' })
  updateStaffInvite(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateStaffInviteDto,
  ) {
    return this.adminTenant.updateStaffInvite(principal, dto);
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

  @Post('services/:serviceId/form-draft/resync-from-global')
  @ApiOperation({
    summary: 'Load the linked State global form template into this service form draft',
  })
  resyncFormDraftFromGlobal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
  ) {
    return this.adminTenant.resyncFormDraftFromGlobal(principal, serviceId);
  }

  @Post('services/:serviceId/form-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a municipal form file and enqueue a form-import job (EN-26)',
    description:
      'Phase 0 contract stub — returns 501 until EN-32 wires Excel extraction. Proposal includes per-field confidence and optional proposed_schema preview.',
  })
  createFormImportJob(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @UploadedFile() file: FormImportUploadedFile,
  ): FormImportJobResponseDto {
    return this.formImport.createTenantImportJob(principal, serviceId, file);
  }

  @Get('services/:serviceId/form-import/:jobId')
  @ApiOperation({
    summary: 'Poll a tenant form-import job for status and proposed schema (EN-26)',
  })
  getFormImportJob(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Param('jobId') jobId: string,
  ): FormImportJobResponseDto {
    return this.formImport.getTenantImportJob(principal, serviceId, jobId);
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

  @Get('grievance-catalogue/categories')
  @ApiOperation({ summary: 'List tenant grievance categories (Masters)' })
  listGrievanceCategories(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievanceConfig.listCategories(principal);
  }

  @Get('grievance-catalogue/governance')
  @ApiOperation({
    summary: 'Tenant catalogue rows plus adoptable global categories (Sprint 6.24)',
  })
  listGrievanceCatalogueGovernance(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievanceGovernance.listGovernance(principal);
  }

  @Post('grievance-catalogue/global/:globalCode/adopt')
  @ApiOperation({ summary: 'Adopt a global grievance category for this tenant' })
  adoptGlobalGrievanceCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('globalCode') globalCode: string,
  ) {
    return this.grievanceGovernance.adoptGlobalCategory(principal, globalCode);
  }

  @Post('grievance-catalogue/categories/:code/fork')
  @ApiOperation({ summary: 'Fork a category into a tenant-local copy' })
  forkGrievanceCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.grievanceGovernance.forkCategory(principal, code);
  }

  @Post('grievance-catalogue/categories/:code/deactivate')
  @ApiOperation({ summary: 'Deactivate a tenant grievance category (hide from citizens)' })
  deactivateGrievanceCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.grievanceGovernance.deactivateCategory(principal, code);
  }

  @Post('grievance-catalogue/categories')
  @ApiOperation({ summary: 'Create a tenant-only grievance category' })
  createGrievanceCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpsertGrievanceCategoryDto,
  ) {
    return this.grievanceConfig.createCategory(principal, dto);
  }

  @Patch('grievance-catalogue/categories/:code')
  @ApiOperation({ summary: 'Update grievance category labels, sort, or active flag' })
  patchGrievanceCategory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: PatchGrievanceCategoryDto,
  ) {
    return this.grievanceConfig.patchCategory(principal, code, dto);
  }

  @Get('grievance-catalogue/categories/:code/subtypes')
  @ApiOperation({ summary: 'List sub-types for a grievance category' })
  listGrievanceSubtypes(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
  ) {
    return this.grievanceConfig.listSubtypes(principal, code);
  }

  @Post('grievance-catalogue/categories/:code/subtypes')
  @ApiOperation({ summary: 'Create a sub-type under a category' })
  createGrievanceSubtype(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() dto: UpsertGrievanceSubtypeDto,
  ) {
    return this.grievanceConfig.createSubtype(principal, code, dto);
  }

  @Patch('grievance-catalogue/categories/:code/subtypes/:subtypeCode')
  @ApiOperation({ summary: 'Update a grievance sub-type' })
  patchGrievanceSubtype(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Param('subtypeCode') subtypeCode: string,
    @Body() dto: PatchGrievanceSubtypeDto,
  ) {
    return this.grievanceConfig.patchSubtype(principal, code, subtypeCode, dto);
  }

  @Get('sla-policies')
  @ApiOperation({ summary: 'List grievance SLA policies for this tenant' })
  listSlaPolicies(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievanceConfig.listSlaPolicies(principal);
  }

  @Put('sla-policies')
  @ApiOperation({ summary: 'Replace all grievance SLA policies (ordered)' })
  replaceSlaPolicies(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ReplaceSlaPoliciesDto,
  ) {
    return this.grievanceConfig.replaceSlaPolicies(principal, dto);
  }

  @Get('grievance-routing-rules')
  @ApiOperation({ summary: 'List grievance routing rules for this tenant' })
  listGrievanceRoutingRules(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievanceConfig.listRoutingRules(principal);
  }

  @Put('grievance-routing-rules')
  @ApiOperation({ summary: 'Replace all grievance routing rules (ordered)' })
  replaceGrievanceRoutingRules(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ReplaceGrievanceRoutingRulesDto,
  ) {
    return this.grievanceConfig.replaceRoutingRules(principal, dto);
  }
}
