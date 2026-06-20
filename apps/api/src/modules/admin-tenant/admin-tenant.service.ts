import { randomUUID } from 'node:crypto';

import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import {
  calculateSlaDueAt,
  createLinearWorkflowDraft,
  evaluateTransition,
  officerMaySetRequireBoc,
  pendingActorFromWorkflowStage,
  readBocPolicy,
  transitionRequiresBocResolutionFields,
  transitionActorAllowed,
  validateWorkflowDefinition,
  workflowForPattern,
} from '@enagar/workflow';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { KeycloakAdminProvisionerService } from '../../common/keycloak/keycloak-admin-provisioner.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { renderSimplePdf } from '../../common/pdf/simple-pdf';
import {
  countFormInputFields,
  isUsableFormSchema,
  resolveOnboardingFormSchema,
} from '../admin-state/tenant-service-onboarding-forms';
import { bookableAssetCodesFromOverrideConfig } from '../bookings/bookable-asset-scope.util';
import { assertBookableWindow } from '../bookings/bookable-window';
import { resolveBookingChargesSummary } from '../bookings/booking-charges-summary.util';
import { BookingsService } from '../bookings/bookings.service';
import {
  assertHm,
  istWindowToIso,
  listIstDatesMatchingWeekdays,
  parseIstYmd,
} from '../bookings/bulk-availability.util';
import { decimalToNumber } from '../documents/application-document.mapper';
import {
  assertGrievanceTransition,
  GRIEVANCE_STATUSES,
  isGrievanceStatus,
  type GrievanceStatus,
} from '../grievances/grievance-lifecycle';
import { coerceFeeSettlementSnapshot, parseFeeLineCode } from '../payments/fee-settlement.util';
import { PaymentsService } from '../payments/payments.service';
import { attachPendingAtLabels } from '../services/pending-at-label.util';
import {
  ensureTenantServiceCategory,
  ensureTenantServiceCategoryOnDepartment,
  seedCategoryCodeFromNavigation,
} from '../services/tenant-service-category.resolver';
import {
  workflowDefinitionFromRows,
  workflowStageCreateInput,
  workflowTransitionCreateInput,
} from '../services/workflow-designation.mapper';
import { PostApprovalExecutionService } from '../work-orders/post-approval-execution.service';
import {
  WorkOrdersService,
  type WorkOrderResponse,
  type TenantVendorResponse,
} from '../work-orders/work-orders.service';

import {
  buildTenantBookingSummary,
  type TenantAdminBookingSummary,
} from './admin-tenant-booking-summary.util';
import {
  assertCode,
  assertLocaleLabel,
  assertValidDocumentChecklist,
  normalizeDocumentChecklist,
  assertValidFeeRule,
  assertValidPaymentSchedule,
  primaryFeeLineCode,
  readPaymentScheduleFromConfig,
  resolveServicePaymentConfig,
  legacyFeeRuleToFeeLine,
  assertSupportedLocale,
  assertTenantBannerSeverity,
  assertOptionalIsoDate,
  assertValidBranding,
  assertValidFeatureFlags,
  assertValidKbArticleStatus,
  assertValidLanguageList,
  assertValidLocalizedMarkdown,
  assertValidNotificationChannel,
  assertValidNotificationVariables,
  assertValidTagList,
  assertValidTariffCategory,
  calculateFeePreview,
} from './admin-tenant-config.contracts';
import { applyBocTransitionPayload, deskSnapshotForAllowedTransition } from './boc-desk.util';
import { deskApplicationInMyQueue, deskMyQueueWhereClause } from './desk-queue.util';
import {
  readMunicipalSignoffPolicyFromConfig,
  readMunicipalSignoffThresholdFromConfig,
} from './municipal-desk.util';
import { loadStaffDesignationContext } from './staff-designations.util';
import { assertTenantPortalAdminWrite, assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type {
  FeeRule,
  PaymentSchedule,
  ResolvedServicePaymentConfig,
  ServiceFeeLines,
} from './admin-tenant-config.contracts';
import type { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import type {
  PatchTenantServiceConfigDto,
  UpsertAddressMasterDto,
  UpsertRevenueHeadDto,
  UpsertTariffDto,
} from './dto/service-config.dto';
import type {
  SaveServiceFormDraftDto,
  SaveServiceWorkflowDraftDto,
} from './dto/service-designer.dto';
import type {
  CreateStaffDto,
  CreateStaffInviteDto,
  PatchTenantSettingsDto,
  RequeueKbArticleDto,
  UpdateStaffInviteDto,
  UpsertBookableAssetDto,
  BulkBookableAvailabilityDto,
  UpsertBookableAvailabilityDto,
  UpsertBookingReservationDto,
  UpsertBrandingAssetDto,
  UpsertKbArticleDto,
  UpsertNotificationTemplateDto,
  UpsertTenantBannerDto,
  UpsertRoleStageMapDto,
  UpsertStaffDto,
} from './dto/tenant-operations.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { EnagarFormSchema } from '@enagar/forms';
import type { WorkflowDefinition, WorkflowEffect, WorkflowRole } from '@enagar/workflow';

export type TenantAdminDashboardSnapshot = {
  tenant_id: string;
  tenant_code?: string;
  applications_total: number;
  applications_open: number;
  grievances_open: number;
  grievances_sla_breached_open: number;
  citizens_registered: number;
  payments_settled_last_30_days: number;
};

export type TenantAdminDashboardDeep = {
  application_trends_30d: Array<{ date: string; submitted: number }>;
  payment_trends_30d: Array<{ date: string; settled: number; amount_paise: number }>;
  breached_grievances: Array<{
    id: string;
    reference: string;
    category: string;
    status: string;
    sla_due_at: string | null;
    sla_breached_at: string | null;
    updated_at: string;
  }>;
  breached_applications: Array<{
    id: string;
    docket_no: string;
    service_code: string;
    status: string;
    pending_role: string | null;
    submitted_at: string;
    updated_at: string;
    expected_sla_at: string | null;
  }>;
  top_services: Array<{
    service_code: string;
    name: Prisma.JsonValue;
    open_applications: number;
    recent_submissions_30d: number;
  }>;
};

export type TenantAdminPaymentSource = 'application' | 'booking' | 'rental' | 'ev' | 'water';

export type TenantAdminPaymentSummary = {
  period_days: number;
  totals: {
    settled_count: number;
    settled_amount_paise: number;
    pending_count: number;
    failed_count: number;
  };
  by_source: Array<{ source: TenantAdminPaymentSource; count: number; amount_paise: number }>;
  trends_30d: Array<{ date: string; settled: number; amount_paise: number }>;
};

export type TenantAdminPaymentLedgerRow = {
  id: string;
  amount_paise: number;
  currency: string;
  status: string;
  method: string;
  gateway: string;
  fee_code: string;
  created_at: string;
  settled_at: string | null;
  source: TenantAdminPaymentSource;
  reference: string;
  service_code: string | null;
  citizen_subject: string;
  deep_link: string | null;
};

export type TenantAdminPaymentBreakdownRow = {
  key: string;
  label: string;
  count: number;
  amount_paise: number;
};

export type TenantAdminAddressImportResult = {
  dry_run: boolean;
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; field: string; message: string }>;
};

export type TenantAdminServiceRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  is_active: boolean;
  effective_sla_days: number | null;
  updated_at: string;
};

export type TenantAdminCatalogueRow = {
  code: string;
  source: 'global' | 'tenant_override' | 'tenant_only' | 'forked';
  global_code: string | null;
  tenant_service_id: string | null;
  category_code: string;
  department_id: string | null;
  department_code: string | null;
  department_name: Prisma.JsonValue | null;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  is_active: boolean;
  has_local_override: boolean;
  updated_at: string | null;
};

export type TenantAdminServiceConfig = TenantAdminServiceRow & {
  fee_rule: Prisma.JsonValue;
  fee_preview_paise: number | null;
  payment_schedule: PaymentSchedule;
  fee_lines: ServiceFeeLines;
  fee_line_previews: ResolvedServicePaymentConfig['fee_line_previews'];
  payment_schedule_inferred: boolean;
  required_documents: Prisma.JsonValue;
  boc_policy: ReturnType<typeof readBocPolicy>;
  municipal_signoff_policy: ReturnType<typeof readMunicipalSignoffPolicyFromConfig>;
  municipal_signoff_threshold_paise: number;
  revenue_head: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    accounting_code: string;
  } | null;
  /** Asset codes linked for citizen booking (from override_config). */
  bookable_asset_codes: string[];
};

export type TenantAdminRevenueHeadRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  accounting_code: string;
  is_active: boolean;
};

export type TenantAdminAddressMasterRow = {
  borough_code: string | null;
  borough_name: string | null;
  ward_number: string | null;
  ward_name: string | null;
  mouza: string | null;
  locality_id: string;
  locality_name: string;
  pincode: string | null;
};

export type TenantAdminTariffRow = {
  id: string;
  code: string;
  category: string;
  name: Prisma.JsonValue;
  rate_config: Prisma.JsonValue;
  preview_paise: number | null;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminFormVersionRow = {
  id: string;
  version: number;
  status: string;
  form_schema: Prisma.JsonValue;
  ui_schema: Prisma.JsonValue;
  published_at: string | null;
};

export type TenantAdminWorkflowRow = {
  id: string;
  code: string;
  version: number;
  status: string;
  name: Prisma.JsonValue;
  published_at: string | null;
  definition: WorkflowDefinition;
};

export type TenantAdminGlobalFormTemplate = {
  global_code: string;
  has_usable_form_schema: boolean;
  field_count: number;
};

export type TenantAdminServiceDesigner = {
  service: TenantAdminServiceRow;
  /** From global catalogue (e.g. booking, cert-issuance). Drives starter workflow and booking UI. */
  workflow_pattern: string | null;
  form_draft: TenantAdminFormVersionRow | null;
  form_published: TenantAdminFormVersionRow | null;
  workflow_draft: TenantAdminWorkflowRow | null;
  workflow_published: TenantAdminWorkflowRow | null;
  global_form_template: TenantAdminGlobalFormTemplate | null;
  starter_form_schema: EnagarFormSchema;
  starter_workflow: WorkflowDefinition;
};

export type TenantAdminFormResyncFromGlobalResult = {
  form_draft: TenantAdminFormVersionRow;
  global_code: string;
  field_count: number;
};

export type TenantAdminSettings = {
  tenant_id: string;
  tenant_code?: string;
  branding: Prisma.JsonValue;
  feature_flags: Prisma.JsonValue;
  languages_enabled: string[];
  default_language: string;
  contact_phone: string | null;
  contact_email: string | null;
};

export type TenantAdminNotificationTemplateRow = {
  id: string;
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string | null;
  body: string;
  variables: Prisma.JsonValue;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminBannerRow = {
  id: string;
  code: string;
  severity: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminKbArticleRow = {
  id: string;
  slug: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  tags: string[];
  status: string;
  published_at: string | null;
  index_status: string | null;
  index_updated_at: string | null;
  updated_at: string;
};

export type TenantAdminBrandingAssetRow = {
  id: string;
  code: string;
  kind: string;
  storage_key: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  contrast_warnings: string[];
  updated_at: string;
};

export type TenantAdminBookableAssetRow = {
  id: string;
  code: string;
  asset_type: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  capacity: number | null;
  rate_unit: string;
  base_rate_paise: number;
  security_deposit_paise: number;
  slot_step_minutes: number;
  rules: Prisma.JsonValue;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminBookableAvailabilityRow = {
  id: string;
  asset_code: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

export type TenantAdminBookingReservationRow = {
  id: string;
  asset_code: string;
  booking_no: string | null;
  citizen_id: string | null;
  deposit_id: string | null;
  docket_no: string | null;
  holder_name: string;
  holder_mobile: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  note: string | null;
  updated_at: string;
};

export type TenantAdminRoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type TenantAdminStaffRow = {
  id: string;
  keycloak_user_id: string;
  username: string;
  display_name: string;
  email: string | null;
  mobile: string | null;
  status: string;
  roles: Array<{ code: string; name: string; ward_number: string | null }>;
  updated_at: string;
};

export type TenantAdminCreateStaffResult = {
  staff: TenantAdminStaffRow;
  login_username: string;
  password_hint: string;
};

export type TenantAdminStaffImportResult = {
  dry_run: boolean;
  created: number;
  failed: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  previews: Array<{ row: number; username: string; display_name: string; role_codes: string[] }>;
  created_accounts: Array<{
    row: number;
    username: string;
    display_name: string;
    password_hint: string;
  }>;
};

export type TenantAdminStaffInviteRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  mobile: string | null;
  role_codes: string[];
  ward_number: string | null;
  status: string;
  provisioning_mode: string;
  keycloak_user_id: string | null;
  failure_reason: string | null;
  metadata: Prisma.JsonValue;
  updated_at: string;
};

export type TenantAdminRoleStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  stage_label: Prisma.JsonValue;
  role_code: string;
  can_view: boolean;
  can_act: boolean;
};

export type TenantDeskMe = {
  subject: string;
  tenant_id: string;
  tenant_code?: string;
  roles: string[];
  normalized_roles: string[];
  is_admin: boolean;
  ward_scopes: Array<{ id: string; number: string; name: string | null }>;
};

export type TenantDeskSummary = {
  applications_my_queue: number;
  applications_all_open: number;
  grievances_my_queue: number;
  grievances_all_open: number;
  grievances_sla_breached: number;
};

export type TenantDeskInboxPage<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type TenantDeskApplicationListItem = {
  id: string;
  docket_no: string;
  service_code: string;
  service_name: string;
  status: string;
  status_label: string;
  current_stage: string;
  pending_role: string | null;
  pending_designation: string | null;
  pending_at_label: string | null;
  payment_status: string;
  payment_schedule?: 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';
  fee_settlement?: Partial<
    Record<
      'application' | 'approval',
      {
        status: 'not_required' | 'pending' | 'paid' | 'failed';
        amount_paise?: number | null;
      }
    >
  >;
  payment_redirect_url?: string | null;
  active_payment_id?: string | null;
  booking_charges?: {
    application_fee_paise: number;
    hall_rent_paise: number;
    security_deposit_paise: number;
    upfront_total_paise: number;
    upfront_paid_paise: number;
    application_fee_status: 'not_required' | 'pending' | 'paid' | 'failed';
    hall_rent_status: 'not_required' | 'pending' | 'paid' | 'failed';
    security_deposit_status: 'not_required' | 'pending' | 'paid' | 'failed';
    slot_summary: string | null;
    reservation_id: string | null;
  };
  submitted_at: string;
  updated_at: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
};

export type TenantDeskAllowedTransition = {
  verb: string;
  to_stage: string;
  label: string;
  actor_role: string;
  actor_designation: string | null;
  requires_comment: boolean;
  requires_boc_resolution_fields: boolean;
  officer_may_set_require_boc: boolean;
  boc_policy: ReturnType<typeof readBocPolicy>;
};

export type TenantDeskApplicationDocument = {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  upload_status: string;
  scan_status: string;
  created_at: string;
};

export type TenantDeskApplicationDetail = {
  application: TenantDeskApplicationListItem & {
    form_data: Prisma.JsonValue;
    timeline: Array<{
      id: string;
      from_stage: string | null;
      to_stage: string;
      verb: string;
      actor_role: string;
      comment: string | null;
      created_at: string;
    }>;
    documents: TenantDeskApplicationDocument[];
  };
  work_order: WorkOrderResponse | null;
  vendors: TenantVendorResponse[];
  allowed_transitions: TenantDeskAllowedTransition[];
};

export type TenantAdminBrandingUploadIntentResponse = {
  storage_key: string;
  upload_url: string;
  upload_expires_at: string;
  public_url: string;
  mime_type: string;
  original_name: string;
};

export type TenantDeskGrievanceListItem = {
  id: string;
  grievance_no: string;
  category: string;
  category_label: string;
  subtype_code: string | null;
  subtype_label: string | null;
  status: string;
  priority: string;
  routed_role_code: string | null;
  assigned_to_user_id: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantDeskGrievanceAttachment = {
  id: string;
  content_type: string;
  storage_key: string;
  created_at: string;
  download_url: string;
};

export type TenantDeskGrievanceDetail = {
  grievance: TenantDeskGrievanceListItem & {
    description: string;
    location: Prisma.JsonValue;
    photo_keys: Prisma.JsonValue;
    attachments: TenantDeskGrievanceAttachment[];
  };
  timeline: Array<{
    id: string;
    event_type: string;
    actor_subject: string;
    body: string | null;
    metadata: Prisma.JsonValue;
    occurred_at: string;
  }>;
  allowed_statuses: GrievanceStatus[];
};

type WorkflowWithChildren = Prisma.WorkflowGetPayload<{
  include: {
    stages: true;
    transitions: {
      include: {
        fromStage: true;
        toStage: true;
      };
    };
  };
}>;

function mergeLabels(
  existing: Prisma.JsonValue,
  patch?: Record<string, unknown>,
): Prisma.JsonValue {
  if (!patch || typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return existing;
  }
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.JsonValue;
}

@Injectable()
export class AdminTenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
    private readonly payments: PaymentsService,
    private readonly workOrders: WorkOrdersService,
    private readonly postApprovalExecution: PostApprovalExecutionService,
    private readonly keycloakProvisioner: KeycloakAdminProvisionerService,
    @Optional() @Inject(BookingsService) private readonly bookings?: BookingsService,
  ) {}

  async getDashboard(principal: AuthenticatedPrincipal): Promise<TenantAdminDashboardSnapshot> {
    assertTenantPortalStaff(principal);
    const tenantId = principal.tenantId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const terminalGrievance = ['resolved', 'closed'];

    const [
      applications_total,
      applications_open,
      grievances_open,
      grievances_sla_breached_open,
      citizens_registered,
      payments_settled_last_30_days,
    ] = await Promise.all([
      this.prisma.application.count({ where: { tenantId } }),
      this.prisma.application.count({
        where: { tenantId, NOT: { status: 'closed' } },
      }),
      this.prisma.grievance.count({
        where: { tenantId, NOT: { status: { in: terminalGrievance } } },
      }),
      this.prisma.grievance.count({
        where: {
          tenantId,
          slaBreachedAt: { not: null },
          NOT: { status: { in: terminalGrievance } },
        },
      }),
      this.prisma.citizen.count({ where: { tenantId } }),
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'settled',
          settledAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return {
      tenant_id: tenantId,
      tenant_code: principal.tenantCode,
      applications_total,
      applications_open,
      grievances_open,
      grievances_sla_breached_open,
      citizens_registered,
      payments_settled_last_30_days,
    };
  }

  async getBookingSummary(principal: AuthenticatedPrincipal): Promise<TenantAdminBookingSummary> {
    assertTenantPortalStaff(principal);
    const periodDays = 30;
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [periodRows, recentRows] = await Promise.all([
      this.prisma.bookingReservation.findMany({
        where: {
          tenantId: principal.tenantId,
          startsAt: { gte: periodStart },
        },
        include: { asset: true },
      }),
      this.prisma.bookingReservation.findMany({
        where: { tenantId: principal.tenantId },
        include: { asset: true },
        orderBy: { startsAt: 'desc' },
        take: 10,
      }),
    ]);

    return buildTenantBookingSummary(periodRows, recentRows, periodDays);
  }

  async getPaymentSummary(principal: AuthenticatedPrincipal): Promise<TenantAdminPaymentSummary> {
    assertTenantPortalStaff(principal);
    const periodDays = 30;
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId: principal.tenantId,
        createdAt: { gte: periodStart },
      },
      select: tenantAdminPaymentSelect(),
    });

    const settled = rows.filter((row) => row.status === 'settled');
    const pending = rows.filter((row) => row.status === 'requires_action');
    const failed = rows.filter((row) => row.status === 'failed');

    const bySourceMap = new Map<
      TenantAdminPaymentSource,
      { count: number; amount_paise: number }
    >();
    for (const source of PAYMENT_SOURCES) {
      bySourceMap.set(source, { count: 0, amount_paise: 0 });
    }
    for (const row of settled) {
      const source = derivePaymentSource(row);
      const current = bySourceMap.get(source)!;
      current.count += 1;
      current.amount_paise += row.amountPaise;
      bySourceMap.set(source, current);
    }

    return {
      period_days: periodDays,
      totals: {
        settled_count: settled.length,
        settled_amount_paise: settled.reduce((sum, row) => sum + row.amountPaise, 0),
        pending_count: pending.length,
        failed_count: failed.length,
      },
      by_source: PAYMENT_SOURCES.map((source) => ({
        source,
        count: bySourceMap.get(source)!.count,
        amount_paise: bySourceMap.get(source)!.amount_paise,
      })),
      trends_30d: bucketPayments(
        settled.map((row) => ({ settledAt: row.settledAt, amountPaise: row.amountPaise })),
        periodStart,
        now,
      ),
    };
  }

  async listPayments(
    principal: AuthenticatedPrincipal,
    filters: {
      status?: string;
      source?: string;
      from?: string;
      to?: string;
      q?: string;
      limit?: string;
      cursor?: string;
    },
  ): Promise<{ items: TenantAdminPaymentLedgerRow[]; next_cursor: string | null }> {
    assertTenantPortalStaff(principal);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit ?? '50', 10) || 50, 1), 200);
    const where = buildTenantPaymentWhere(principal.tenantId, filters);
    const rows = await this.prisma.payment.findMany({
      where,
      select: tenantAdminPaymentSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => toTenantPaymentLedgerRow(row)),
      next_cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async getPaymentBreakdown(
    principal: AuthenticatedPrincipal,
    filters: { group?: string; from?: string; to?: string; status?: string; source?: string },
  ): Promise<TenantAdminPaymentBreakdownRow[]> {
    assertTenantPortalStaff(principal);
    const group =
      filters.group === 'status' || filters.group === 'service' ? filters.group : 'source';
    const where = buildTenantPaymentWhere(principal.tenantId, filters);
    const rows = await this.prisma.payment.findMany({
      where,
      select: tenantAdminPaymentSelect(),
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const buckets = new Map<string, { label: string; count: number; amount_paise: number }>();
    for (const row of rows) {
      let key: string;
      let label: string;
      if (group === 'status') {
        key = row.status;
        label = row.status;
      } else if (group === 'service') {
        const ledger = toTenantPaymentLedgerRow(row);
        key = ledger.service_code ?? 'unknown';
        label = ledger.service_code ?? 'Unknown service';
      } else {
        const source = derivePaymentSource(row);
        key = source;
        label = paymentSourceLabel(source);
      }
      const current = buckets.get(key) ?? { label, count: 0, amount_paise: 0 };
      current.count += 1;
      if (row.status === 'settled') {
        current.amount_paise += row.amountPaise;
      }
      buckets.set(key, current);
    }

    return [...buckets.entries()]
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.count,
        amount_paise: value.amount_paise,
      }))
      .sort((left, right) => right.amount_paise - left.amount_paise || right.count - left.count);
  }

  async getDashboardDeep(principal: AuthenticatedPrincipal): Promise<TenantAdminDashboardDeep> {
    assertTenantPortalStaff(principal);
    const tenantId = principal.tenantId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const terminalGrievance = ['resolved', 'closed'];

    const [applications, payments, breachedGrievances, services] = await Promise.all([
      this.prisma.application.findMany({
        where: { tenantId, submittedAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          docketNo: true,
          serviceCode: true,
          status: true,
          pendingRole: true,
          submittedAt: true,
          updatedAt: true,
          service: { select: { code: true, name: true, effectiveSlaDays: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, status: 'settled', settledAt: { gte: thirtyDaysAgo } },
        select: { amountPaise: true, settledAt: true },
        orderBy: { settledAt: 'asc' },
      }),
      this.prisma.grievance.findMany({
        where: {
          tenantId,
          slaBreachedAt: { not: null },
          NOT: { status: { in: terminalGrievance } },
        },
        select: {
          id: true,
          grievanceNo: true,
          category: true,
          status: true,
          slaDueAt: true,
          slaBreachedAt: true,
          updatedAt: true,
        },
        orderBy: [{ slaBreachedAt: 'asc' }, { updatedAt: 'desc' }],
        take: 10,
      }),
      this.prisma.tenantService.findMany({
        where: { tenantId },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    const openStatuses = new Set(['submitted', 'in_review', 'pending_payment', 'pending']);
    const breachedApplications = applications
      .filter((row) => {
        const days = row.service.effectiveSlaDays;
        if (!days || !openStatuses.has(row.status)) {
          return false;
        }
        return row.submittedAt.getTime() + days * 24 * 60 * 60 * 1000 < now.getTime();
      })
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        docket_no: row.docketNo,
        service_code: row.serviceCode,
        status: row.status,
        pending_role: row.pendingRole,
        submitted_at: row.submittedAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
        expected_sla_at: row.service.effectiveSlaDays
          ? new Date(
              row.submittedAt.getTime() + row.service.effectiveSlaDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
      }));

    const serviceNames = new Map(services.map((service) => [service.code, service.name]));
    const serviceStats = new Map<string, { open: number; recent: number }>();
    for (const row of applications) {
      const stat = serviceStats.get(row.serviceCode) ?? { open: 0, recent: 0 };
      stat.recent += 1;
      if (openStatuses.has(row.status)) {
        stat.open += 1;
      }
      serviceStats.set(row.serviceCode, stat);
    }

    return {
      application_trends_30d: bucketDates(
        applications.map((row) => row.submittedAt),
        thirtyDaysAgo,
        now,
      ).map((bucket) => ({ date: bucket.date, submitted: bucket.count })),
      payment_trends_30d: bucketPayments(payments, thirtyDaysAgo, now),
      breached_grievances: breachedGrievances.map((row) => ({
        id: row.id,
        reference: row.grievanceNo,
        category: row.category,
        status: row.status,
        sla_due_at: row.slaDueAt?.toISOString() ?? null,
        sla_breached_at: row.slaBreachedAt?.toISOString() ?? null,
        updated_at: row.updatedAt.toISOString(),
      })),
      breached_applications: breachedApplications,
      top_services: [...serviceStats.entries()]
        .sort((left, right) => right[1].open - left[1].open || right[1].recent - left[1].recent)
        .slice(0, 8)
        .map(([serviceCode, stat]) => ({
          service_code: serviceCode,
          name: serviceNames.get(serviceCode) ?? { en: serviceCode },
          open_applications: stat.open,
          recent_submissions_30d: stat.recent,
        })),
    };
  }

  async listServices(principal: AuthenticatedPrincipal): Promise<TenantAdminServiceRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantService.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name as Prisma.JsonValue,
      description: row.description as Prisma.JsonValue,
      is_active: row.isActive,
      effective_sla_days: row.effectiveSlaDays,
      updated_at: row.updatedAt.toISOString(),
    }));
  }

  async listCatalogueGovernance(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminCatalogueRow[]> {
    assertTenantPortalStaff(principal);
    const [globals, tenantServices] = await Promise.all([
      this.prisma.globalService.findMany({
        include: { category: true },
        orderBy: [{ category: { code: 'asc' } }, { code: 'asc' }],
      }),
      this.prisma.tenantService.findMany({
        where: { tenantId: principal.tenantId },
        include: { category: true, globalService: true, department: true },
        orderBy: [{ code: 'asc' }],
      }),
    ]);
    const tenantByGlobalId = new Map(
      tenantServices
        .filter((service) => service.globalServiceId)
        .map((service) => [service.globalServiceId as string, service]),
    );
    const rows: TenantAdminCatalogueRow[] = globals.map((global) => {
      const local = tenantByGlobalId.get(global.id);
      return {
        code: local?.code ?? global.code,
        source: local ? 'tenant_override' : 'global',
        global_code: global.code,
        tenant_service_id: local?.id ?? null,
        category_code: local
          ? seedCategoryCodeFromNavigation(local.globalCategoryCode)
          : global.category.code,
        department_id: local?.departmentId ?? null,
        department_code: local?.department?.code ?? null,
        department_name: local?.department?.name ?? null,
        name: (local?.name ?? global.name) as Prisma.JsonValue,
        description: (local?.description ?? global.description) as Prisma.JsonValue,
        is_active: local?.isActive ?? global.isActive,
        has_local_override: Boolean(local),
        updated_at: local?.updatedAt.toISOString() ?? global.updatedAt.toISOString(),
      };
    });
    const globalIds = new Set(globals.map((global) => global.id));
    for (const local of tenantServices) {
      if (local.globalServiceId && globalIds.has(local.globalServiceId)) {
        continue;
      }
      rows.push({
        code: local.code,
        source: local.globalServiceId ? 'forked' : 'tenant_only',
        global_code: local.globalService?.code ?? null,
        tenant_service_id: local.id,
        category_code: seedCategoryCodeFromNavigation(local.globalCategoryCode),
        department_id: local.departmentId,
        department_code: local.department.code,
        department_name: local.department.name as Prisma.JsonValue,
        name: local.name as Prisma.JsonValue,
        description: local.description as Prisma.JsonValue,
        is_active: local.isActive,
        has_local_override: true,
        updated_at: local.updatedAt.toISOString(),
      });
    }
    return rows.sort(
      (left, right) =>
        left.category_code.localeCompare(right.category_code) ||
        left.code.localeCompare(right.code),
    );
  }

  async adoptCatalogueService(
    principal: AuthenticatedPrincipal,
    globalCode: string,
  ): Promise<TenantAdminCatalogueRow> {
    assertTenantPortalStaff(principal);
    assertCode(globalCode, 'global service code');
    const global = await this.prisma.globalService.findUnique({
      where: { code: globalCode },
      include: { category: true, revenueHead: true },
    });
    if (!global || !global.isActive) {
      throw new NotFoundException('Active global service not found');
    }
    const existing = await this.prisma.tenantService.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: global.code } },
    });
    if (existing && existing.globalServiceId !== global.id) {
      throw new BadRequestException('A tenant-owned service already uses this code');
    }
    const resolved = await ensureTenantServiceCategory(
      this.prisma,
      principal.tenantId,
      global.category.code,
      global.category.name as Prisma.InputJsonValue,
    );
    const service = await this.prisma.tenantService.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: global.code } },
      create: {
        tenantId: principal.tenantId,
        globalServiceId: global.id,
        code: global.code,
        categoryId: resolved.categoryId,
        departmentId: resolved.departmentId,
        globalCategoryCode: resolved.globalCategoryCode,
        revenueHeadId: global.revenueHeadId,
        name: global.name as Prisma.InputJsonValue,
        description: global.description as Prisma.InputJsonValue,
        isActive: true,
        effectiveFeeConfig: global.feeConfig as Prisma.InputJsonValue,
        effectiveSlaDays: global.defaultSlaDays,
        requiredDocuments: global.requiredDocuments as Prisma.InputJsonValue,
      },
      update: { isActive: true },
      include: { category: true, globalService: true, department: true },
    });
    return toCatalogueRow(service, global.code, 'tenant_override');
  }

  async forkCatalogueService(
    principal: AuthenticatedPrincipal,
    serviceCode: string,
  ): Promise<TenantAdminCatalogueRow> {
    assertTenantPortalStaff(principal);
    assertCode(serviceCode, 'service code');
    const global = await this.prisma.globalService.findUnique({
      where: { code: serviceCode },
      include: { category: true },
    });
    const existing = await this.prisma.tenantService.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: serviceCode } },
      include: { category: true, globalService: true },
    });
    const source = existing ?? global;
    if (!source) {
      throw new NotFoundException('Service not found');
    }
    const forkCode = nextForkCode(serviceCode);
    const conflict = await this.prisma.tenantService.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: forkCode } },
    });
    if (conflict) {
      throw new BadRequestException(`Fork already exists as ${forkCode}`);
    }
    let categoryId: string;
    let departmentId: string;
    let globalCategoryCode: string;
    if (existing) {
      categoryId = existing.categoryId;
      departmentId = existing.departmentId;
      globalCategoryCode = existing.globalCategoryCode;
    } else {
      const resolved = await ensureTenantServiceCategory(
        this.prisma,
        principal.tenantId,
        global!.category.code,
        global!.category.name as Prisma.InputJsonValue,
      );
      categoryId = resolved.categoryId;
      departmentId = resolved.departmentId;
      globalCategoryCode = resolved.globalCategoryCode;
    }
    const service = await this.prisma.tenantService.create({
      data: {
        tenantId: principal.tenantId,
        globalServiceId: null,
        code: forkCode,
        categoryId,
        departmentId,
        globalCategoryCode,
        revenueHeadId: source.revenueHeadId,
        name: source.name as Prisma.InputJsonValue,
        description: source.description as Prisma.InputJsonValue,
        isActive: true,
        effectiveFeeConfig:
          'effectiveFeeConfig' in source
            ? (source.effectiveFeeConfig as Prisma.InputJsonValue)
            : (source.feeConfig as Prisma.InputJsonValue),
        effectiveSlaDays:
          'effectiveSlaDays' in source ? source.effectiveSlaDays : source.defaultSlaDays,
        requiredDocuments: source.requiredDocuments as Prisma.InputJsonValue,
      },
      include: { category: true, globalService: true, department: true },
    });
    return toCatalogueRow(service, serviceCode, 'forked');
  }

  async deactivateCatalogueService(
    principal: AuthenticatedPrincipal,
    serviceCode: string,
  ): Promise<TenantAdminCatalogueRow> {
    assertTenantPortalStaff(principal);
    assertCode(serviceCode, 'service code');
    const service = await this.prisma.tenantService.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: serviceCode } },
      include: { category: true, globalService: true, department: true },
    });
    if (!service) {
      const adopted = await this.adoptCatalogueService(principal, serviceCode);
      return this.deactivateCatalogueService(principal, adopted.code);
    }
    const updated = await this.prisma.tenantService.update({
      where: { id: service.id },
      data: { isActive: false },
      include: { category: true, globalService: true, department: true },
    });
    return toCatalogueRow(
      updated,
      updated.globalService?.code ?? null,
      updated.globalService ? 'tenant_override' : 'tenant_only',
    );
  }

  async exportApplicationsCsv(
    principal: AuthenticatedPrincipal,
    filters: { from?: string; to?: string },
  ): Promise<string> {
    assertTenantPortalStaff(principal);
    const where = withDateRange<Prisma.ApplicationWhereInput>(
      { tenantId: principal.tenantId },
      'submittedAt',
      filters,
    );
    const rows = await this.prisma.application.findMany({
      where,
      select: {
        docketNo: true,
        serviceCode: true,
        status: true,
        paymentStatus: true,
        pendingRole: true,
        submittedAt: true,
        updatedAt: true,
      },
      orderBy: { submittedAt: 'desc' },
      take: 5000,
    });
    return toCsv(
      [
        'docket_no',
        'service_code',
        'status',
        'payment_status',
        'pending_role',
        'submitted_at',
        'updated_at',
      ],
      rows.map((row) => [
        row.docketNo,
        row.serviceCode,
        row.status,
        row.paymentStatus,
        row.pendingRole ?? '',
        row.submittedAt.toISOString(),
        row.updatedAt.toISOString(),
      ]),
    );
  }

  async exportPaymentsCsv(
    principal: AuthenticatedPrincipal,
    filters: { from?: string; to?: string },
  ): Promise<string> {
    assertTenantPortalStaff(principal);
    const where = withDateRange<Prisma.PaymentWhereInput>(
      { tenantId: principal.tenantId },
      'createdAt',
      filters,
    );
    const rows = await this.prisma.payment.findMany({
      where,
      select: tenantAdminPaymentSelect(),
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return toCsv(
      [
        'source',
        'reference',
        'docket_no',
        'service_code',
        'gateway_order_id',
        'gateway_payment_id',
        'amount_paise',
        'currency',
        'method',
        'status',
        'gateway',
        'created_at',
        'settled_at',
      ],
      rows.map((row) => {
        const ledger = toTenantPaymentLedgerRow(row);
        return [
          ledger.source,
          ledger.reference,
          row.application?.docketNo ?? '',
          ledger.service_code ?? '',
          row.gatewayOrderId,
          row.gatewayPaymentId ?? '',
          row.amountPaise,
          row.currency,
          row.method,
          row.status,
          row.gateway,
          row.createdAt.toISOString(),
          row.settledAt?.toISOString() ?? '',
        ];
      }),
    );
  }

  async exportGrievancesCsv(
    principal: AuthenticatedPrincipal,
    filters: { from?: string; to?: string },
  ): Promise<string> {
    assertTenantPortalStaff(principal);
    const where = withDateRange<Prisma.GrievanceWhereInput>(
      { tenantId: principal.tenantId },
      'createdAt',
      filters,
    );
    const rows = await this.prisma.grievance.findMany({
      where,
      select: {
        grievanceNo: true,
        category: true,
        grievancePriority: true,
        status: true,
        routedRoleCode: true,
        slaDueAt: true,
        slaBreachedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return toCsv(
      [
        'grievance_no',
        'category',
        'priority',
        'status',
        'routed_role',
        'sla_due_at',
        'sla_breached_at',
        'created_at',
        'updated_at',
      ],
      rows.map((row) => [
        row.grievanceNo,
        row.category,
        row.grievancePriority,
        row.status,
        row.routedRoleCode ?? '',
        row.slaDueAt?.toISOString() ?? '',
        row.slaBreachedAt?.toISOString() ?? '',
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
      ]),
    );
  }

  async exportSlaSummaryCsv(principal: AuthenticatedPrincipal): Promise<string> {
    assertTenantPortalStaff(principal);
    const [applications, grievances] = await Promise.all([
      this.prisma.application.findMany({
        where: { tenantId: principal.tenantId, NOT: { status: 'closed' } },
        select: {
          docketNo: true,
          serviceCode: true,
          status: true,
          submittedAt: true,
          service: { select: { effectiveSlaDays: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5000,
      }),
      this.prisma.grievance.findMany({
        where: { tenantId: principal.tenantId, NOT: { status: { in: ['resolved', 'closed'] } } },
        select: {
          grievanceNo: true,
          category: true,
          status: true,
          slaDueAt: true,
          slaBreachedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
    ]);
    const now = Date.now();
    return toCsv(
      ['kind', 'reference', 'category_or_service', 'status', 'sla_due_at', 'breached'],
      [
        ...applications.map((row) => {
          const dueAt = row.service.effectiveSlaDays
            ? new Date(
                row.submittedAt.getTime() + row.service.effectiveSlaDays * 24 * 60 * 60 * 1000,
              )
            : null;
          return [
            'application',
            row.docketNo,
            row.serviceCode,
            row.status,
            dueAt?.toISOString() ?? '',
            dueAt ? String(dueAt.getTime() < now) : 'false',
          ];
        }),
        ...grievances.map((row) => [
          'grievance',
          row.grievanceNo,
          row.category,
          row.status,
          row.slaDueAt?.toISOString() ?? '',
          String(Boolean(row.slaBreachedAt)),
        ]),
      ],
    );
  }

  async exportReportPdf(
    principal: AuthenticatedPrincipal,
    kind: string,
    filters: { from?: string; to?: string },
  ): Promise<Buffer> {
    assertTenantPortalStaff(principal);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: principal.tenantId },
      select: { code: true, name: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const title = reportTitle(kind);
    const rows = await this.reportSummaryRows(principal.tenantId, kind, filters);
    return renderSimplePdf([
      `eNagarSeba ${title}`,
      `Tenant: ${tenant.name} (${tenant.code})`,
      `Generated: ${new Date().toISOString()}`,
      `Filters: from=${filters.from || 'all'} to=${filters.to || 'all'}`,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ]);
  }

  private async reportSummaryRows(
    tenantId: string,
    kind: string,
    filters: { from?: string; to?: string },
  ): Promise<Array<[string, string | number]>> {
    if (kind === 'applications') {
      const where = withDateRange<Prisma.ApplicationWhereInput>(
        { tenantId },
        'submittedAt',
        filters,
      );
      const [total, open, closed] = await Promise.all([
        this.prisma.application.count({ where }),
        this.prisma.application.count({ where: { ...where, NOT: { status: 'closed' } } }),
        this.prisma.application.count({ where: { ...where, status: 'closed' } }),
      ]);
      return [
        ['Applications total', total],
        ['Applications open', open],
        ['Applications closed', closed],
      ];
    }
    if (kind === 'payments' || kind === 'revenue') {
      const where = withDateRange<Prisma.PaymentWhereInput>(
        { tenantId, status: 'settled' },
        'settledAt',
        filters,
      );
      const [settled, sum] = await Promise.all([
        this.prisma.payment.count({ where }),
        this.prisma.payment.aggregate({ where, _sum: { amountPaise: true } }),
      ]);
      return [
        ['Settled payments', settled],
        ['Settled amount (paise)', sum._sum.amountPaise ?? 0],
      ];
    }
    if (kind === 'grievances') {
      const where = withDateRange<Prisma.GrievanceWhereInput>({ tenantId }, 'createdAt', filters);
      const [total, open, breached] = await Promise.all([
        this.prisma.grievance.count({ where }),
        this.prisma.grievance.count({
          where: { ...where, NOT: { status: { in: ['resolved', 'closed'] } } },
        }),
        this.prisma.grievance.count({ where: { ...where, slaBreachedAt: { not: null } } }),
      ]);
      return [
        ['Grievances total', total],
        ['Grievances open', open],
        ['SLA breached grievances', breached],
      ];
    }
    if (kind === 'sla-summary' || kind === 'sla') {
      const [applicationsOpen, grievancesOpen, grievancesBreached] = await Promise.all([
        this.prisma.application.count({ where: { tenantId, NOT: { status: 'closed' } } }),
        this.prisma.grievance.count({
          where: { tenantId, NOT: { status: { in: ['resolved', 'closed'] } } },
        }),
        this.prisma.grievance.count({ where: { tenantId, slaBreachedAt: { not: null } } }),
      ]);
      return [
        ['Open applications', applicationsOpen],
        ['Open grievances', grievancesOpen],
        ['SLA breached grievances', grievancesBreached],
      ];
    }
    throw new BadRequestException('Unsupported PDF report kind');
  }

  async patchService(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: PatchTenantServiceDto,
  ): Promise<TenantAdminServiceRow> {
    assertTenantPortalStaff(principal);

    const existing = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
        globalCategoryCode: true,
        departmentId: true,
        category: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Service not found for this tenant');
    }

    const namePatch =
      dto.name !== undefined ? mergeLabels(existing.name as Prisma.JsonValue, dto.name) : undefined;
    const descriptionPatch =
      dto.description !== undefined
        ? mergeLabels(existing.description as Prisma.JsonValue, dto.description)
        : undefined;

    let categoryId: string | undefined;
    let departmentId: string | undefined;
    if (dto.department_id !== undefined) {
      assertUuid(dto.department_id, 'department_id');
      if (dto.department_id !== existing.departmentId) {
        const department = await this.prisma.tenantDepartment.findFirst({
          where: { id: dto.department_id, tenantId: principal.tenantId, isActive: true },
          select: { id: true },
        });
        if (!department) {
          throw new BadRequestException('department_id does not exist for this tenant');
        }
        const resolved = await ensureTenantServiceCategoryOnDepartment(
          this.prisma,
          principal.tenantId,
          department.id,
          existing.globalCategoryCode,
          existing.category.name as Prisma.InputJsonValue,
        );
        categoryId = resolved.categoryId;
        departmentId = resolved.departmentId;
      }
    }

    const updated = await this.prisma.tenantService.update({
      where: { id: existing.id },
      data: {
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
        ...(namePatch !== undefined ? { name: namePatch as Prisma.InputJsonValue } : {}),
        ...(descriptionPatch !== undefined
          ? { description: descriptionPatch as Prisma.InputJsonValue }
          : {}),
        ...(dto.effective_sla_days !== undefined
          ? { effectiveSlaDays: dto.effective_sla_days }
          : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name as Prisma.JsonValue,
      description: updated.description as Prisma.JsonValue,
      is_active: updated.isActive,
      effective_sla_days: updated.effectiveSlaDays,
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async getServiceConfig(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceConfig> {
    assertTenantPortalStaff(principal);
    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      include: { revenueHead: true },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this tenant');
    }

    const workflowPublished = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'published' },
      orderBy: { version: 'desc' },
      include: workflowInclude,
    });

    return toServiceConfigRow(
      row,
      workflowPublished ? toWorkflowRow(workflowPublished).definition : null,
    );
  }

  async patchServiceConfig(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: PatchTenantServiceConfigDto,
  ): Promise<TenantAdminServiceConfig> {
    assertTenantPortalStaff(principal);
    const existing = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: { id: true, overrideConfig: true, effectiveFeeConfig: true },
    });
    if (!existing) {
      throw new NotFoundException('Service not found for this tenant');
    }

    let revenueHeadId: string | null | undefined;
    if (dto.revenue_head_code !== undefined) {
      const code = dto.revenue_head_code.trim();
      if (!code) {
        revenueHeadId = null;
      } else {
        const revenueHead = await this.prisma.revenueHead.findUnique({ where: { code } });
        if (!revenueHead || !revenueHead.isActive) {
          throw new BadRequestException('Revenue head is not active or does not exist');
        }
        revenueHeadId = revenueHead.id;
      }
    }

    const data: Prisma.TenantServiceUpdateInput = {};
    const overrideBase =
      existing.overrideConfig &&
      typeof existing.overrideConfig === 'object' &&
      !Array.isArray(existing.overrideConfig)
        ? { ...(existing.overrideConfig as Record<string, unknown>) }
        : {};
    let nextOverrideConfig: Record<string, unknown> | null = null;

    if (dto.fee_rule !== undefined) {
      assertValidFeeRule(dto.fee_rule);
      data.effectiveFeeConfig = dto.fee_rule as unknown as Prisma.InputJsonValue;
    }
    if (dto.required_documents !== undefined) {
      const normalizedDocuments = normalizeDocumentChecklist(dto.required_documents);
      assertValidDocumentChecklist(normalizedDocuments);
      data.requiredDocuments = normalizedDocuments as unknown as Prisma.InputJsonValue;
    }
    if (revenueHeadId !== undefined) {
      data.revenueHead = revenueHeadId ? { connect: { id: revenueHeadId } } : { disconnect: true };
    }

    const touchesPaymentConfig =
      dto.payment_schedule !== undefined ||
      dto.fee_lines !== undefined ||
      dto.fee_rule !== undefined;
    if (touchesPaymentConfig) {
      nextOverrideConfig = { ...overrideBase };
    }

    if (dto.payment_schedule !== undefined || dto.fee_lines !== undefined) {
      const resolved = resolveServicePaymentConfig(
        overrideBase,
        dto.fee_rule ?? existing.effectiveFeeConfig,
        null,
      );
      const payment_schedule = dto.payment_schedule ?? resolved.payment_schedule;
      const fee_lines = (dto.fee_lines ?? resolved.fee_lines) as ServiceFeeLines;
      assertValidPaymentSchedule(payment_schedule, fee_lines);
      nextOverrideConfig = {
        ...(nextOverrideConfig ?? overrideBase),
        payment_schedule,
        fee_lines,
      };
      const primaryRule = fee_lines[primaryFeeLineCode(payment_schedule)]?.rule;
      if (primaryRule) {
        data.effectiveFeeConfig = primaryRule as unknown as Prisma.InputJsonValue;
      }
    } else if (dto.fee_rule !== undefined && readPaymentScheduleFromConfig(overrideBase)) {
      const payment_schedule = readPaymentScheduleFromConfig(overrideBase)!;
      const resolved = resolveServicePaymentConfig(overrideBase, dto.fee_rule, null);
      const primary = primaryFeeLineCode(payment_schedule);
      const fee_lines: ServiceFeeLines = {
        ...resolved.fee_lines,
        [primary]: {
          ...(resolved.fee_lines[primary] ??
            legacyFeeRuleToFeeLine(primary, dto.fee_rule as FeeRule)),
          rule: dto.fee_rule as FeeRule,
        },
      };
      assertValidPaymentSchedule(payment_schedule, fee_lines);
      nextOverrideConfig = {
        ...(nextOverrideConfig ?? overrideBase),
        payment_schedule,
        fee_lines,
      };
    }

    if (dto.bookable_asset_codes !== undefined) {
      const codes = [
        ...new Set(dto.bookable_asset_codes.map((code) => code.trim()).filter(Boolean)),
      ];
      const existingAssets = await this.prisma.bookableAsset.findMany({
        where: { tenantId: principal.tenantId, code: { in: codes } },
        select: { code: true },
      });
      const existingCodes = new Set(existingAssets.map((row) => row.code));
      const validCodes = codes.filter((code) => existingCodes.has(code));
      nextOverrideConfig = { ...(nextOverrideConfig ?? overrideBase) };
      if (validCodes.length > 0) {
        nextOverrideConfig.bookable_asset_codes = validCodes;
        nextOverrideConfig.bookable_asset_code = validCodes[0];
      } else {
        delete nextOverrideConfig.bookable_asset_codes;
        delete nextOverrideConfig.bookable_asset_code;
      }
    }

    if (
      dto.boc_policy !== undefined ||
      dto.municipal_signoff_policy !== undefined ||
      dto.municipal_signoff_threshold_paise !== undefined
    ) {
      nextOverrideConfig = { ...(nextOverrideConfig ?? overrideBase) };
      if (dto.boc_policy !== undefined) {
        nextOverrideConfig.boc_policy = dto.boc_policy;
      }
      if (dto.municipal_signoff_policy !== undefined) {
        nextOverrideConfig.municipal_signoff_policy = dto.municipal_signoff_policy;
      }
      if (dto.municipal_signoff_threshold_paise !== undefined) {
        nextOverrideConfig.municipal_signoff_threshold_paise =
          dto.municipal_signoff_threshold_paise;
      }
    }

    if (nextOverrideConfig) {
      data.overrideConfig = nextOverrideConfig as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.tenantService.update({
      where: { id: existing.id },
      data,
      include: { revenueHead: true },
    });

    const workflowPublished = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'published' },
      orderBy: { version: 'desc' },
      include: workflowInclude,
    });

    return toServiceConfigRow(
      updated,
      workflowPublished ? toWorkflowRow(workflowPublished).definition : null,
    );
  }

  async listRevenueHeads(principal: AuthenticatedPrincipal): Promise<TenantAdminRevenueHeadRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.revenueHead.findMany({
      orderBy: [{ code: 'asc' }],
    });
    return rows.map(toRevenueHeadRow);
  }

  async upsertRevenueHead(
    principal: AuthenticatedPrincipal,
    dto: UpsertRevenueHeadDto,
  ): Promise<TenantAdminRevenueHeadRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'revenue head code');
    assertLocaleLabel(dto.name, 'revenue head name');
    if (!/^RH-[A-Z0-9-]+$/.test(dto.accounting_code)) {
      throw new BadRequestException('accounting_code must use RH-* format');
    }

    const row = await this.prisma.revenueHead.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name as Prisma.InputJsonValue,
        accountingCode: dto.accounting_code,
        isActive: dto.is_active ?? true,
      },
      update: {
        name: dto.name as Prisma.InputJsonValue,
        accountingCode: dto.accounting_code,
        isActive: dto.is_active ?? true,
      },
    });
    return toRevenueHeadRow(row);
  }

  async listAddressMaster(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminAddressMasterRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.locality.findMany({
      where: { tenantId: principal.tenantId },
      include: { ward: { include: { borough: true } } },
      orderBy: [{ mouza: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toAddressMasterRow);
  }

  async upsertAddressMaster(
    principal: AuthenticatedPrincipal,
    dto: UpsertAddressMasterDto,
  ): Promise<TenantAdminAddressMasterRow> {
    assertTenantPortalStaff(principal);
    const wardNumber = dto.ward_number.trim();
    const localityName = dto.locality_name.trim();
    const pincode = dto.pincode?.trim() || '';
    if (!wardNumber || !localityName) {
      throw new BadRequestException('ward_number and locality_name are required');
    }

    const boroughCode = dto.borough_code?.trim();
    let boroughId: string | null = null;
    if (boroughCode) {
      const borough = await this.prisma.borough.upsert({
        where: { tenantId_code: { tenantId: principal.tenantId, code: boroughCode } },
        create: {
          tenantId: principal.tenantId,
          code: boroughCode,
          name: dto.borough_name?.trim() || boroughCode,
        },
        update: {
          name: dto.borough_name?.trim() || boroughCode,
        },
      });
      boroughId = borough.id;
    }

    const ward = await this.prisma.ward.upsert({
      where: { tenantId_number: { tenantId: principal.tenantId, number: wardNumber } },
      create: {
        tenantId: principal.tenantId,
        boroughId,
        number: wardNumber,
        name: dto.ward_name?.trim() || null,
      },
      update: {
        boroughId,
        name: dto.ward_name?.trim() || null,
      },
    });

    const locality = await this.prisma.locality.upsert({
      where: {
        tenantId_name_pincode: {
          tenantId: principal.tenantId,
          name: localityName,
          pincode,
        },
      },
      create: {
        tenantId: principal.tenantId,
        wardId: ward.id,
        mouza: dto.mouza?.trim() || null,
        name: localityName,
        pincode,
      },
      update: {
        wardId: ward.id,
        mouza: dto.mouza?.trim() || null,
      },
      include: { ward: { include: { borough: true } } },
    });

    return toAddressMasterRow(locality);
  }

  async importAddressMasterCsv(
    principal: AuthenticatedPrincipal,
    csv: string,
    dryRun = false,
  ): Promise<TenantAdminAddressImportResult> {
    assertTenantPortalStaff(principal);
    const rows = parseCsv(csv);
    const errors: TenantAdminAddressImportResult['errors'] = [];
    let inserted = 0;
    let updated = 0;

    const requiredHeaders = ['ward_number', 'locality_name'];
    for (const header of requiredHeaders) {
      if (!rows.headers.includes(header)) {
        errors.push({ row: 1, field: header, message: 'Missing required CSV header' });
      }
    }
    if (errors.length > 0) {
      return { dry_run: dryRun, inserted, updated, failed: rows.records.length, errors };
    }

    for (const record of rows.records) {
      const dto: UpsertAddressMasterDto = {
        borough_code: record.data.borough_code,
        borough_name: record.data.borough_name,
        ward_number: record.data.ward_number ?? '',
        ward_name: record.data.ward_name,
        mouza: record.data.mouza,
        locality_name: record.data.locality_name ?? '',
        pincode: record.data.pincode,
      };
      const rowErrors = validateAddressImportRow(dto, record.row);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }
      const exists = await this.prisma.locality.findFirst({
        where: {
          tenantId: principal.tenantId,
          name: dto.locality_name.trim(),
          pincode: dto.pincode?.trim() || '',
        },
        select: { id: true },
      });
      if (exists) {
        updated += 1;
      } else {
        inserted += 1;
      }
      if (!dryRun) {
        await this.upsertAddressMaster(principal, dto);
      }
    }

    return { dry_run: dryRun, inserted, updated, failed: errors.length, errors };
  }

  async listTariffs(principal: AuthenticatedPrincipal): Promise<TenantAdminTariffRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantTariff.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toTariffRow);
  }

  async upsertTariff(
    principal: AuthenticatedPrincipal,
    dto: UpsertTariffDto,
  ): Promise<TenantAdminTariffRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'tariff code');
    assertValidTariffCategory(dto.category);
    assertLocaleLabel(dto.name, 'tariff name');
    assertValidFeeRule(dto.rate_config);

    const row = await this.prisma.tenantTariff.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        category: dto.category,
        name: dto.name as Prisma.InputJsonValue,
        rateConfig: dto.rate_config as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
      update: {
        category: dto.category,
        name: dto.name as Prisma.InputJsonValue,
        rateConfig: dto.rate_config as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
    });
    return toTariffRow(row);
  }

  async getServiceDesigner(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceDesigner> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);
    const globalLink = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: {
        globalService: { select: { code: true, formSchema: true, workflowPattern: true } },
      },
    });
    const workflowPattern = globalLink?.globalService?.workflowPattern ?? null;
    const globalFormTemplate = globalLink?.globalService
      ? {
          global_code: globalLink.globalService.code,
          has_usable_form_schema: isUsableFormSchema(globalLink.globalService.formSchema),
          field_count: countFormInputFields(globalLink.globalService.formSchema),
        }
      : null;

    const [formDraft, formPublished, workflowDraft, workflowPublished] = await Promise.all([
      this.prisma.serviceFormVersion.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.serviceFormVersion.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
        include: workflowInclude,
      }),
      this.prisma.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        orderBy: { version: 'desc' },
        include: workflowInclude,
      }),
    ]);

    return {
      service,
      workflow_pattern: workflowPattern,
      form_draft: formDraft ? toFormVersionRow(formDraft) : null,
      form_published: formPublished ? toFormVersionRow(formPublished) : null,
      workflow_draft: workflowDraft ? toWorkflowRow(workflowDraft) : null,
      workflow_published: workflowPublished ? toWorkflowRow(workflowPublished) : null,
      global_form_template: globalFormTemplate,
      starter_form_schema: createBlankFormSchemaDraft(service.code, labelFromJson(service.name)),
      starter_workflow:
        workflowPattern && workflowPattern !== 'booking'
          ? workflowForPattern(workflowPattern)
          : createLinearWorkflowDraft(service.code),
    };
  }

  async resyncFormDraftFromGlobal(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminFormResyncFromGlobalResult> {
    assertTenantPortalStaff(principal);
    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      include: { globalService: { select: { code: true, formSchema: true } } },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this tenant');
    }
    if (!row.globalServiceId || !row.globalService) {
      throw new BadRequestException('This service is not linked to a State global template');
    }
    if (!isUsableFormSchema(row.globalService.formSchema)) {
      throw new BadRequestException('State global template has no usable citizen form yet');
    }

    const schema = resolveOnboardingFormSchema(row.code, row.name, row.globalService.formSchema);
    if (schema.service_code !== row.code) {
      throw new BadRequestException('Global form schema service_code does not match this service');
    }

    const formDraft = await this.saveFormDraft(principal, serviceId, {
      form_schema: schema,
      ui_schema: {},
    });

    return {
      form_draft: formDraft,
      global_code: row.globalService.code,
      field_count: countFormInputFields(schema),
    };
  }

  async saveFormDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: SaveServiceFormDraftDto,
  ): Promise<TenantAdminFormVersionRow> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);
    if (dto.form_schema.service_code !== service.code) {
      throw new BadRequestException('Form schema service_code must match the tenant service');
    }
    const validation = validateFormSchema(dto.form_schema);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Form schema is invalid',
        issues: validation.issues,
      });
    }

    const draft = await this.prisma.serviceFormVersion.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
    });

    const saved = draft
      ? await this.prisma.serviceFormVersion.update({
          where: { id: draft.id },
          data: {
            formSchema: dto.form_schema as unknown as Prisma.InputJsonValue,
            uiSchema: (dto.ui_schema ?? {}) as Prisma.InputJsonValue,
          },
        })
      : await this.prisma.serviceFormVersion.create({
          data: {
            tenantId: principal.tenantId,
            serviceId,
            version: await this.nextFormVersion(principal.tenantId, serviceId),
            status: 'draft',
            formSchema: dto.form_schema as unknown as Prisma.InputJsonValue,
            uiSchema: (dto.ui_schema ?? {}) as Prisma.InputJsonValue,
          },
        });

    return toFormVersionRow(saved);
  }

  async publishFormDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminFormVersionRow> {
    assertTenantPortalStaff(principal);
    await this.getOwnedService(principal, serviceId);
    const draft = await this.prisma.serviceFormVersion.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
    });
    if (!draft) {
      throw new NotFoundException('Form draft not found for this tenant service');
    }

    const validation = validateFormSchema(draft.formSchema as unknown as EnagarFormSchema);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Form schema is invalid',
        issues: validation.issues,
      });
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.serviceFormVersion.updateMany({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        data: { status: 'retired' },
      });

      return tx.serviceFormVersion.update({
        where: { id: draft.id },
        data: { status: 'published', publishedAt: new Date() },
      });
    });

    return toFormVersionRow(published);
  }

  async saveWorkflowDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: SaveServiceWorkflowDraftDto,
  ): Promise<TenantAdminWorkflowRow> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);
    const validation = validateWorkflowDefinition(dto.workflow);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Workflow definition is invalid',
        issues: validation.issues,
      });
    }
    if (!dto.workflow.code.startsWith(`${service.code}-`)) {
      throw new BadRequestException('Workflow code must be prefixed with the service code');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
      });
      const workflow = draft
        ? await tx.workflow.update({
            where: { id: draft.id },
            data: {
              code: dto.workflow.code,
              version: dto.workflow.version,
              name: labelFromJson(service.name) as unknown as Prisma.InputJsonValue,
            },
          })
        : await tx.workflow.create({
            data: {
              tenantId: principal.tenantId,
              serviceId,
              code: dto.workflow.code,
              version: await this.nextWorkflowVersion(principal.tenantId, serviceId),
              status: 'draft',
              name: labelFromJson(service.name) as unknown as Prisma.InputJsonValue,
            },
          });

      await tx.workflowTransition.deleteMany({
        where: { tenantId: principal.tenantId, workflowId: workflow.id },
      });
      await tx.workflowStage.deleteMany({
        where: { tenantId: principal.tenantId, workflowId: workflow.id },
      });

      const stageIds = new Map<string, string>();
      for (const [index, stage] of dto.workflow.stages.entries()) {
        const created = await tx.workflowStage.create({
          data: workflowStageCreateInput(principal.tenantId, workflow.id, stage, index),
        });
        stageIds.set(stage.code, created.id);
      }

      for (const transition of dto.workflow.transitions) {
        const fromStageId = stageIds.get(transition.from);
        const toStageId = stageIds.get(transition.to);
        if (!fromStageId || !toStageId) {
          throw new BadRequestException('Workflow transition references an unknown stage');
        }
        await tx.workflowTransition.create({
          data: workflowTransitionCreateInput(
            principal.tenantId,
            workflow.id,
            fromStageId,
            toStageId,
            transition,
          ),
        });
      }

      return tx.workflow.findUniqueOrThrow({
        where: { id: workflow.id },
        include: workflowInclude,
      });
    });

    return toWorkflowRow(saved);
  }

  async publishWorkflowDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminWorkflowRow> {
    assertTenantPortalStaff(principal);
    await this.getOwnedService(principal, serviceId);
    const draft = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
      include: workflowInclude,
    });
    if (!draft) {
      throw new NotFoundException('Workflow draft not found for this tenant service');
    }

    const validation = validateWorkflowDefinition(toWorkflowDefinition(draft));
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Workflow definition is invalid',
        issues: validation.issues,
      });
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.workflow.updateMany({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        data: { status: 'retired' },
      });
      await tx.workflow.update({
        where: { id: draft.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      return tx.workflow.findUniqueOrThrow({
        where: { id: draft.id },
        include: workflowInclude,
      });
    });

    return toWorkflowRow(published);
  }

  async getSettings(principal: AuthenticatedPrincipal): Promise<TenantAdminSettings> {
    assertTenantPortalStaff(principal);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: principal.tenantId },
      include: { tenantConfig: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const config =
      tenant.tenantConfig ??
      (await this.prisma.tenantConfig.create({ data: { tenantId: principal.tenantId } }));
    return toSettingsRow(tenant, config, principal.tenantCode);
  }

  async patchSettings(
    principal: AuthenticatedPrincipal,
    dto: PatchTenantSettingsDto,
  ): Promise<TenantAdminSettings> {
    assertTenantPortalStaff(principal);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: principal.tenantId },
      include: { tenantConfig: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (dto.branding !== undefined) {
      assertValidBranding(dto.branding);
    }
    if (dto.feature_flags !== undefined) {
      assertValidFeatureFlags(dto.feature_flags);
    }
    if (dto.languages_enabled !== undefined) {
      assertValidLanguageList(dto.languages_enabled);
    }
    if (dto.default_language !== undefined) {
      assertSupportedLocale(dto.default_language);
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: principal.tenantId },
      data: {
        ...(dto.languages_enabled !== undefined ? { languagesEnabled: dto.languages_enabled } : {}),
        ...(dto.branding?.theme_color !== undefined
          ? { themeColor: String(dto.branding.theme_color) || null }
          : {}),
        ...(dto.branding?.logo_url !== undefined
          ? { logoUrl: String(dto.branding.logo_url) || null }
          : {}),
      },
    });

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId: principal.tenantId },
      create: {
        tenantId: principal.tenantId,
        ...(dto.default_language !== undefined ? { defaultLanguage: dto.default_language } : {}),
        ...(dto.contact_phone !== undefined ? { contactPhone: dto.contact_phone || null } : {}),
        ...(dto.contact_email !== undefined ? { contactEmail: dto.contact_email || null } : {}),
        ...(dto.branding !== undefined ? { branding: dto.branding as Prisma.InputJsonValue } : {}),
        ...(dto.feature_flags !== undefined
          ? { featureFlags: dto.feature_flags as Prisma.InputJsonValue }
          : {}),
      },
      update: {
        ...(dto.default_language !== undefined ? { defaultLanguage: dto.default_language } : {}),
        ...(dto.contact_phone !== undefined ? { contactPhone: dto.contact_phone || null } : {}),
        ...(dto.contact_email !== undefined ? { contactEmail: dto.contact_email || null } : {}),
        ...(dto.branding !== undefined ? { branding: dto.branding as Prisma.InputJsonValue } : {}),
        ...(dto.feature_flags !== undefined
          ? { featureFlags: dto.feature_flags as Prisma.InputJsonValue }
          : {}),
      },
    });

    return toSettingsRow(updatedTenant, config, principal.tenantCode);
  }

  async listBanners(principal: AuthenticatedPrincipal): Promise<TenantAdminBannerRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantBanner.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { code: 'asc' }],
    });
    return rows.map(toTenantBannerRow);
  }

  async upsertBanner(
    principal: AuthenticatedPrincipal,
    dto: UpsertTenantBannerDto,
  ): Promise<TenantAdminBannerRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'banner code');
    assertTenantBannerSeverity(dto.severity);
    assertLocaleLabel(dto.title, 'banner title');
    assertLocaleLabel(dto.body, 'banner body');
    const startsAt = assertOptionalIsoDate(dto.starts_at, 'starts_at');
    const endsAt = assertOptionalIsoDate(dto.ends_at, 'ends_at');
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException('starts_at must be before ends_at');
    }
    if (dto.link_url && !/^https?:\/\//i.test(dto.link_url)) {
      throw new BadRequestException('link_url must be an http(s) URL or empty');
    }

    const row = await this.prisma.tenantBanner.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        severity: dto.severity,
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        linkUrl: dto.link_url?.trim() || null,
        startsAt,
        endsAt,
        isActive: dto.is_active ?? true,
      },
      update: {
        severity: dto.severity,
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        linkUrl: dto.link_url?.trim() || null,
        startsAt,
        endsAt,
        isActive: dto.is_active ?? true,
      },
    });
    return toTenantBannerRow(row);
  }

  async listNotificationTemplates(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminNotificationTemplateRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ channel: 'asc' }, { code: 'asc' }, { locale: 'asc' }],
    });
    return rows.map(toNotificationTemplateRow);
  }

  async upsertNotificationTemplate(
    principal: AuthenticatedPrincipal,
    dto: UpsertNotificationTemplateDto,
  ): Promise<TenantAdminNotificationTemplateRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'template code');
    assertCode(dto.trigger, 'template trigger');
    assertValidNotificationChannel(dto.channel);
    assertSupportedLocale(dto.locale);
    if (!dto.body.trim()) {
      throw new BadRequestException('Template body is required');
    }
    const variables = dto.variables ?? extractTemplateVariables(dto.subject, dto.body);
    assertValidNotificationVariables(variables, dto.body, dto.subject);

    const row = await this.prisma.notificationTemplate.upsert({
      where: {
        tenantId_code_channel_locale: {
          tenantId: principal.tenantId,
          code: dto.code,
          channel: dto.channel,
          locale: dto.locale,
        },
      },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        channel: dto.channel,
        locale: dto.locale,
        trigger: dto.trigger,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        variables: variables as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
      update: {
        trigger: dto.trigger,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        variables: variables as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
    });
    return toNotificationTemplateRow(row);
  }

  async listKbArticles(principal: AuthenticatedPrincipal): Promise<TenantAdminKbArticleRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.kbArticle.findMany({
      where: { tenantId: principal.tenantId },
      include: { indexJobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
      orderBy: [{ status: 'asc' }, { slug: 'asc' }],
    });
    return rows.map(toKbArticleRow);
  }

  async upsertKbArticle(
    principal: AuthenticatedPrincipal,
    dto: UpsertKbArticleDto,
  ): Promise<TenantAdminKbArticleRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.slug, 'KB article slug');
    assertValidLocalizedMarkdown(dto.title, 'KB article title');
    assertValidLocalizedMarkdown(dto.body, 'KB article body');
    assertValidTagList(dto.tags ?? []);
    assertValidKbArticleStatus(dto.status);

    const publishedAt = dto.status === 'published' ? new Date() : null;
    const row = await this.prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId: principal.tenantId, slug: dto.slug } },
      create: {
        tenantId: principal.tenantId,
        slug: dto.slug,
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        tags: (dto.tags ?? []) as string[],
        status: dto.status,
        publishedAt,
      },
      update: {
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        tags: (dto.tags ?? []) as string[],
        status: dto.status,
        publishedAt,
      },
      include: { indexJobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    if (dto.status === 'published') {
      await this.queueKbIndexJob(principal, row.id, 'publish');
      const refreshed = await this.prisma.kbArticle.findUniqueOrThrow({
        where: { id: row.id },
        include: { indexJobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
      });
      return toKbArticleRow(refreshed);
    }
    return toKbArticleRow(row);
  }

  async requeueKbArticle(
    principal: AuthenticatedPrincipal,
    dto: RequeueKbArticleDto,
  ): Promise<TenantAdminKbArticleRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.slug, 'KB article slug');
    const article = await this.prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId: principal.tenantId, slug: dto.slug } },
      include: { indexJobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    if (!article) {
      throw new NotFoundException('KB article not found');
    }
    if (article.status !== 'published') {
      throw new BadRequestException('Only published KB articles can be queued for indexing');
    }
    await this.queueKbIndexJob(principal, article.id, 'manual_requeue');
    const refreshed = await this.prisma.kbArticle.findUniqueOrThrow({
      where: { id: article.id },
      include: { indexJobs: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    });
    return toKbArticleRow(refreshed);
  }

  async createBrandingAssetUploadIntent(
    principal: AuthenticatedPrincipal,
    dto: {
      code: string;
      kind: string;
      mime_type: string;
      size_bytes: string;
      original_name: string;
    },
  ): Promise<TenantAdminBrandingUploadIntentResponse> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'branding asset code');
    assertBrandingAssetKind(dto.kind);
    assertBrandingAssetMime(dto.mime_type);
    const sizeBytes = parsePositiveInt(dto.size_bytes, 'size_bytes');
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException('Branding asset size must be <= 5MB');
    }
    const tenantCode = principal.tenantCode?.trim();
    if (!tenantCode) {
      throw new BadRequestException('Tenant code is required for branding upload');
    }
    const safeName = dto.original_name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const storageKey = `${tenantCode}/branding/${dto.code}/${safeName}`;
    this.objectStorage.assertSafeObjectKey(storageKey);
    if (!storageKey.startsWith(`${tenantCode}/`)) {
      throw new BadRequestException('storage_key must be tenant-prefixed');
    }
    const createdAt = new Date();
    const upload = await this.objectStorage.presignUpload(
      storageKey,
      dto.mime_type,
      15 * 60 * 1000,
      createdAt,
    );
    return {
      storage_key: storageKey,
      upload_url: upload.url,
      upload_expires_at: upload.expires_at,
      public_url: this.objectStorage.buildPublicObjectUrl(storageKey),
      mime_type: dto.mime_type,
      original_name: dto.original_name,
    };
  }

  async listBrandingAssets(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminBrandingAssetRow[]> {
    assertTenantPortalStaff(principal);
    const settings = await this.getSettings(principal);
    const theme = brandingThemeColor(settings.branding);
    const rows = await this.prisma.tenantBrandingAsset.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ kind: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => toBrandingAssetRow(row, theme));
  }

  async upsertBrandingAsset(
    principal: AuthenticatedPrincipal,
    dto: UpsertBrandingAssetDto,
  ): Promise<TenantAdminBrandingAssetRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'branding asset code');
    assertBrandingAssetKind(dto.kind);
    assertBrandingAssetMime(dto.mime_type);
    const sizeBytes = parsePositiveInt(dto.size_bytes, 'size_bytes');
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException('Branding asset size must be <= 5MB');
    }
    if (!isHttpUrl(dto.public_url)) {
      throw new BadRequestException('public_url must be an http(s) URL');
    }
    if (!dto.storage_key.startsWith(`${principal.tenantCode ?? principal.tenantId}/`)) {
      throw new BadRequestException('storage_key must be tenant-prefixed');
    }
    if (this.objectStorage.isEnabled()) {
      const head = await this.objectStorage.headObject(dto.storage_key.trim());
      if (!head || head.content_length <= 0) {
        throw new BadRequestException('Branding object not found in storage');
      }
    }
    const width = dto.width ? parsePositiveInt(dto.width, 'width') : null;
    const height = dto.height ? parsePositiveInt(dto.height, 'height') : null;
    const row = await this.prisma.tenantBrandingAsset.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        kind: dto.kind,
        storageKey: dto.storage_key,
        publicUrl: dto.public_url,
        mimeType: dto.mime_type,
        sizeBytes,
        width,
        height,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        kind: dto.kind,
        storageKey: dto.storage_key,
        publicUrl: dto.public_url,
        mimeType: dto.mime_type,
        sizeBytes,
        width,
        height,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    const settings = await this.getSettings(principal);
    return toBrandingAssetRow(row, brandingThemeColor(settings.branding));
  }

  async listBookableAssets(principal: AuthenticatedPrincipal): Promise<{
    assets: TenantAdminBookableAssetRow[];
    availability: TenantAdminBookableAvailabilityRow[];
    reservations: TenantAdminBookingReservationRow[];
  }> {
    assertTenantPortalStaff(principal);
    const [assets, availability, reservations] = await Promise.all([
      this.prisma.bookableAsset.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.bookableAssetAvailability.findMany({
        where: { tenantId: principal.tenantId },
        include: { asset: true },
        orderBy: { startsAt: 'asc' },
        take: 100,
      }),
      this.prisma.bookingReservation.findMany({
        where: { tenantId: principal.tenantId },
        include: { asset: true },
        orderBy: { startsAt: 'asc' },
        take: 100,
      }),
    ]);
    return {
      assets: assets.map(toBookableAssetRow),
      availability: availability.map(toAvailabilityRow),
      reservations: reservations.map(toReservationRow),
    };
  }

  async upsertBookableAsset(
    principal: AuthenticatedPrincipal,
    dto: UpsertBookableAssetDto,
  ): Promise<TenantAdminBookableAssetRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'bookable asset code');
    assertLocaleLabel(dto.name, 'bookable asset name');
    const capacity = dto.capacity ? parsePositiveInt(dto.capacity, 'capacity') : null;
    const assetType = dto.asset_type ?? 'HALL';
    assertBookableAssetType(assetType);
    const rateUnit = dto.rate_unit ?? 'HOUR';
    assertBookableRateUnit(rateUnit);
    const baseRatePaise = dto.base_rate_paise
      ? parseNonNegativeInt(dto.base_rate_paise, 'base_rate_paise')
      : 0;
    const securityDepositPaise = dto.security_deposit_paise
      ? parseNonNegativeInt(dto.security_deposit_paise, 'security_deposit_paise')
      : 0;
    const slotStepMinutes = dto.slot_step_minutes
      ? parsePositiveInt(dto.slot_step_minutes, 'slot_step_minutes')
      : 60;
    const rules = (dto.rules ?? {}) as Prisma.InputJsonValue;
    const row = await this.prisma.bookableAsset.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        assetType,
        name: dto.name as Prisma.InputJsonValue,
        location: (dto.location ?? {}) as Prisma.InputJsonValue,
        capacity,
        rateUnit,
        baseRatePaise,
        securityDepositPaise,
        slotStepMinutes,
        rules,
        isActive: dto.is_active ?? true,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        assetType,
        name: dto.name as Prisma.InputJsonValue,
        location: (dto.location ?? {}) as Prisma.InputJsonValue,
        capacity,
        rateUnit,
        baseRatePaise,
        securityDepositPaise,
        slotStepMinutes,
        rules,
        isActive: dto.is_active ?? true,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return toBookableAssetRow(row);
  }

  async addBookableAvailability(
    principal: AuthenticatedPrincipal,
    dto: UpsertBookableAvailabilityDto,
  ): Promise<TenantAdminBookableAvailabilityRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.asset_code, 'asset code');
    assertAvailabilityKind(dto.kind);
    const { startsAt, endsAt } = parseTimeWindow(dto.starts_at, dto.ends_at);
    const asset = await this.getBookableAsset(principal.tenantId, dto.asset_code);
    const row = await this.prisma.bookableAssetAvailability.create({
      data: {
        tenantId: principal.tenantId,
        assetId: asset.id,
        kind: dto.kind,
        startsAt,
        endsAt,
        note: dto.note?.trim() || null,
      },
      include: { asset: true },
    });
    return toAvailabilityRow(row);
  }

  async bulkAddBookableAvailability(
    principal: AuthenticatedPrincipal,
    dto: BulkBookableAvailabilityDto,
  ): Promise<{
    asset_code: string;
    kind: string;
    from_date: string;
    to_date: string;
    days_matched: number;
    created: number;
    skipped: number;
  }> {
    assertTenantPortalStaff(principal);
    assertCode(dto.asset_code, 'asset code');
    assertAvailabilityKind(dto.kind);
    const fromDate = dto.from_date.trim();
    const toDate = dto.to_date.trim();
    try {
      parseIstYmd(fromDate);
      parseIstYmd(toDate);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid date');
    }
    let startHm: string;
    let endHm: string;
    try {
      startHm = assertHm(dto.start_time, 'start_time');
      endHm = assertHm(dto.end_time, 'end_time');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid time');
    }
    const weekdays =
      dto.weekdays && dto.weekdays.length > 0 ? [...new Set(dto.weekdays)] : [1, 2, 3, 4, 5];
    let dates: string[];
    try {
      dates = listIstDatesMatchingWeekdays(fromDate, toDate, weekdays);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid date range');
    }
    if (dates.length === 0) {
      throw new BadRequestException('No dates matched the selected weekdays in this range');
    }
    if (dates.length > 400) {
      throw new BadRequestException(
        'Date range yields too many windows (max 400). Narrow the range or weekdays.',
      );
    }
    const asset = await this.getBookableAsset(principal.tenantId, dto.asset_code);
    const skipExisting = dto.skip_existing !== false;
    const note = dto.note?.trim() || null;
    let created = 0;
    let skipped = 0;

    for (const ymd of dates) {
      let window: { starts_at: string; ends_at: string };
      try {
        window = istWindowToIso(ymd, startHm, endHm);
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Invalid time window');
      }
      const startsAt = new Date(window.starts_at);
      const endsAt = new Date(window.ends_at);
      if (skipExisting) {
        const existing = await this.prisma.bookableAssetAvailability.findFirst({
          where: {
            tenantId: principal.tenantId,
            assetId: asset.id,
            kind: dto.kind,
            startsAt,
            endsAt,
          },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
      }
      await this.prisma.bookableAssetAvailability.create({
        data: {
          tenantId: principal.tenantId,
          assetId: asset.id,
          kind: dto.kind,
          startsAt,
          endsAt,
          note,
        },
      });
      created += 1;
    }

    return {
      asset_code: dto.asset_code,
      kind: dto.kind,
      from_date: fromDate,
      to_date: toDate,
      days_matched: dates.length,
      created,
      skipped,
    };
  }

  async addBookingReservation(
    principal: AuthenticatedPrincipal,
    dto: UpsertBookingReservationDto,
  ): Promise<TenantAdminBookingReservationRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.asset_code, 'asset code');
    const { startsAt, endsAt } = parseTimeWindow(dto.starts_at, dto.ends_at);
    if (!dto.holder_name.trim()) {
      throw new BadRequestException('holder_name is required');
    }
    const status = dto.status ?? 'hold';
    assertBookingStatus(status);
    const asset = await this.getBookableAsset(principal.tenantId, dto.asset_code);
    if (!asset.isActive) {
      throw new BadRequestException('Bookable asset is inactive');
    }
    await assertBookableWindow(this.prisma, principal.tenantId, asset, startsAt, endsAt);
    const application = dto.docket_no
      ? await this.prisma.application.findFirst({
          where: { tenantId: principal.tenantId, docketNo: dto.docket_no },
        })
      : null;
    if (dto.citizen_id) {
      const citizen = await this.prisma.citizen.findFirst({
        where: { id: dto.citizen_id, tenantId: principal.tenantId },
      });
      if (!citizen) {
        throw new BadRequestException('citizen_id not found for this tenant');
      }
    }
    if (dto.deposit_id) {
      const deposit = await this.prisma.deposit.findFirst({
        where: { id: dto.deposit_id, tenantId: principal.tenantId },
      });
      if (!deposit) {
        throw new BadRequestException('deposit_id not found for this tenant');
      }
    }
    const row = await this.prisma.bookingReservation.create({
      data: {
        tenantId: principal.tenantId,
        assetId: asset.id,
        bookingNo: dto.booking_no?.trim() || null,
        citizenId: dto.citizen_id ?? null,
        depositId: dto.deposit_id ?? null,
        applicationId: application?.id ?? null,
        docketNo: dto.docket_no?.trim() || null,
        holderName: dto.holder_name,
        holderMobile: dto.holder_mobile?.trim() || null,
        startsAt,
        endsAt,
        status,
        note: dto.note?.trim() || null,
      },
      include: { asset: true },
    });
    return toReservationRow(row);
  }

  async listRoles(principal: AuthenticatedPrincipal): Promise<TenantAdminRoleRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.role.findMany({ orderBy: { code: 'asc' } });
    return rows.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
    }));
  }

  async listStaff(principal: AuthenticatedPrincipal): Promise<TenantAdminStaffRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.user.findMany({
      where: { tenantId: principal.tenantId },
      include: { userRoles: { include: { role: true, ward: true } } },
      orderBy: { username: 'asc' },
    });
    return rows.map(toStaffRow);
  }

  async listStaffInvites(principal: AuthenticatedPrincipal): Promise<TenantAdminStaffInviteRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.staffInvite.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map(toStaffInviteRow);
  }

  async createStaff(
    principal: AuthenticatedPrincipal,
    dto: CreateStaffDto,
  ): Promise<TenantAdminCreateStaffResult> {
    assertTenantPortalAdminWrite(principal);
    assertRoleCodes(dto.role_codes);
    assertUsername(dto.username);
    assertDisplayName(dto.display_name);
    assertOptionalContact(dto.email, 'email');
    assertOptionalContact(dto.mobile, 'mobile');

    const username = dto.username.trim().toLowerCase();
    const roleCodes = dto.role_codes as string[];

    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [
          { username },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.mobile ? [{ mobile: dto.mobile }] : []),
        ],
      },
    });
    if (existingUser) {
      throw new BadRequestException('A staff user with the same username/email/mobile exists');
    }

    const existingInvite = await this.prisma.staffInvite.findFirst({
      where: { tenantId: principal.tenantId, username },
    });
    if (existingInvite) {
      throw new BadRequestException('A staff invite with this username already exists');
    }

    const tenantCode = principal.tenantCode?.trim();
    if (!tenantCode) {
      throw new BadRequestException('Tenant code missing from authenticated session');
    }

    let provisioned;
    try {
      provisioned = await this.keycloakProvisioner.provisionTenantStaff({
        tenantId: principal.tenantId,
        tenantCode,
        username,
        displayName: dto.display_name,
        email: dto.email,
        roleCodes,
        password: dto.password,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(`Could not create Keycloak staff user: ${detail}`);
    }

    const staff = await this.upsertStaff(principal, {
      keycloak_user_id: provisioned.keycloak_user_id,
      username,
      display_name: dto.display_name,
      email: dto.email,
      mobile: dto.mobile,
      status: 'active',
      role_codes: roleCodes,
      ward_number: dto.ward_number,
    });

    if (dto.designation_ids?.length) {
      const uniqueIds = [...new Set(dto.designation_ids.map((id) => id.trim()).filter(Boolean))];
      for (const id of uniqueIds) {
        assertUuid(id, 'designation_id');
      }
      const designations = await this.prisma.tenantDesignation.findMany({
        where: { tenantId: principal.tenantId, id: { in: uniqueIds }, isActive: true },
        select: { id: true },
      });
      if (designations.length !== uniqueIds.length) {
        throw new BadRequestException('One or more designation_ids are invalid or inactive');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.userDesignation.deleteMany({
          where: { tenantId: principal.tenantId, userId: staff.id },
        });
        if (uniqueIds.length > 0) {
          await tx.userDesignation.createMany({
            data: uniqueIds.map((designationId) => ({
              tenantId: principal.tenantId,
              userId: staff.id,
              designationId,
            })),
          });
        }
      });
    }

    await this.auditTenantMutation(principal, 'staff.create', {
      user_id: staff.id,
      username: staff.username,
      role_codes: roleCodes,
      keycloak_user_id: provisioned.keycloak_user_id,
      designation_count: dto.designation_ids?.length ?? 0,
    });

    return {
      staff,
      login_username: provisioned.username,
      password_hint: provisioned.password_hint,
    };
  }

  async importStaffCsv(
    principal: AuthenticatedPrincipal,
    csv: string,
    dryRun = false,
  ): Promise<TenantAdminStaffImportResult> {
    assertTenantPortalAdminWrite(principal);
    const parsed = parseCsv(csv);
    const errors: TenantAdminStaffImportResult['errors'] = [];
    const previews: TenantAdminStaffImportResult['previews'] = [];
    const createdAccounts: TenantAdminStaffImportResult['created_accounts'] = [];
    let created = 0;

    const requiredHeaders = ['username', 'display_name', 'role_codes'];
    for (const header of requiredHeaders) {
      if (!parsed.headers.includes(header)) {
        errors.push({ row: 1, field: header, message: 'Missing required CSV header' });
      }
    }
    if (errors.length > 0) {
      return {
        dry_run: dryRun,
        created: 0,
        failed: parsed.records.length,
        errors,
        previews,
        created_accounts: createdAccounts,
      };
    }

    if (parsed.records.length > 100) {
      errors.push({
        row: 1,
        message: 'CSV exceeds maximum of 100 staff rows per import',
      });
      return {
        dry_run: dryRun,
        created: 0,
        failed: parsed.records.length,
        errors,
        previews,
        created_accounts: createdAccounts,
      };
    }

    for (const record of parsed.records) {
      const rowErrors = validateStaffImportRow(record.row, record.data);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const roleCodes = parseDelimitedCell(record.data.role_codes ?? '');
      const designationCodes = parseDelimitedCell(record.data.designation_codes ?? '');
      previews.push({
        row: record.row,
        username: record.data.username!.trim().toLowerCase(),
        display_name: record.data.display_name!.trim(),
        role_codes: roleCodes,
      });

      if (dryRun) {
        created += 1;
        continue;
      }

      let designationIds: string[] | undefined;
      if (designationCodes.length > 0) {
        const designations = await this.prisma.tenantDesignation.findMany({
          where: {
            tenantId: principal.tenantId,
            code: { in: designationCodes },
            isActive: true,
          },
          select: { id: true, code: true },
        });
        if (designations.length !== designationCodes.length) {
          const found = new Set(designations.map((row) => row.code));
          const missing = designationCodes.filter((code) => !found.has(code));
          errors.push({
            row: record.row,
            field: 'designation_codes',
            message: `Unknown designation code(s): ${missing.join(', ')}`,
          });
          continue;
        }
        designationIds = designations.map((row) => row.id);
      }

      try {
        const result = await this.createStaff(principal, {
          username: record.data.username!.trim(),
          display_name: record.data.display_name!.trim(),
          email: record.data.email?.trim() || undefined,
          mobile: record.data.mobile?.trim() || undefined,
          role_codes: roleCodes,
          ward_number: record.data.ward_number?.trim() || undefined,
          password: record.data.password?.trim() || undefined,
          designation_ids: designationIds,
        });
        created += 1;
        createdAccounts.push({
          row: record.row,
          username: result.login_username,
          display_name: result.staff.display_name,
          password_hint: result.password_hint,
        });
      } catch (error) {
        const message =
          error instanceof BadRequestException || error instanceof ServiceUnavailableException
            ? String(error.message)
            : error instanceof Error
              ? error.message
              : 'Staff create failed';
        errors.push({ row: record.row, message });
      }
    }

    return {
      dry_run: dryRun,
      created,
      failed: errors.length,
      errors,
      previews,
      created_accounts: createdAccounts,
    };
  }

  async createStaffInvite(
    principal: AuthenticatedPrincipal,
    dto: CreateStaffInviteDto,
  ): Promise<TenantAdminStaffInviteRow> {
    assertTenantPortalStaff(principal);
    assertRoleCodes(dto.role_codes);
    assertUsername(dto.username);
    assertDisplayName(dto.display_name);
    assertOptionalContact(dto.email, 'email');
    assertOptionalContact(dto.mobile, 'mobile');

    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.mobile ? [{ mobile: dto.mobile }] : []),
        ],
      },
    });
    if (existingUser) {
      throw new BadRequestException('A staff user with the same username/email/mobile exists');
    }

    const roles = await this.prisma.role.findMany({ where: { code: { in: dto.role_codes } } });
    if (roles.length !== dto.role_codes.length) {
      throw new BadRequestException('One or more role_codes do not exist');
    }

    const ward = dto.ward_number
      ? await this.prisma.ward.findFirst({
          where: { tenantId: principal.tenantId, number: dto.ward_number },
        })
      : null;
    if (dto.ward_number && !ward) {
      throw new BadRequestException('ward_number does not exist for this tenant');
    }

    const hasLocalKeycloak =
      Boolean(process.env.KEYCLOAK_ADMIN_BASE_URL) &&
      Boolean(process.env.KEYCLOAK_ADMIN_CLIENT_ID) &&
      Boolean(process.env.KEYCLOAK_ADMIN_CLIENT_SECRET);
    const roleCodes = dto.role_codes as string[];
    const metadata = {
      dry_run: !hasLocalKeycloak,
      invite_hint: `Provision ${dto.username} in local Keycloak, then map roles in eNagar.`,
      mfa_required: roleCodes.some((roleCode) => roleCode.includes('admin')),
    };
    const invite = await this.prisma.staffInvite.upsert({
      where: { tenantId_username: { tenantId: principal.tenantId, username: dto.username } },
      create: {
        tenantId: principal.tenantId,
        username: dto.username,
        displayName: dto.display_name,
        email: dto.email || null,
        mobile: dto.mobile || null,
        roleCodes,
        wardNumber: dto.ward_number || null,
        status: hasLocalKeycloak ? 'pending_keycloak' : 'draft',
        provisioningMode: hasLocalKeycloak ? 'local_keycloak' : 'dry_run',
        invitedBySubject: principal.subject,
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        displayName: dto.display_name,
        email: dto.email || null,
        mobile: dto.mobile || null,
        roleCodes,
        wardNumber: dto.ward_number || null,
        status: hasLocalKeycloak ? 'pending_keycloak' : 'draft',
        provisioningMode: hasLocalKeycloak ? 'local_keycloak' : 'dry_run',
        invitedBySubject: principal.subject,
        failureReason: null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    await this.auditTenantMutation(principal, 'staff_invite.create', {
      invite_id: invite.id,
      username: invite.username,
      role_codes: roleCodes,
      provisioning_mode: invite.provisioningMode,
    });
    return toStaffInviteRow(invite);
  }

  async updateStaffInvite(
    principal: AuthenticatedPrincipal,
    dto: UpdateStaffInviteDto,
  ): Promise<TenantAdminStaffInviteRow> {
    assertTenantPortalStaff(principal);
    assertUuid(dto.invite_id, 'invite_id');
    const action = assertStaffInviteAction(dto.action);
    const invite = await this.prisma.staffInvite.findFirst({
      where: { id: dto.invite_id, tenantId: principal.tenantId },
    });
    if (!invite) {
      throw new NotFoundException('Staff invite not found');
    }
    const statusByAction = {
      retry: 'pending_keycloak',
      disable: 'disabled',
      mark_provisioned: 'provisioned',
    } as const;
    const saved = await this.prisma.staffInvite.update({
      where: { id: invite.id },
      data: {
        status: statusByAction[action],
        failureReason: null,
        metadata: {
          ...(invite.metadata &&
          typeof invite.metadata === 'object' &&
          !Array.isArray(invite.metadata)
            ? (invite.metadata as Record<string, unknown>)
            : {}),
          last_action: action,
          action_by: principal.subject,
        } as Prisma.InputJsonValue,
      },
    });
    await this.auditTenantMutation(principal, `staff_invite.${action}`, {
      invite_id: saved.id,
      username: saved.username,
      status: saved.status,
    });
    return toStaffInviteRow(saved);
  }

  async upsertStaff(
    principal: AuthenticatedPrincipal,
    dto: UpsertStaffDto,
  ): Promise<TenantAdminStaffRow> {
    assertTenantPortalStaff(principal);
    assertUuid(dto.keycloak_user_id, 'keycloak_user_id');
    assertStaffStatus(dto.status ?? 'active');
    assertRoleCodes(dto.role_codes);

    const existing = await this.prisma.user.findUnique({
      where: { keycloakUserId: dto.keycloak_user_id },
    });
    if (existing && existing.tenantId !== principal.tenantId) {
      throw new BadRequestException('Staff user belongs to another tenant');
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: dto.role_codes as string[] } },
    });
    if (roles.length !== dto.role_codes.length) {
      throw new BadRequestException('One or more role_codes do not exist');
    }

    const ward = dto.ward_number
      ? await this.prisma.ward.findFirst({
          where: { tenantId: principal.tenantId, number: dto.ward_number },
        })
      : null;
    if (dto.ward_number && !ward) {
      throw new BadRequestException('ward_number does not exist for this tenant');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              username: dto.username,
              displayName: dto.display_name,
              email: dto.email || null,
              mobile: dto.mobile || null,
              status: dto.status ?? 'active',
            },
          })
        : await tx.user.create({
            data: {
              tenantId: principal.tenantId,
              keycloakUserId: dto.keycloak_user_id,
              username: dto.username,
              displayName: dto.display_name,
              email: dto.email || null,
              mobile: dto.mobile || null,
              status: dto.status ?? 'active',
            },
          });

      await tx.userRole.deleteMany({ where: { tenantId: principal.tenantId, userId: user.id } });
      for (const role of roles) {
        await tx.userRole.create({
          data: {
            tenantId: principal.tenantId,
            userId: user.id,
            roleId: role.id,
            wardId: ward?.id ?? null,
          },
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { userRoles: { include: { role: true, ward: true } } },
      });
    });

    await this.auditTenantMutation(principal, 'staff.role_map', {
      user_id: saved.id,
      username: saved.username,
      role_codes: dto.role_codes,
      ward_number: dto.ward_number ?? null,
    });
    return toStaffRow(saved);
  }

  async listRoleStageMaps(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminRoleStageMapRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.roleStageMap.findMany({
      where: { tenantId: principal.tenantId },
      include: { stage: { include: { workflow: true } } },
      orderBy: [{ roleCode: 'asc' }],
    });
    return rows.map(toRoleStageMapRow);
  }

  async upsertRoleStageMap(
    principal: AuthenticatedPrincipal,
    dto: UpsertRoleStageMapDto,
  ): Promise<TenantAdminRoleStageMapRow> {
    assertTenantPortalStaff(principal);
    assertRoleCode(dto.role_code);
    const role = await this.prisma.role.findUnique({ where: { code: dto.role_code } });
    if (!role) {
      throw new BadRequestException('role_code does not exist');
    }
    const workflow = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, code: dto.workflow_code },
      include: { stages: true },
      orderBy: { version: 'desc' },
    });
    if (!workflow) {
      throw new BadRequestException('workflow_code does not exist for this tenant');
    }
    const stage = workflow.stages.find((candidate) => candidate.code === dto.stage_code);
    if (!stage) {
      throw new BadRequestException('stage_code does not exist for this workflow');
    }

    const row = await this.prisma.roleStageMap.upsert({
      where: {
        tenantId_stageId_roleCode: {
          tenantId: principal.tenantId,
          stageId: stage.id,
          roleCode: dto.role_code,
        },
      },
      create: {
        tenantId: principal.tenantId,
        stageId: stage.id,
        roleCode: dto.role_code,
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      update: {
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      include: { stage: { include: { workflow: true } } },
    });
    return toRoleStageMapRow(row);
  }

  private async queueKbIndexJob(
    principal: AuthenticatedPrincipal,
    articleId: string,
    trigger: 'publish' | 'manual_requeue' | 'nightly_reconcile',
  ): Promise<void> {
    const existing = await this.prisma.kbIndexJob.findFirst({
      where: {
        tenantId: principal.tenantId,
        articleId,
        status: { in: ['queued', 'processing'] },
      },
    });
    if (existing) {
      await this.prisma.kbIndexJob.update({
        where: { id: existing.id },
        data: { trigger, requestedBy: principal.subject },
      });
      return;
    }
    await this.prisma.kbIndexJob.create({
      data: {
        tenantId: principal.tenantId,
        articleId,
        trigger,
        requestedBy: principal.subject,
      },
    });
  }

  private async auditTenantMutation(
    principal: AuthenticatedPrincipal,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.stateAuditLog.create({
      data: {
        actorSubject: principal.subject,
        actorRole: principal.roles[0] ?? 'tenant_staff',
        action,
        targetTenantId: principal.tenantId,
        targetCode: principal.tenantCode ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async getDeskMe(principal: AuthenticatedPrincipal): Promise<TenantDeskMe> {
    assertDeskAccess(principal);
    const normalizedRoles = normalizeDeskRoles(principal.roles);
    const wardScopes = isUuidString(principal.subject)
      ? await this.prisma.userRole.findMany({
          where: {
            tenantId: principal.tenantId,
            user: { keycloakUserId: principal.subject },
            wardId: { not: null },
          },
          select: {
            ward: { select: { id: true, number: true, name: true } },
          },
        })
      : [];

    return {
      subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      roles: principal.roles,
      normalized_roles: normalizedRoles,
      is_admin: hasDeskAdminRole(principal.roles),
      ward_scopes: wardScopes
        .map((row) => row.ward)
        .filter((ward): ward is { id: string; number: string; name: string | null } =>
          Boolean(ward),
        ),
    };
  }

  async getDeskSummary(principal: AuthenticatedPrincipal): Promise<TenantDeskSummary> {
    assertDeskAccess(principal);
    const admin = hasDeskAdminRole(principal.roles);
    const roles = normalizeDeskRoles(principal.roles);
    const designations = await loadStaffDesignationContext(this.prisma, principal);
    const terminalApp = ['closed', 'cancelled'];
    const terminalGrievance = ['resolved', 'closed'];

    const appMyWhere: Prisma.ApplicationWhereInput = {
      tenantId: principal.tenantId,
      NOT: { status: { in: terminalApp } },
      OR: deskMyQueueWhereClause(roles, designations.codes),
    };
    const appAllWhere: Prisma.ApplicationWhereInput = {
      tenantId: principal.tenantId,
      NOT: { status: { in: terminalApp } },
    };
    const grievanceOpenWhere: Prisma.GrievanceWhereInput = {
      tenantId: principal.tenantId,
      NOT: { status: { in: terminalGrievance } },
    };
    const grievanceMyWhere: Prisma.GrievanceWhereInput = {
      ...grievanceOpenWhere,
      OR: deskGrievanceMyQueueWhereClause(principal, roles, designations.userId),
    };
    const grievanceBreachedWhere: Prisma.GrievanceWhereInput = {
      ...grievanceOpenWhere,
      slaBreachedAt: { not: null },
    };

    const [
      applications_my_queue,
      applications_all_open,
      grievances_my_queue,
      grievances_all_open,
      grievances_sla_breached,
    ] = await Promise.all([
      roles.length > 0 || designations.codes.length > 0
        ? this.prisma.application.count({ where: appMyWhere })
        : Promise.resolve(0),
      admin
        ? this.prisma.application.count({ where: appAllWhere })
        : this.prisma.application.count({ where: appMyWhere }),
      this.prisma.grievance.count({ where: grievanceMyWhere }),
      admin
        ? this.prisma.grievance.count({ where: grievanceOpenWhere })
        : this.prisma.grievance.count({ where: grievanceMyWhere }),
      this.prisma.grievance.count({
        where: admin ? grievanceBreachedWhere : { AND: [grievanceMyWhere, grievanceBreachedWhere] },
      }),
    ]);

    return {
      applications_my_queue,
      applications_all_open,
      grievances_my_queue,
      grievances_all_open,
      grievances_sla_breached,
    };
  }

  async listDeskApplications(
    principal: AuthenticatedPrincipal,
    queue = 'my',
    filters: {
      dept?: string;
      department_id?: string;
      page?: string;
      page_size?: string;
    } = {},
  ): Promise<TenantDeskInboxPage<TenantDeskApplicationListItem>> {
    assertDeskAccess(principal);
    if (queue === 'all' && !hasDeskAdminRole(principal.roles)) {
      throw new ForbiddenException('Only municipality admins can view all open applications');
    }
    const { page, pageSize } = parseDeskInboxPagination(filters.page, filters.page_size);
    const departmentIds = await resolveDeskDepartmentIds(
      this.prisma,
      principal.tenantId,
      parseDeptCodesFromQuery(filters.dept),
      filters.department_id,
    );
    const roles = normalizeDeskRoles(principal.roles);
    const designations = await loadStaffDesignationContext(this.prisma, principal);
    if (queue === 'my' && roles.length === 0 && designations.codes.length === 0) {
      return { items: [], total: 0, page, page_size: pageSize };
    }
    if (departmentIds && departmentIds.length === 0) {
      return { items: [], total: 0, page, page_size: pageSize };
    }

    const where: Prisma.ApplicationWhereInput = {
      tenantId: principal.tenantId,
      NOT: { status: { in: ['closed', 'cancelled'] } },
      ...(queue === 'my' ? { OR: deskMyQueueWhereClause(roles, designations.codes) } : {}),
      ...(departmentIds?.length ? { service: { departmentId: { in: departmentIds } } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        select: {
          id: true,
          docketNo: true,
          serviceCode: true,
          status: true,
          statusLabel: true,
          pendingRole: true,
          pendingDesignation: true,
          paymentStatus: true,
          submittedAt: true,
          updatedAt: true,
          runtimeSnapshot: true,
          service: {
            select: {
              name: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { submittedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map((row) => toDeskApplicationListItem(row));
    const labeled = await attachPendingAtLabels(this.prisma, principal.tenantId, items);
    return { items: labeled, total, page, page_size: pageSize };
  }

  async getDeskApplication(
    principal: AuthenticatedPrincipal,
    docketNo: string,
  ): Promise<TenantDeskApplicationDetail> {
    assertDeskAccess(principal);
    const row = await this.prisma.application.findFirst({
      where: { tenantId: principal.tenantId, docketNo },
      select: {
        id: true,
        docketNo: true,
        serviceCode: true,
        status: true,
        statusLabel: true,
        pendingRole: true,
        pendingDesignation: true,
        paymentStatus: true,
        submittedAt: true,
        updatedAt: true,
        runtimeSnapshot: true,
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            overrideConfig: true,
            effectiveFeeConfig: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const snapshot = toApplicationSnapshot(row.runtimeSnapshot);
    const currentStage =
      typeof snapshot.current_stage === 'string' ? snapshot.current_stage : row.status;
    if (!hasDeskAdminRole(principal.roles)) {
      const roles = normalizeDeskRoles(principal.roles);
      const designations = await loadStaffDesignationContext(this.prisma, principal);
      const listItem = toDeskApplicationListItem(row);
      if (
        !deskApplicationInMyQueue(listItem, roles, designations.codes) &&
        !timelineHasActorRole(snapshot, roles)
      ) {
        throw new ForbiddenException('Application is not pending at your role or designation');
      }
    }
    const workflow = await this.loadWorkflowForDesk(row.service.id);
    const documentRows = await this.prisma.applicationDocument.findMany({
      where: { tenantId: principal.tenantId, applicationId: row.id },
      orderBy: { createdAt: 'asc' },
    });
    const documents =
      documentRows.length > 0
        ? documentRows.map((doc) => toDeskApplicationDocument(doc))
        : toDeskApplicationDocumentsFromSnapshot(snapshot.documents);
    const listItem = toDeskApplicationListItem(row);
    const [labeledItem] = await attachPendingAtLabels(this.prisma, principal.tenantId, [listItem]);
    const applicationRow: TenantDeskApplicationListItem = labeledItem ?? {
      ...listItem,
      pending_at_label: null,
    };
    const workOrder = await this.workOrders.getByApplicationId(principal.tenantId, row.id);
    const vendors = await this.workOrders.listVendors(principal.tenantId);
    const formData =
      typeof snapshot.form_data === 'object' && snapshot.form_data !== null
        ? (snapshot.form_data as Record<string, unknown>)
        : {};
    const bookingCharges = await resolveBookingChargesSummary(
      this.prisma,
      principal.tenantId,
      row.id,
      formData,
      coerceFeeSettlementSnapshot(snapshot.fee_settlement),
    );
    return {
      application: {
        ...applicationRow,
        booking_charges: bookingCharges ?? undefined,
        form_data: (snapshot.form_data ?? {}) as Prisma.JsonValue,
        timeline: Array.isArray(snapshot.timeline)
          ? (snapshot.timeline as TenantDeskApplicationDetail['application']['timeline'])
          : [],
        documents,
      },
      work_order: workOrder,
      vendors,
      allowed_transitions: await this.allowedApplicationTransitions(
        principal,
        workflow,
        currentStage,
        snapshot,
        row.service.overrideConfig,
        previewFeeRule(row.service.effectiveFeeConfig),
      ),
    };
  }

  async getDeskApplicationDocumentBlob(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    documentId: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    assertDeskAccess(principal);
    const application = await this.prisma.application.findFirst({
      where: { tenantId: principal.tenantId, id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    const document = await this.prisma.applicationDocument.findFirst({
      where: {
        id: documentId,
        tenantId: principal.tenantId,
        applicationId: application.id,
      },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.scanStatus !== 'clean') {
      throw new BadRequestException('Document is not scan-clean');
    }
    if (document.uploadStatus !== 'uploaded') {
      throw new BadRequestException('Document upload is not complete');
    }
    if (this.objectStorage.isEnabled()) {
      const buffer = await this.objectStorage.getObjectBuffer(document.objectKey);
      if (buffer && buffer.length > 0) {
        return {
          buffer,
          contentType: document.mimeType,
          fileName: document.originalName,
        };
      }
      throw new NotFoundException('Document object not found in storage');
    }
    const placeholder = Buffer.from(
      `Local dev placeholder for ${document.originalName} (${document.objectKey})`,
      'utf8',
    );
    return {
      buffer: placeholder,
      contentType: document.mimeType,
      fileName: document.originalName,
    };
  }

  async transitionDeskApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: {
      verb: string;
      comment?: string;
      require_boc?: boolean;
      boc_resolution?: { resolution_number: string; resolution_date: string };
    },
  ): Promise<TenantDeskApplicationDetail> {
    assertDeskAccess(principal);
    const row = await this.prisma.application.findFirst({
      where: { tenantId: principal.tenantId, id: applicationId },
      select: {
        id: true,
        docketNo: true,
        tenantId: true,
        citizenId: true,
        serviceId: true,
        serviceCode: true,
        status: true,
        runtimeSnapshot: true,
        service: { select: { overrideConfig: true, effectiveFeeConfig: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const snapshot = toApplicationSnapshot(row.runtimeSnapshot);
    const currentStage =
      typeof snapshot.current_stage === 'string' ? snapshot.current_stage : row.status;
    const feePreviewPaise = previewFeeRule(row.service.effectiveFeeConfig);
    const evaluationSnapshot = applyBocTransitionPayload(
      row.service.overrideConfig,
      snapshot,
      dto.verb,
      {
        require_boc: dto.require_boc,
        boc_resolution: dto.boc_resolution,
      },
      currentStage,
      { feePreviewPaise },
    );
    const workflow = await this.loadWorkflowForDesk(row.serviceId);
    const actorRoles = normalizeDeskRoles(principal.roles);
    const staffDesignations = await loadStaffDesignationContext(this.prisma, principal);
    const evaluated = evaluateTransition({
      workflow: workflow.definition,
      current_stage: currentStage,
      verb: dto.verb,
      actor_roles: actorRoles as WorkflowRole[],
      actor_designations: staffDesignations.codes,
      designation_capabilities: staffDesignations.capabilities,
      runtime_snapshot: evaluationSnapshot,
      comment: dto.comment,
    });
    if (!evaluated.ok) {
      if (evaluated.reason === 'PAYMENT_LINK_NOT_PERMITTED') {
        throw new ForbiddenException(
          'Only a department-head designation may issue the citizen payment link',
        );
      }
      throw new BadRequestException(`Workflow transition rejected: ${evaluated.reason}`);
    }
    await this.assertWorkflowStageCanAct(
      principal,
      workflow.row,
      evaluated.from.code,
      evaluated.transition,
      staffDesignations.codes,
    );

    const now = new Date();
    const dueAt = calculateSlaDueAt(now, evaluated.to.sla_hours);
    const pendingFromEffects = resolvePendingRoleFromEffects(evaluated.effects);
    const pendingActor = evaluated.to.terminal
      ? { pending_designation: null, pending_role: null }
      : pendingFromEffects
        ? { pending_designation: null, pending_role: pendingFromEffects }
        : pendingActorFromWorkflowStage(evaluated.to);
    const timeline = Array.isArray(snapshot.timeline) ? snapshot.timeline : [];
    const nextSnapshot = {
      ...evaluationSnapshot,
      current_stage: evaluated.to.code,
      status: evaluated.to.terminal ? 'closed' : evaluated.to.code,
      status_label: evaluated.to.label.en,
      pending_role: pendingActor.pending_role,
      pending_designation: pendingActor.pending_designation,
      timeline: [
        ...timeline,
        {
          id: cryptoRandomId(),
          from_stage: evaluated.from.code,
          to_stage: evaluated.to.code,
          verb: evaluated.transition.verb,
          actor_role: evaluated.transition.actor_role,
          actor_designation: evaluated.transition.actor_designation ?? null,
          comment: dto.comment?.trim() || null,
          created_at: now.toISOString(),
        },
        ...(dueAt
          ? [
              {
                id: cryptoRandomId(),
                from_stage: evaluated.to.code,
                to_stage: evaluated.to.code,
                verb: 'sla-armed',
                actor_role: 'system',
                comment: `SLA due at ${dueAt.toISOString()}`,
                created_at: now.toISOString(),
              },
            ]
          : []),
      ],
    };

    await this.prisma.$transaction(async (tx) => {
      const nextStage = workflow.row?.stages.find((stage) => stage.code === evaluated.to.code);
      await tx.application.update({
        where: { id: row.id },
        data: {
          workflowId: workflow.row?.id ?? undefined,
          currentStageId: nextStage?.id ?? null,
          status: nextSnapshot.status,
          statusLabel: { en: nextSnapshot.status_label },
          pendingRole: pendingActor.pending_role,
          pendingDesignation: pendingActor.pending_designation,
          runtimeSnapshot: nextSnapshot as Prisma.InputJsonValue,
        },
      });
      await tx.applicationTimeline.create({
        data: {
          tenantId: row.tenantId,
          applicationId: row.id,
          fromStage: evaluated.from.code,
          toStage: evaluated.to.code,
          verb: evaluated.transition.verb,
          actorSubject: principal.subject,
          actorRole: evaluated.transition.actor_role,
          actorDesignation: evaluated.transition.actor_designation ?? null,
          comment: dto.comment?.trim() || null,
          metadata: { effects: evaluated.effects } as unknown as Prisma.InputJsonValue,
        },
      });
      if (evaluated.effects.some((effect) => effect.type === 'notify')) {
        await tx.notification.create({
          data: {
            tenantId: row.tenantId,
            citizenId: row.citizenId,
            type: 'application_status',
            title: 'Application status updated',
            body: `${row.docketNo} moved to ${evaluated.to.label.en}`,
            deepLink: `/applications?application=${encodeURIComponent(row.docketNo)}`,
          },
        });
      }
    });

    if (evaluated.effects.some((effect) => effect.type === 'generate_payment_link')) {
      const linkEffect = evaluated.effects.find(
        (effect) => effect.type === 'generate_payment_link',
      );
      const feeCode = parseFeeLineCode(linkEffect?.payload?.fee_code, 'approval');
      await this.payments.issueDeskPaymentLink(principal.tenantId, row.id, feeCode);
      await this.prisma.notification.create({
        data: {
          tenantId: row.tenantId,
          citizenId: row.citizenId,
          type: 'application_status',
          title: 'Payment required',
          body: `${row.docketNo}: please complete payment to proceed`,
          deepLink: `/applications?application=${encodeURIComponent(row.docketNo)}`,
        },
      });
    }

    if (evaluated.effects.some((effect) => effect.type === 'create_work_order')) {
      await this.postApprovalExecution.handleTransitionEffects(
        this.prisma,
        row.tenantId,
        row.id,
        evaluated.effects,
        evaluated.to.code,
      );
    }
    await this.postApprovalExecution.syncWorkOrderStatusForStage(
      row.tenantId,
      row.id,
      evaluated.to.code,
    );

    if (this.bookings) {
      await this.bookings.syncDeskWorkflowToReservation(principal, {
        workflowCode: workflow.definition.code,
        applicationId: row.id,
        verb: evaluated.transition.verb,
        toStage: evaluated.to.code,
        cancelReason: dto.comment,
      });
    }

    await this.auditTenantMutation(principal, 'desk.application.transition', {
      docket_no: row.docketNo,
      verb: evaluated.transition.verb,
      from_stage: evaluated.from.code,
      to_stage: evaluated.to.code,
    });

    return this.getDeskApplication(principal, row.docketNo);
  }

  async assignDeskWorkOrder(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    input: { vendor_id?: string | null; assigned_user_id?: string | null },
  ): Promise<TenantDeskApplicationDetail> {
    assertDeskAccess(principal);
    const row = await this.prisma.application.findFirst({
      where: { tenantId: principal.tenantId, id: applicationId },
      select: { id: true, docketNo: true },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const workOrder = await this.workOrders.getByApplicationId(principal.tenantId, row.id);
    if (!workOrder) {
      throw new BadRequestException('No work order exists for this application yet');
    }
    await this.workOrders.assign(principal.tenantId, workOrder.id, input);
    return this.getDeskApplication(principal, row.docketNo);
  }

  async listDeskGrievances(
    principal: AuthenticatedPrincipal,
    queue = 'my',
    filters: { page?: string; page_size?: string } = {},
  ): Promise<TenantDeskInboxPage<TenantDeskGrievanceListItem>> {
    assertDeskAccess(principal);
    if (queue === 'all' && !hasDeskAdminRole(principal.roles)) {
      throw new ForbiddenException('Only municipality admins can view all grievances');
    }
    const { page, pageSize } = parseDeskInboxPagination(filters.page, filters.page_size);
    const roles = normalizeDeskRoles(principal.roles);
    const designations = await loadStaffDesignationContext(this.prisma, principal);
    const terminalGrievance = ['resolved', 'closed'];

    const where: Prisma.GrievanceWhereInput = {
      tenantId: principal.tenantId,
      NOT: { status: { in: terminalGrievance } },
      ...(queue === 'breached' ? { slaBreachedAt: { not: null } } : {}),
      ...(queue === 'my'
        ? { OR: deskGrievanceMyQueueWhereClause(principal, roles, designations.userId) }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.grievance.count({ where }),
      this.prisma.grievance.findMany({
        where,
        orderBy: [{ slaBreachedAt: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const labelMaps = await this.loadGrievanceLabelMaps(principal.tenantId);
    return {
      items: rows.map((row) => toDeskGrievanceListItem(row, labelMaps)),
      total,
      page,
      page_size: pageSize,
    };
  }

  async getDeskGrievance(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
  ): Promise<TenantDeskGrievanceDetail> {
    assertDeskAccess(principal);
    const row = await this.prisma.grievance.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [{ id: grievanceId }, { grievanceNo: grievanceId }],
      },
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    const [timelineRows, attachmentRows] = await Promise.all([
      this.prisma.grievanceTimelineEntry.findMany({
        where: { tenantId: principal.tenantId, grievanceId: row.id },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.grievanceAttachment.findMany({
        where: { tenantId: principal.tenantId, grievanceId: row.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const labelMaps = await this.loadGrievanceLabelMaps(principal.tenantId);
    const now = new Date();
    const downloadTtlMs = 15 * 60 * 1000;
    const attachments: TenantDeskGrievanceAttachment[] = await Promise.all(
      attachmentRows.map(async (attachment) => {
        const signed = await this.objectStorage.presignDownload(
          attachment.storageKey,
          downloadTtlMs,
          now,
        );
        return {
          id: attachment.id,
          content_type: attachment.contentType,
          storage_key: attachment.storageKey,
          created_at: attachment.createdAt.toISOString(),
          download_url: signed.url,
        };
      }),
    );
    return {
      grievance: {
        ...toDeskGrievanceListItem(row, labelMaps),
        description: row.description,
        location: row.location as Prisma.JsonValue,
        photo_keys: row.photoKeys as Prisma.JsonValue,
        attachments,
      },
      timeline: timelineRows.map((entry) => ({
        id: entry.id,
        event_type: entry.eventType,
        actor_subject: entry.actorSubject,
        body: entry.body,
        metadata: entry.metadata as Prisma.JsonValue,
        occurred_at: entry.occurredAt.toISOString(),
      })),
      allowed_statuses: nextGrievanceStatuses(row.status as GrievanceStatus),
    };
  }

  async getDeskGrievanceAttachmentBlob(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    assertDeskAccess(principal);
    const row = await this.prisma.grievance.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [{ id: grievanceId }, { grievanceNo: grievanceId }],
      },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    const attachment = await this.prisma.grievanceAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId: principal.tenantId,
        grievanceId: row.id,
      },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    const mime = attachment.contentType.toLowerCase();
    if (this.objectStorage.isEnabled()) {
      const buffer = await this.objectStorage.getObjectBuffer(attachment.storageKey);
      if (buffer && buffer.length > 0) {
        return { buffer, contentType: attachment.contentType };
      }
      throw new NotFoundException('Evidence object not found in storage');
    }
    if (mime.startsWith('image/')) {
      const label = attachment.storageKey.split('/').pop() ?? 'evidence';
      const safe = label.replace(/[<>&"]/g, '');
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#e8f4ef"/>
  <text x="320" y="168" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#1a3d2e">Evidence registered</text>
  <text x="320" y="200" text-anchor="middle" font-family="monospace" font-size="12" fill="#4a6358">${safe}</text>
  <text x="320" y="228" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#6b7f75">Local dev: object bytes not served from MinIO yet</text>
</svg>`;
      return { buffer: Buffer.from(svg, 'utf8'), contentType: 'image/svg+xml' };
    }
    if (mime.startsWith('video/')) {
      throw new NotFoundException('Video preview not available in local dev');
    }
    throw new NotFoundException('Unsupported attachment type for preview');
  }

  private async loadGrievanceLabelMaps(tenantId: string): Promise<GrievanceLabelMaps> {
    return loadGrievanceLabelMapsForTenant(this.prisma, tenantId);
  }

  async updateDeskGrievanceStatus(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: { status: string; note?: string },
  ): Promise<TenantDeskGrievanceDetail> {
    assertDeskAccess(principal);
    if (!isGrievanceStatus(dto.status)) {
      throw new BadRequestException('Invalid status');
    }
    const row = await this.prisma.grievance.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [{ id: grievanceId }, { grievanceNo: grievanceId }],
      },
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    const from = row.status as GrievanceStatus;
    const to = dto.status as GrievanceStatus;
    try {
      assertGrievanceTransition(from, to);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid transition');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: row.id },
        data: { status: to, resolvedAt: to === 'resolved' ? new Date() : row.resolvedAt },
      });
      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'status_change',
          actorSubject: principal.subject,
          body: dto.note ?? `Status → ${to}`,
          metadata: { from, to },
        },
      });
    });
    await this.auditTenantMutation(principal, 'desk.grievance.status', {
      grievance_no: row.grievanceNo,
      from,
      to,
    });
    return this.getDeskGrievance(principal, row.id);
  }

  async assignDeskGrievance(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    userId: string,
  ): Promise<TenantDeskGrievanceDetail> {
    assertDeskAdmin(principal);
    const [row, user] = await Promise.all([
      this.prisma.grievance.findFirst({
        where: {
          tenantId: principal.tenantId,
          OR: [{ id: grievanceId }, { grievanceNo: grievanceId }],
        },
      }),
      this.prisma.user.findFirst({ where: { tenantId: principal.tenantId, id: userId } }),
    ]);
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    if (!user) {
      throw new BadRequestException('User not found in tenant');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: row.id },
        data: {
          assignedToUserId: userId,
          status: row.status === 'submitted' ? 'under_review' : row.status,
        },
      });
      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'assignment',
          actorSubject: principal.subject,
          body: `Assigned to user ${userId}`,
          metadata: {},
        },
      });
    });
    await this.auditTenantMutation(principal, 'desk.grievance.assign', {
      grievance_no: row.grievanceNo,
      user_id: userId,
    });
    return this.getDeskGrievance(principal, row.id);
  }

  async commentDeskGrievance(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    body: string,
  ): Promise<TenantDeskGrievanceDetail> {
    assertDeskAccess(principal);
    const row = await this.prisma.grievance.findFirst({
      where: {
        tenantId: principal.tenantId,
        OR: [{ id: grievanceId }, { grievanceNo: grievanceId }],
      },
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    await this.prisma.grievanceTimelineEntry.create({
      data: {
        tenantId: principal.tenantId,
        grievanceId: row.id,
        eventType: 'comment',
        actorSubject: principal.subject,
        body,
        metadata: {},
      },
    });
    return this.getDeskGrievance(principal, row.id);
  }

  async sweepDeskGrievanceSla(principal: AuthenticatedPrincipal): Promise<{ breached: number }> {
    assertDeskAdmin(principal);
    const now = new Date();
    const rows = await this.prisma.grievance.findMany({
      where: {
        tenantId: principal.tenantId,
        slaDueAt: { lt: now },
        slaBreachedAt: null,
        NOT: { status: { in: ['resolved', 'closed'] } },
      },
      take: 100,
    });
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.grievance.update({
          where: { id: row.id },
          data: {
            slaBreachedAt: now,
            routedRoleCode: 'municipality_admin',
            assignedToUserId: null,
          },
        });
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId: principal.tenantId,
            grievanceId: row.id,
            eventType: 'sla_breach',
            actorSubject: principal.subject,
            body: 'SLA breached; escalated to municipality_admin',
            metadata: { previous_role: row.routedRoleCode },
          },
        });
      }
    });
    await this.auditTenantMutation(principal, 'desk.grievance.sweep_sla', {
      breached: rows.length,
    });
    return { breached: rows.length };
  }

  private async loadWorkflowForDesk(
    serviceId: string,
  ): Promise<{ definition: WorkflowDefinition; row: WorkflowWithChildren | null }> {
    const row = await this.prisma.workflow.findFirst({
      where: { serviceId, status: 'published' },
      orderBy: { version: 'desc' },
      include: workflowInclude,
    });
    if (row) {
      return { definition: normalizeDeskWorkflowActors(toWorkflowDefinition(row)), row };
    }
    return {
      definition: normalizeDeskWorkflowActors(workflowForPattern('certificate-issuance')),
      row: null,
    };
  }

  private async allowedApplicationTransitions(
    principal: AuthenticatedPrincipal,
    workflow: { definition: WorkflowDefinition; row: WorkflowWithChildren | null },
    currentStage: string,
    runtimeSnapshot: Record<string, unknown> | undefined,
    serviceOverrideConfig: Prisma.JsonValue,
    feePreviewPaise: number | null = null,
  ): Promise<TenantDeskAllowedTransition[]> {
    const roles = normalizeDeskRoles(principal.roles);
    const staffDesignations = await loadStaffDesignationContext(this.prisma, principal);
    const bocPolicy = readBocPolicy(serviceOverrideConfig);
    const baseSnapshot = runtimeSnapshot ?? {};
    const transitions = workflow.definition.transitions.filter(
      (transition) =>
        transition.from === currentStage &&
        transitionActorAllowed(transition, roles, staffDesignations.codes),
    );
    const allowed: TenantDeskAllowedTransition[] = [];
    for (const transition of transitions) {
      const evaluationSnapshot = deskSnapshotForAllowedTransition(
        serviceOverrideConfig,
        baseSnapshot,
        currentStage,
        transition.guard,
        { feePreviewPaise },
      );
      let evaluated = evaluateTransition({
        workflow: workflow.definition,
        current_stage: currentStage,
        verb: transition.verb,
        actor_roles: roles as WorkflowRole[],
        actor_designations: staffDesignations.codes,
        designation_capabilities: staffDesignations.capabilities,
        runtime_snapshot: evaluationSnapshot,
      });
      if (!evaluated.ok) {
        if (evaluated.reason === 'COMMENT_REQUIRED' && transition.verb === 'reject') {
          evaluated = evaluateTransition({
            workflow: workflow.definition,
            current_stage: currentStage,
            verb: transition.verb,
            actor_roles: roles as WorkflowRole[],
            actor_designations: staffDesignations.codes,
            designation_capabilities: staffDesignations.capabilities,
            runtime_snapshot: evaluationSnapshot,
            comment: 'preview',
          });
        }
        if (!evaluated.ok) {
          continue;
        }
      }
      try {
        await this.assertWorkflowStageCanAct(
          principal,
          workflow.row,
          currentStage,
          transition,
          staffDesignations.codes,
        );
      } catch {
        continue;
      }
      allowed.push({
        verb: transition.verb,
        to_stage: transition.to,
        label: labelForTransition(transition.verb),
        actor_role: transition.actor_role,
        actor_designation: transition.actor_designation ?? null,
        requires_comment: transition.requires_comment === true || transition.verb === 'reject',
        requires_boc_resolution_fields: transitionRequiresBocResolutionFields(transition.verb),
        officer_may_set_require_boc: officerMaySetRequireBoc(bocPolicy, currentStage),
        boc_policy: bocPolicy,
      });
    }
    return allowed;
  }

  private async assertWorkflowStageCanAct(
    principal: AuthenticatedPrincipal,
    workflow: WorkflowWithChildren | null,
    stageCode: string,
    transition: { actor_role: string; actor_designation?: string },
    actorDesignations: string[],
  ): Promise<void> {
    if (!workflow) {
      return;
    }
    const stage = workflow.stages.find((item) => item.code === stageCode);
    if (!stage) {
      return;
    }
    if (transition.actor_designation) {
      const rows = await this.prisma.designationStageMap.findMany({
        where: {
          tenantId: principal.tenantId,
          stageId: stage.id,
          designationCode: transition.actor_designation,
        },
      });
      if (rows.length > 0 && !rows.some((row) => row.canAct)) {
        throw new ForbiddenException('Designation cannot act on this workflow stage');
      }
      if (rows.length === 0 && !actorDesignations.includes(transition.actor_designation)) {
        throw new ForbiddenException('Designation cannot act on this workflow stage');
      }
      return;
    }
    const roles = normalizeDeskRoles([...principal.roles, transition.actor_role]);
    const rows = await this.prisma.roleStageMap.findMany({
      where: { tenantId: principal.tenantId, stageId: stage.id, roleCode: { in: roles } },
    });
    if (rows.length > 0 && !rows.some((row) => row.canAct)) {
      throw new ForbiddenException('Role cannot act on this workflow stage');
    }
  }

  private async getBookableAsset(tenantId: string, code: string) {
    const asset = await this.prisma.bookableAsset.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!asset) {
      throw new NotFoundException('Bookable asset not found');
    }
    return asset;
  }

  private async getOwnedService(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceRow> {
    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this tenant');
    }

    return {
      id: row.id,
      code: row.code,
      name: row.name as Prisma.JsonValue,
      description: row.description as Prisma.JsonValue,
      is_active: row.isActive,
      effective_sla_days: row.effectiveSlaDays,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async nextFormVersion(tenantId: string, serviceId: string): Promise<number> {
    const version = await this.prisma.serviceFormVersion.aggregate({
      where: { tenantId, serviceId },
      _max: { version: true },
    });
    return (version._max.version ?? 0) + 1;
  }

  private async nextWorkflowVersion(tenantId: string, serviceId: string): Promise<number> {
    const version = await this.prisma.workflow.aggregate({
      where: { tenantId, serviceId },
      _max: { version: true },
    });
    return (version._max.version ?? 0) + 1;
  }
}

const workflowInclude = {
  stages: { orderBy: { sortOrder: 'asc' as const } },
  transitions: {
    include: {
      fromStage: true,
      toStage: true,
    },
  },
};

const DESK_ROLES = new Set([
  'tenant_clerk',
  'municipality_clerk',
  'tenant_admin',
  'municipality_admin',
  'state_admin',
]);

const DESK_ADMIN_ROLES = new Set(['tenant_admin', 'municipality_admin', 'state_admin']);

function assertDeskAccess(principal: AuthenticatedPrincipal): void {
  if (!principal.tenantId || !principal.roles.some((role) => DESK_ROLES.has(role))) {
    throw new ForbiddenException('Tenant Desk requires clerk or municipality admin role');
  }
}

function assertDeskAdmin(principal: AuthenticatedPrincipal): void {
  assertDeskAccess(principal);
  if (!hasDeskAdminRole(principal.roles)) {
    throw new ForbiddenException('Municipality admin role required');
  }
}

function hasDeskAdminRole(roles: string[]): boolean {
  return roles.some((role) => DESK_ADMIN_ROLES.has(role));
}

function normalizeDeskRoles(roles: string[]): string[] {
  const out = new Set(roles.filter(Boolean));
  if (out.has('municipality_clerk')) {
    out.add('tenant_clerk');
  }
  if (out.has('tenant_clerk')) {
    out.add('municipality_clerk');
  }
  if (out.has('municipality_admin')) {
    out.add('tenant_admin');
  }
  if (out.has('tenant_admin')) {
    out.add('municipality_admin');
  }
  if (out.has('state_admin')) {
    out.add('tenant_admin');
    out.add('municipality_admin');
    out.add('tenant_clerk');
    out.add('municipality_clerk');
  }
  return [...out];
}

function normalizeDeskWorkflowActors(workflow: WorkflowDefinition): WorkflowDefinition {
  const ownerByStage = new Map(workflow.stages.map((stage) => [stage.code, stage.owner_role]));
  return {
    ...workflow,
    transitions: workflow.transitions.map((transition) => {
      const fromOwner = ownerByStage.get(transition.from);
      if (
        (fromOwner === 'tenant_clerk' || fromOwner === 'municipality_clerk') &&
        (transition.actor_role === 'tenant_admin' || transition.actor_role === 'municipality_admin')
      ) {
        return { ...transition, actor_role: fromOwner };
      }
      return transition;
    }),
  };
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function cryptoRandomId(): string {
  return randomUUID();
}

function toApplicationSnapshot(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDeskApplicationDocument(row: {
  id: string;
  documentCode: string;
  originalName: string;
  mimeType: string;
  sizeMb: { toNumber(): number } | number;
  uploadStatus: string;
  scanStatus: string;
  createdAt: Date;
}): TenantDeskApplicationDocument {
  return {
    id: row.id,
    document_code: row.documentCode,
    original_name: row.originalName,
    mime_type: row.mimeType,
    size_mb: decimalToNumber(row.sizeMb),
    upload_status: row.uploadStatus,
    scan_status: row.scanStatus,
    created_at: row.createdAt.toISOString(),
  };
}

function toDeskApplicationDocumentsFromSnapshot(value: unknown): TenantDeskApplicationDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: TenantDeskApplicationDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) {
      continue;
    }
    rows.push({
      id,
      document_code: typeof record.document_code === 'string' ? record.document_code : 'document',
      original_name: typeof record.original_name === 'string' ? record.original_name : 'attachment',
      mime_type:
        typeof record.mime_type === 'string' ? record.mime_type : 'application/octet-stream',
      size_mb: typeof record.size_mb === 'number' ? record.size_mb : 0,
      upload_status: typeof record.upload_status === 'string' ? record.upload_status : 'uploaded',
      scan_status: typeof record.scan_status === 'string' ? record.scan_status : 'pending',
      created_at:
        typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
    });
  }
  return rows;
}

function snapshotString(value: Prisma.JsonValue, key: string): string | null {
  const snapshot = toApplicationSnapshot(value);
  const v = snapshot[key];
  return typeof v === 'string' ? v : null;
}

function timelineHasActorRole(snapshot: Record<string, unknown>, roles: string[]): boolean {
  if (!Array.isArray(snapshot.timeline)) {
    return false;
  }
  return snapshot.timeline.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const actorRole = (item as Record<string, unknown>).actor_role;
    return typeof actorRole === 'string' && roles.includes(actorRole);
  });
}

function toDeskApplicationListItem(row: {
  id: string;
  docketNo: string;
  serviceCode: string;
  status: string;
  statusLabel: Prisma.JsonValue;
  pendingRole: string | null;
  pendingDesignation?: string | null;
  paymentStatus: string;
  submittedAt: Date;
  updatedAt?: Date;
  runtimeSnapshot: Prisma.JsonValue;
  service: {
    name: Prisma.JsonValue;
    department?: { id: string; code: string; name: Prisma.JsonValue } | null;
  };
}): TenantDeskApplicationListItem {
  const snapshot = toApplicationSnapshot(row.runtimeSnapshot);
  const feeSettlement = coerceFeeSettlementSnapshot(snapshot.fee_settlement);
  const scheduleRaw = snapshot.payment_schedule;
  const payment_schedule =
    scheduleRaw === 'upfront_only' ||
    scheduleRaw === 'deferred_only' ||
    scheduleRaw === 'upfront_and_deferred'
      ? scheduleRaw
      : undefined;
  return {
    id: row.id,
    docket_no: row.docketNo,
    service_code: row.serviceCode,
    service_name: labelFromJson(row.service.name).en,
    status: snapshotString(row.runtimeSnapshot, 'status') ?? row.status,
    status_label:
      snapshotString(row.runtimeSnapshot, 'status_label') ?? labelFromJson(row.statusLabel).en,
    current_stage: snapshotString(row.runtimeSnapshot, 'current_stage') ?? row.status,
    pending_role: snapshotString(row.runtimeSnapshot, 'pending_role') ?? row.pendingRole,
    pending_designation:
      snapshotString(row.runtimeSnapshot, 'pending_designation') ?? row.pendingDesignation ?? null,
    pending_at_label: null,
    payment_status: snapshotString(row.runtimeSnapshot, 'payment_status') ?? row.paymentStatus,
    payment_schedule,
    fee_settlement:
      Object.keys(feeSettlement).length > 0
        ? (feeSettlement as TenantDeskApplicationListItem['fee_settlement'])
        : undefined,
    payment_redirect_url: snapshotString(row.runtimeSnapshot, 'payment_redirect_url'),
    active_payment_id: snapshotString(row.runtimeSnapshot, 'active_payment_id'),
    submitted_at:
      typeof snapshot.submitted_at === 'string'
        ? snapshot.submitted_at
        : row.submittedAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
    department_id: row.service.department?.id ?? null,
    department_code: row.service.department?.code ?? null,
    department_name: row.service.department ? labelFromJson(row.service.department.name).en : null,
  };
}

function resolvePendingRoleFromEffects(effects: WorkflowEffect[]): string | null {
  for (const effect of effects) {
    if (effect.type === 'escalate') {
      const target = effect.payload?.target_role;
      if (typeof target === 'string' && target.trim()) {
        return target.trim();
      }
    }
  }
  return null;
}

function labelForTransition(verb: string): string {
  return verb
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type GrievanceLabelMaps = {
  categories: Map<string, string>;
  subtypes: Map<string, string>;
};

async function loadGrievanceLabelMapsForTenant(
  prisma: PrismaService,
  tenantId: string,
): Promise<GrievanceLabelMaps> {
  const [categories, subtypes] = await Promise.all([
    prisma.tenantGrievanceCategory.findMany({
      where: { tenantId },
      select: { code: true, name: true },
    }),
    prisma.tenantGrievanceSubtype.findMany({
      where: { tenantId },
      select: { categoryCode: true, code: true, name: true },
    }),
  ]);
  const categoryMap = new Map<string, string>();
  for (const row of categories) {
    categoryMap.set(row.code, pickEnLabel(row.name));
  }
  const subtypeMap = new Map<string, string>();
  for (const row of subtypes) {
    subtypeMap.set(`${row.categoryCode}:${row.code}`, pickEnLabel(row.name));
  }
  return { categories: categoryMap, subtypes: subtypeMap };
}

function pickEnLabel(name: Prisma.JsonValue): string {
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    const record = name as Record<string, unknown>;
    if (typeof record.en === 'string' && record.en.trim().length > 0) {
      return record.en;
    }
  }
  return 'Category';
}

function toDeskGrievanceListItem(
  row: {
    id: string;
    grievanceNo: string;
    category: string;
    subtypeCode: string | null;
    status: string;
    grievancePriority: string;
    routedRoleCode: string | null;
    assignedToUserId: string | null;
    slaDueAt: Date | null;
    slaBreachedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  labelMaps: GrievanceLabelMaps,
): TenantDeskGrievanceListItem {
  const subtypeKey =
    row.subtypeCode && row.subtypeCode.length > 0 ? `${row.category}:${row.subtypeCode}` : null;
  return {
    id: row.id,
    grievance_no: row.grievanceNo,
    category: row.category,
    category_label: labelMaps.categories.get(row.category) ?? row.category,
    subtype_code: row.subtypeCode,
    subtype_label: subtypeKey ? (labelMaps.subtypes.get(subtypeKey) ?? row.subtypeCode) : null,
    status: row.status,
    priority: row.grievancePriority,
    routed_role_code: row.routedRoleCode,
    assigned_to_user_id: row.assignedToUserId,
    sla_due_at: row.slaDueAt?.toISOString() ?? null,
    sla_breached_at: row.slaBreachedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function deskGrievanceMyQueueWhereClause(
  principal: AuthenticatedPrincipal,
  roles: string[],
  staffUserId: string | null,
): Prisma.GrievanceWhereInput[] {
  const clauses: Prisma.GrievanceWhereInput[] = [];
  if (roles.length > 0) {
    clauses.push({ routedRoleCode: { in: roles } });
  }
  if (staffUserId) {
    clauses.push({ assignedToUserId: staffUserId });
  }
  if (hasDeskAdminRole(principal.roles)) {
    clauses.push({ slaBreachedAt: { not: null } });
  }
  return clauses.length > 0 ? clauses : [{ id: { in: [] } }];
}

function parseDeptCodesFromQuery(dept?: string): string[] {
  if (!dept?.trim()) {
    return [];
  }
  return dept
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDeskInboxPagination(
  pageRaw?: string,
  pageSizeRaw?: string,
): { page: number; pageSize: number } {
  const page = Math.max(Number.parseInt(pageRaw ?? '1', 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(pageSizeRaw ?? '25', 10) || 25, 1), 100);
  return { page, pageSize };
}

async function resolveDeskDepartmentIds(
  prisma: import('../../common/database/prisma.service').PrismaService,
  tenantId: string,
  deptCodes: string[],
  legacyDepartmentId?: string,
): Promise<string[] | undefined> {
  if (legacyDepartmentId) {
    assertUuid(legacyDepartmentId, 'department_id');
    return [legacyDepartmentId];
  }
  if (!deptCodes.length) {
    return undefined;
  }
  const rows = await prisma.tenantDepartment.findMany({
    where: {
      tenantId,
      isActive: true,
      code: { in: deptCodes },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

function nextGrievanceStatuses(status: GrievanceStatus): GrievanceStatus[] {
  return GRIEVANCE_STATUSES.filter((candidate) => {
    try {
      assertGrievanceTransition(status, candidate);
      return true;
    } catch {
      return false;
    }
  });
}

function toSettingsRow(
  tenant: {
    id: string;
    code: string;
    languagesEnabled: string[];
  },
  config: {
    branding: Prisma.JsonValue;
    featureFlags: Prisma.JsonValue;
    defaultLanguage: string;
    contactPhone: string | null;
    contactEmail: string | null;
  },
  tenantCode?: string,
): TenantAdminSettings {
  return {
    tenant_id: tenant.id,
    tenant_code: tenantCode ?? tenant.code,
    branding: config.branding,
    feature_flags: config.featureFlags,
    languages_enabled: tenant.languagesEnabled,
    default_language: config.defaultLanguage,
    contact_phone: config.contactPhone,
    contact_email: config.contactEmail,
  };
}

function toTenantBannerRow(row: {
  id: string;
  code: string;
  severity: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  linkUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminBannerRow {
  return {
    id: row.id,
    code: row.code,
    severity: row.severity,
    title: row.title,
    body: row.body,
    link_url: row.linkUrl,
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toNotificationTemplateRow(row: {
  id: string;
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string | null;
  body: string;
  variables: Prisma.JsonValue;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminNotificationTemplateRow {
  return {
    id: row.id,
    code: row.code,
    channel: row.channel,
    locale: row.locale,
    trigger: row.trigger,
    subject: row.subject,
    body: row.body,
    variables: row.variables,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toKbArticleRow(row: {
  id: string;
  slug: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  tags: string[];
  status: string;
  publishedAt: Date | null;
  indexJobs?: Array<{ status: string; updatedAt: Date }>;
  updatedAt: Date;
}): TenantAdminKbArticleRow {
  const latestIndex = row.indexJobs?.[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    tags: row.tags,
    status: row.status,
    published_at: row.publishedAt?.toISOString() ?? null,
    index_status: latestIndex?.status ?? null,
    index_updated_at: latestIndex?.updatedAt.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toBrandingAssetRow(
  row: {
    id: string;
    code: string;
    kind: string;
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    updatedAt: Date;
  },
  themeColor: string | null,
): TenantAdminBrandingAssetRow {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    storage_key: row.storageKey,
    public_url: row.publicUrl,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    contrast_warnings: themeColor ? contrastWarnings(themeColor) : ['theme_color is not set'],
    updated_at: row.updatedAt.toISOString(),
  };
}

function toBookableAssetRow(row: {
  id: string;
  code: string;
  assetType: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  capacity: number | null;
  rateUnit: string;
  baseRatePaise: number;
  securityDepositPaise: number;
  slotStepMinutes: number;
  rules: Prisma.JsonValue;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminBookableAssetRow {
  return {
    id: row.id,
    code: row.code,
    asset_type: row.assetType,
    name: row.name,
    location: row.location,
    capacity: row.capacity,
    rate_unit: row.rateUnit,
    base_rate_paise: row.baseRatePaise,
    security_deposit_paise: row.securityDepositPaise,
    slot_step_minutes: row.slotStepMinutes,
    rules: row.rules,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toAvailabilityRow(row: {
  id: string;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  note: string | null;
  asset: { code: string };
}): TenantAdminBookableAvailabilityRow {
  return {
    id: row.id,
    asset_code: row.asset.code,
    kind: row.kind,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt.toISOString(),
    note: row.note,
  };
}

function toReservationRow(row: {
  id: string;
  bookingNo: string | null;
  citizenId: string | null;
  depositId: string | null;
  docketNo: string | null;
  holderName: string;
  holderMobile: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  cancelledAt: Date | null;
  cancelReason: string | null;
  note: string | null;
  updatedAt: Date;
  asset: { code: string };
}): TenantAdminBookingReservationRow {
  return {
    id: row.id,
    asset_code: row.asset.code,
    booking_no: row.bookingNo,
    citizen_id: row.citizenId,
    deposit_id: row.depositId,
    docket_no: row.docketNo,
    holder_name: row.holderName,
    holder_mobile: row.holderMobile,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt.toISOString(),
    status: row.status,
    cancelled_at: row.cancelledAt?.toISOString() ?? null,
    cancel_reason: row.cancelReason,
    note: row.note,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toStaffRow(row: {
  id: string;
  keycloakUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  status: string;
  updatedAt: Date;
  userRoles: Array<{
    role: { code: string; name: string };
    ward: { number: string } | null;
  }>;
}): TenantAdminStaffRow {
  return {
    id: row.id,
    keycloak_user_id: row.keycloakUserId,
    username: row.username,
    display_name: row.displayName,
    email: row.email,
    mobile: row.mobile,
    status: row.status,
    roles: row.userRoles.map((assignment) => ({
      code: assignment.role.code,
      name: assignment.role.name,
      ward_number: assignment.ward?.number ?? null,
    })),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toStaffInviteRow(row: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  roleCodes: string[];
  wardNumber: string | null;
  status: string;
  provisioningMode: string;
  keycloakUserId: string | null;
  failureReason: string | null;
  metadata: Prisma.JsonValue;
  updatedAt: Date;
}): TenantAdminStaffInviteRow {
  return {
    id: row.id,
    username: row.username,
    display_name: row.displayName,
    email: row.email,
    mobile: row.mobile,
    role_codes: row.roleCodes,
    ward_number: row.wardNumber,
    status: row.status,
    provisioning_mode: row.provisioningMode,
    keycloak_user_id: row.keycloakUserId,
    failure_reason: row.failureReason,
    metadata: row.metadata,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toRoleStageMapRow(row: {
  id: string;
  roleCode: string;
  canView: boolean;
  canAct: boolean;
  stage: {
    code: string;
    label: Prisma.JsonValue;
    workflow: { code: string };
  };
}): TenantAdminRoleStageMapRow {
  return {
    id: row.id,
    workflow_code: row.stage.workflow.code,
    stage_code: row.stage.code,
    stage_label: row.stage.label,
    role_code: row.roleCode,
    can_view: row.canView,
    can_act: row.canAct,
  };
}

function toFormVersionRow(row: {
  id: string;
  version: number;
  status: string;
  formSchema: Prisma.JsonValue;
  uiSchema: Prisma.JsonValue;
  publishedAt: Date | null;
}): TenantAdminFormVersionRow {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    form_schema: row.formSchema,
    ui_schema: row.uiSchema,
    published_at: row.publishedAt?.toISOString() ?? null,
  };
}

function toServiceConfigRow(
  row: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    description: Prisma.JsonValue;
    isActive: boolean;
    effectiveSlaDays: number | null;
    effectiveFeeConfig: Prisma.JsonValue;
    requiredDocuments: Prisma.JsonValue;
    overrideConfig: Prisma.JsonValue;
    updatedAt: Date;
    revenueHead: {
      id: string;
      code: string;
      name: Prisma.JsonValue;
      accountingCode: string;
    } | null;
  },
  workflowDefinition?: {
    stages?: Array<{ code?: string }>;
    transitions?: Array<{ effects?: Array<{ type?: string }> }>;
  } | null,
): TenantAdminServiceConfig {
  const payment = resolveServicePaymentConfig(
    row.overrideConfig,
    row.effectiveFeeConfig,
    workflowDefinition,
  );
  const primaryRule = payment.fee_lines[primaryFeeLineCode(payment.payment_schedule)]?.rule;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_active: row.isActive,
    effective_sla_days: row.effectiveSlaDays,
    updated_at: row.updatedAt.toISOString(),
    fee_rule: primaryRule ?? row.effectiveFeeConfig,
    fee_preview_paise: primaryRule
      ? previewFeeRule(primaryRule)
      : previewFeeRule(row.effectiveFeeConfig),
    payment_schedule: payment.payment_schedule,
    fee_lines: payment.fee_lines,
    fee_line_previews: payment.fee_line_previews,
    payment_schedule_inferred: payment.inferred_schedule,
    required_documents: normalizeDocumentChecklist(row.requiredDocuments),
    boc_policy: readBocPolicy(row.overrideConfig),
    municipal_signoff_policy: readMunicipalSignoffPolicyFromConfig(row.overrideConfig),
    municipal_signoff_threshold_paise: readMunicipalSignoffThresholdFromConfig(row.overrideConfig),
    revenue_head: row.revenueHead
      ? {
          id: row.revenueHead.id,
          code: row.revenueHead.code,
          name: row.revenueHead.name,
          accounting_code: row.revenueHead.accountingCode,
        }
      : null,
    bookable_asset_codes: bookableAssetCodesFromOverrideConfig(
      row.overrideConfig as Record<string, unknown> | null,
    ),
  };
}

function toRevenueHeadRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  accountingCode: string;
  isActive: boolean;
}): TenantAdminRevenueHeadRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    accounting_code: row.accountingCode,
    is_active: row.isActive,
  };
}

function toCatalogueRow(
  row: {
    id: string;
    code: string;
    departmentId: string;
    name: Prisma.JsonValue;
    description: Prisma.JsonValue;
    isActive: boolean;
    updatedAt: Date;
    globalCategoryCode: string;
    category: { code: string };
    globalService: { code: string } | null;
    department: { code: string; name: Prisma.JsonValue };
  },
  globalCode: string | null,
  source: TenantAdminCatalogueRow['source'],
): TenantAdminCatalogueRow {
  return {
    code: row.code,
    source,
    global_code: globalCode,
    tenant_service_id: row.id,
    category_code: seedCategoryCodeFromNavigation(row.globalCategoryCode),
    department_id: row.departmentId,
    department_code: row.department.code,
    department_name: row.department.name,
    name: row.name,
    description: row.description,
    is_active: row.isActive,
    has_local_override: true,
    updated_at: row.updatedAt.toISOString(),
  };
}

function nextForkCode(code: string): string {
  return `${code}-local`;
}

function toAddressMasterRow(row: {
  id: string;
  name: string;
  pincode: string | null;
  mouza: string | null;
  ward: {
    number: string;
    name: string | null;
    borough: { code: string; name: string } | null;
  } | null;
}): TenantAdminAddressMasterRow {
  return {
    borough_code: row.ward?.borough?.code ?? null,
    borough_name: row.ward?.borough?.name ?? null,
    ward_number: row.ward?.number ?? null,
    ward_name: row.ward?.name ?? null,
    mouza: row.mouza,
    locality_id: row.id,
    locality_name: row.name,
    pincode: row.pincode,
  };
}

function toTariffRow(row: {
  id: string;
  code: string;
  category: string;
  name: Prisma.JsonValue;
  rateConfig: Prisma.JsonValue;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminTariffRow {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    name: row.name,
    rate_config: row.rateConfig,
    preview_paise: previewFeeRule(row.rateConfig),
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function previewFeeRule(value: Prisma.JsonValue): number | null {
  try {
    assertValidFeeRule(value);
    return calculateFeePreview(value as FeeRule, {
      built_up_area_sqft: 1000,
      monthly_kl: 20,
    });
  } catch {
    return null;
  }
}

const PAYMENT_SOURCES: TenantAdminPaymentSource[] = [
  'application',
  'booking',
  'rental',
  'ev',
  'water',
];

function tenantAdminPaymentSelect() {
  return {
    id: true,
    amountPaise: true,
    currency: true,
    status: true,
    method: true,
    gateway: true,
    gatewayOrderId: true,
    gatewayPaymentId: true,
    feeCode: true,
    createdAt: true,
    settledAt: true,
    citizenSubject: true,
    applicationId: true,
    bookingReservationId: true,
    leaseInvoiceId: true,
    evSessionId: true,
    waterMeterRechargeId: true,
    application: { select: { docketNo: true, serviceCode: true } },
    bookingReservation: { select: { bookingNo: true, id: true, docketNo: true } },
    leaseInvoice: { select: { invoiceNo: true, id: true } },
    receipt: { select: { serviceCode: true } },
  } satisfies Prisma.PaymentSelect;
}

type TenantAdminPaymentRow = Prisma.PaymentGetPayload<{
  select: ReturnType<typeof tenantAdminPaymentSelect>;
}>;

function derivePaymentSource(row: TenantAdminPaymentRow): TenantAdminPaymentSource {
  if (row.applicationId) return 'application';
  if (row.bookingReservationId) return 'booking';
  if (row.leaseInvoiceId) return 'rental';
  if (row.evSessionId) return 'ev';
  if (row.waterMeterRechargeId) return 'water';
  return 'application';
}

function paymentSourceLabel(source: TenantAdminPaymentSource): string {
  switch (source) {
    case 'application':
      return 'Application';
    case 'booking':
      return 'Booking';
    case 'rental':
      return 'Rental';
    case 'ev':
      return 'EV Charging';
    case 'water':
      return 'Water meter';
    default:
      return source;
  }
}

function toTenantPaymentLedgerRow(row: TenantAdminPaymentRow): TenantAdminPaymentLedgerRow {
  const source = derivePaymentSource(row);
  let reference = row.gatewayOrderId;
  const serviceCode = row.application?.serviceCode ?? row.receipt?.serviceCode ?? null;
  let deepLink: string | null = null;

  if (source === 'application' && row.application?.docketNo) {
    reference = row.application.docketNo;
    deepLink = `/dashboard/desk?docket=${encodeURIComponent(row.application.docketNo)}`;
  } else if (source === 'booking') {
    reference =
      row.bookingReservation?.bookingNo ??
      row.bookingReservation?.docketNo ??
      row.bookingReservation?.id.slice(0, 8) ??
      reference;
    if (row.bookingReservation?.id) {
      deepLink = `/dashboard/bookings?booking=${encodeURIComponent(row.bookingReservation.id)}`;
    }
  } else if (source === 'rental' && row.leaseInvoice) {
    reference = row.leaseInvoice.invoiceNo;
    deepLink = `/rental-assets/invoices?invoice=${encodeURIComponent(row.leaseInvoice.id)}`;
  } else if (source === 'ev' && row.evSessionId) {
    reference = row.evSessionId.slice(0, 8);
    deepLink = `/dashboard/operations?section=ev-charging`;
  } else if (source === 'water' && row.waterMeterRechargeId) {
    reference = row.waterMeterRechargeId.slice(0, 8);
    deepLink = `/dashboard/operations?section=iot-water`;
  }

  return {
    id: row.id,
    amount_paise: row.amountPaise,
    currency: row.currency,
    status: row.status,
    method: row.method,
    gateway: row.gateway,
    fee_code: row.feeCode,
    created_at: row.createdAt.toISOString(),
    settled_at: row.settledAt?.toISOString() ?? null,
    source,
    reference,
    service_code: serviceCode,
    citizen_subject: row.citizenSubject,
    deep_link: deepLink,
  };
}

function buildTenantPaymentWhere(
  tenantId: string,
  filters: {
    status?: string;
    source?: string;
    from?: string;
    to?: string;
    q?: string;
  },
): Prisma.PaymentWhereInput {
  let where = withDateRange<Prisma.PaymentWhereInput>({ tenantId }, 'createdAt', filters);

  if (filters.status === 'settled' || filters.status === 'failed') {
    where = { ...where, status: filters.status };
  } else if (filters.status === 'pending') {
    where = { ...where, status: 'requires_action' };
  }

  const source = filters.source as TenantAdminPaymentSource | undefined;
  if (source && PAYMENT_SOURCES.includes(source)) {
    const sourceWhere: Prisma.PaymentWhereInput =
      source === 'application'
        ? { applicationId: { not: null } }
        : source === 'booking'
          ? { bookingReservationId: { not: null } }
          : source === 'rental'
            ? { leaseInvoiceId: { not: null } }
            : source === 'ev'
              ? { evSessionId: { not: null } }
              : { waterMeterRechargeId: { not: null } };
    where = { AND: [where, sourceWhere] };
  }

  const q = filters.q?.trim();
  if (q) {
    where = {
      AND: [
        where,
        {
          OR: [
            { gatewayOrderId: { contains: q, mode: 'insensitive' } },
            { application: { docketNo: { contains: q, mode: 'insensitive' } } },
            { bookingReservation: { bookingNo: { contains: q, mode: 'insensitive' } } },
            { leaseInvoice: { invoiceNo: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ],
    };
  }

  return where;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function bucketDates(
  dates: Date[],
  start: Date,
  end: Date,
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1);
  }
  const buckets: Array<{ date: string; count: number }> = [];
  for (
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    cursor <= end;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const key = dayKey(cursor);
    buckets.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return buckets;
}

function bucketPayments(
  payments: Array<{ settledAt: Date | null; amountPaise: number }>,
  start: Date,
  end: Date,
): Array<{ date: string; settled: number; amount_paise: number }> {
  const counts = new Map<string, { settled: number; amount: number }>();
  for (const payment of payments) {
    if (!payment.settledAt) {
      continue;
    }
    const key = dayKey(payment.settledAt);
    const current = counts.get(key) ?? { settled: 0, amount: 0 };
    current.settled += 1;
    current.amount += payment.amountPaise;
    counts.set(key, current);
  }
  return bucketDates([], start, end).map((bucket) => {
    const current = counts.get(bucket.date) ?? { settled: 0, amount: 0 };
    return { date: bucket.date, settled: current.settled, amount_paise: current.amount };
  });
}

function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be an ISO date string`);
  }
  return parsed;
}

function withDateRange<TWhere extends Record<string, unknown>>(
  where: TWhere,
  field: string,
  filters: { from?: string; to?: string },
): TWhere {
  const from = parseOptionalDate(filters.from, 'from');
  const to = parseOptionalDate(filters.to, 'to');
  if (!from && !to) {
    return where;
  }
  return {
    ...where,
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  };
}

function csvSafe(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const escapedFormula = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${escapedFormula.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvSafe).join(','), ...rows.map((row) => row.map(csvSafe).join(','))].join(
    '\r\n',
  );
}

function parseDelimitedCell(value: string): string[] {
  return value
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateStaffImportRow(
  row: number,
  data: Record<string, string>,
): Array<{ row: number; field?: string; message: string }> {
  const errors: Array<{ row: number; field?: string; message: string }> = [];
  if (!data.username?.trim()) {
    errors.push({ row, field: 'username', message: 'username is required' });
  } else {
    try {
      assertUsername(data.username.trim().toLowerCase());
    } catch {
      errors.push({ row, field: 'username', message: 'username format is invalid' });
    }
  }
  if (!data.display_name?.trim()) {
    errors.push({ row, field: 'display_name', message: 'display_name is required' });
  } else {
    try {
      assertDisplayName(data.display_name.trim());
    } catch {
      errors.push({ row, field: 'display_name', message: 'display_name is invalid' });
    }
  }
  const roleCodes = parseDelimitedCell(data.role_codes ?? '');
  if (!roleCodes.length) {
    errors.push({ row, field: 'role_codes', message: 'role_codes is required' });
  } else {
    try {
      assertRoleCodes(roleCodes);
    } catch {
      errors.push({ row, field: 'role_codes', message: 'one or more role_codes are invalid' });
    }
  }
  if (data.email?.trim()) {
    try {
      assertOptionalContact(data.email.trim(), 'email');
    } catch {
      errors.push({ row, field: 'email', message: 'email is invalid' });
    }
  }
  if (data.mobile?.trim()) {
    try {
      assertOptionalContact(data.mobile.trim(), 'mobile');
    } catch {
      errors.push({ row, field: 'mobile', message: 'mobile is invalid' });
    }
  }
  return errors;
}

function parseCsv(input: string): {
  headers: string[];
  records: Array<{ row: number; data: Record<string, string> }>;
} {
  const lines = input
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], records: [] };
  }
  const headers = splitCsvLine(lines[0] ?? '').map((header) => header.trim());
  return {
    headers,
    records: lines.slice(1).map((line, index) => {
      const values = splitCsvLine(line);
      const data: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        data[header] = values[headerIndex]?.trim() ?? '';
      });
      return { row: index + 2, data };
    }),
  };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function validateAddressImportRow(
  dto: UpsertAddressMasterDto,
  row: number,
): TenantAdminAddressImportResult['errors'] {
  const errors: TenantAdminAddressImportResult['errors'] = [];
  if (!dto.ward_number.trim()) {
    errors.push({ row, field: 'ward_number', message: 'ward_number is required' });
  }
  if (!dto.locality_name.trim()) {
    errors.push({ row, field: 'locality_name', message: 'locality_name is required' });
  }
  if (dto.pincode && !/^\d{6}$/.test(dto.pincode.trim())) {
    errors.push({ row, field: 'pincode', message: 'pincode must be 6 digits' });
  }
  return errors;
}

function toWorkflowRow(row: WorkflowWithChildren): TenantAdminWorkflowRow {
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name as Prisma.JsonValue,
    published_at: row.publishedAt?.toISOString() ?? null,
    definition: toWorkflowDefinition(row),
  };
}

function toWorkflowDefinition(row: WorkflowWithChildren): WorkflowDefinition {
  return workflowDefinitionFromRows(row.code, row.version, row.stages, row.transitions);
}

function labelFromJson(value: Prisma.JsonValue): { en: string; bn: string; hi: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    const en = typeof map.en === 'string' && map.en.trim() ? map.en : 'Service';
    return {
      en,
      bn: typeof map.bn === 'string' && map.bn.trim() ? map.bn : en,
      hi: typeof map.hi === 'string' && map.hi.trim() ? map.hi : en,
    };
  }
  return { en: 'Service', bn: 'Service', hi: 'Service' };
}

function extractTemplateVariables(subject: string | undefined, body: string): string[] {
  const variables = new Set<string>();
  for (const match of `${subject ?? ''}\n${body}`.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)) {
    const variable = match[1];
    if (variable) {
      variables.add(variable);
    }
  }
  return [...variables];
}

function reportTitle(kind: string): string {
  const titles: Record<string, string> = {
    applications: 'Applications Report',
    payments: 'Revenue And Payments Report',
    revenue: 'Revenue And Payments Report',
    grievances: 'Grievances Report',
    'sla-summary': 'SLA Summary Report',
    sla: 'SLA Summary Report',
  };
  const title = titles[kind];
  if (!title) {
    throw new BadRequestException('Unsupported PDF report kind');
  }
  return title;
}

function brandingThemeColor(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const color = (value as Record<string, unknown>).theme_color;
  return typeof color === 'string' ? color : null;
}

function contrastWarnings(themeColor: string): string[] {
  const match = /^#?([0-9a-f]{6})$/i.exec(themeColor);
  if (!match) {
    return ['theme_color is not a #RRGGBB color'];
  }
  const hex = match[1] ?? '000000';
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const linear = [r, g, b].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const warnings: string[] = [];
  if (Math.max(contrastWithWhite, contrastWithBlack) < 4.5) {
    warnings.push('Theme color has weak contrast with both white and black text');
  }
  return warnings;
}

function assertBrandingAssetKind(value: unknown): asserts value is string {
  if (!['logo', 'hero'].includes(String(value))) {
    throw new BadRequestException('Unsupported branding asset kind');
  }
}

function assertBrandingAssetMime(value: unknown): asserts value is string {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(String(value))) {
    throw new BadRequestException('Unsupported branding asset MIME type');
  }
}

function assertAvailabilityKind(value: unknown): asserts value is string {
  if (!['available', 'blackout'].includes(String(value))) {
    throw new BadRequestException('Unsupported availability kind');
  }
}

function assertBookingStatus(value: unknown): asserts value is string {
  if (!['hold', 'confirmed', 'cancelled'].includes(String(value))) {
    throw new BadRequestException('Unsupported booking status');
  }
}

function assertBookableAssetType(value: unknown): asserts value is string {
  if (
    ![
      'HALL',
      'AUDITORIUM',
      'GROUND',
      'EQUIPMENT',
      'PARKING_ZONE',
      'LED_BOARD',
      'AMBULANCE',
      'HEARSE',
    ].includes(String(value))
  ) {
    throw new BadRequestException('Unsupported bookable asset_type');
  }
}

function assertBookableRateUnit(value: unknown): asserts value is string {
  if (!['HOUR', 'DAY'].includes(String(value))) {
    throw new BadRequestException('Unsupported bookable rate_unit');
  }
}

function parseNonNegativeInt(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
  return parsed;
}

function parsePositiveInt(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseTimeWindow(startsAtRaw: string, endsAtRaw: string): { startsAt: Date; endsAt: Date } {
  const startsAt = assertOptionalIsoDate(startsAtRaw, 'starts_at');
  const endsAt = assertOptionalIsoDate(endsAtRaw, 'ends_at');
  if (!startsAt || !endsAt || startsAt >= endsAt) {
    throw new BadRequestException('starts_at must be before ends_at');
  }
  return { startsAt, endsAt };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
}

function assertStaffStatus(value: unknown): asserts value is string {
  if (!['active', 'disabled', 'invited'].includes(String(value))) {
    throw new BadRequestException('Unsupported staff status');
  }
}

function assertUsername(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,99}$/i.test(value)) {
    throw new BadRequestException(
      'username must be 3-100 chars and use letters, numbers, dot, dash, underscore',
    );
  }
}

function assertDisplayName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > 255) {
    throw new BadRequestException('display_name must be 2-255 characters');
  }
}

function assertOptionalContact(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }
}

function assertStaffInviteAction(value: unknown): 'retry' | 'disable' | 'mark_provisioned' {
  if (value === 'retry' || value === 'disable' || value === 'mark_provisioned') {
    return value;
  }
  throw new BadRequestException('action must be retry, disable, or mark_provisioned');
}

function assertRoleCodes(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('role_codes must include at least one role');
  }
  const seen = new Set<string>();
  for (const roleCode of value) {
    assertRoleCode(roleCode);
    seen.add(roleCode);
  }
  if (seen.size !== value.length) {
    throw new BadRequestException('role_codes must be unique');
  }
}

function assertRoleCode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(value)) {
    throw new BadRequestException('role_code must use a known role-code format');
  }
}
