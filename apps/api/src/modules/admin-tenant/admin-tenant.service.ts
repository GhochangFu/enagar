import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { createLinearWorkflowDraft, validateWorkflowDefinition } from '@enagar/workflow';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  assertCode,
  assertLocaleLabel,
  assertValidDocumentChecklist,
  assertValidFeeRule,
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
import { assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { FeeRule } from './admin-tenant-config.contracts';
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
  PatchTenantSettingsDto,
  UpsertKbArticleDto,
  UpsertNotificationTemplateDto,
  UpsertTenantBannerDto,
  UpsertRoleStageMapDto,
  UpsertStaffDto,
} from './dto/tenant-operations.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { EnagarFormSchema } from '@enagar/forms';
import type { WorkflowDefinition, WorkflowEffect } from '@enagar/workflow';

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
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  is_active: boolean;
  has_local_override: boolean;
  updated_at: string | null;
};

export type TenantAdminServiceConfig = TenantAdminServiceRow & {
  fee_rule: Prisma.JsonValue;
  fee_preview_paise: number | null;
  required_documents: Prisma.JsonValue;
  revenue_head: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    accounting_code: string;
  } | null;
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

export type TenantAdminServiceDesigner = {
  service: TenantAdminServiceRow;
  form_draft: TenantAdminFormVersionRow | null;
  form_published: TenantAdminFormVersionRow | null;
  workflow_draft: TenantAdminWorkflowRow | null;
  workflow_published: TenantAdminWorkflowRow | null;
  starter_form_schema: EnagarFormSchema;
  starter_workflow: WorkflowDefinition;
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

export type TenantAdminRoleStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  stage_label: Prisma.JsonValue;
  role_code: string;
  can_view: boolean;
  can_act: boolean;
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
  constructor(private readonly prisma: PrismaService) {}

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
        include: { category: true, globalService: true },
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
        category_code: local?.category.code ?? global.category.code,
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
        category_code: local.category.code,
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
    const service = await this.prisma.tenantService.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: global.code } },
      create: {
        tenantId: principal.tenantId,
        globalServiceId: global.id,
        code: global.code,
        categoryId: global.categoryId,
        revenueHeadId: global.revenueHeadId,
        name: global.name as Prisma.InputJsonValue,
        description: global.description as Prisma.InputJsonValue,
        isActive: true,
        effectiveFeeConfig: global.feeConfig as Prisma.InputJsonValue,
        effectiveSlaDays: global.defaultSlaDays,
        requiredDocuments: global.requiredDocuments as Prisma.InputJsonValue,
      },
      update: { isActive: true },
      include: { category: true, globalService: true },
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
    const service = await this.prisma.tenantService.create({
      data: {
        tenantId: principal.tenantId,
        globalServiceId: null,
        code: forkCode,
        categoryId: source.categoryId,
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
      include: { category: true, globalService: true },
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
      include: { category: true, globalService: true },
    });
    if (!service) {
      const adopted = await this.adoptCatalogueService(principal, serviceCode);
      return this.deactivateCatalogueService(principal, adopted.code);
    }
    const updated = await this.prisma.tenantService.update({
      where: { id: service.id },
      data: { isActive: false },
      include: { category: true, globalService: true },
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
      select: {
        gatewayOrderId: true,
        gatewayPaymentId: true,
        amountPaise: true,
        currency: true,
        method: true,
        status: true,
        gateway: true,
        createdAt: true,
        settledAt: true,
        application: { select: { docketNo: true, serviceCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return toCsv(
      [
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
      rows.map((row) => [
        row.application.docketNo,
        row.application.serviceCode,
        row.gatewayOrderId,
        row.gatewayPaymentId ?? '',
        row.amountPaise,
        row.currency,
        row.method,
        row.status,
        row.gateway,
        row.createdAt.toISOString(),
        row.settledAt?.toISOString() ?? '',
      ]),
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

    return toServiceConfigRow(row);
  }

  async patchServiceConfig(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: PatchTenantServiceConfigDto,
  ): Promise<TenantAdminServiceConfig> {
    assertTenantPortalStaff(principal);
    const existing = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: { id: true },
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
    if (dto.fee_rule !== undefined) {
      assertValidFeeRule(dto.fee_rule);
      data.effectiveFeeConfig = dto.fee_rule as unknown as Prisma.InputJsonValue;
    }
    if (dto.required_documents !== undefined) {
      assertValidDocumentChecklist(dto.required_documents);
      data.requiredDocuments = dto.required_documents as unknown as Prisma.InputJsonValue;
    }
    if (revenueHeadId !== undefined) {
      data.revenueHead = revenueHeadId ? { connect: { id: revenueHeadId } } : { disconnect: true };
    }

    const updated = await this.prisma.tenantService.update({
      where: { id: existing.id },
      data,
      include: { revenueHead: true },
    });

    return toServiceConfigRow(updated);
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
      form_draft: formDraft ? toFormVersionRow(formDraft) : null,
      form_published: formPublished ? toFormVersionRow(formPublished) : null,
      workflow_draft: workflowDraft ? toWorkflowRow(workflowDraft) : null,
      workflow_published: workflowPublished ? toWorkflowRow(workflowPublished) : null,
      starter_form_schema: createBlankFormSchemaDraft(service.code, labelFromJson(service.name)),
      starter_workflow: createLinearWorkflowDraft(service.code),
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
          data: {
            tenantId: principal.tenantId,
            workflowId: workflow.id,
            code: stage.code,
            label: stage.label as unknown as Prisma.InputJsonValue,
            ownerRole: stage.owner_role,
            slaHours: stage.sla_hours,
            isInitial: stage.initial === true,
            isTerminal: stage.terminal === true,
            sortOrder: index,
          },
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
          data: {
            tenantId: principal.tenantId,
            workflowId: workflow.id,
            fromStageId,
            toStageId,
            verb: transition.verb,
            actorRole: transition.actor_role,
            requiresComment: transition.requires_comment === true,
            sideEffects: (transition.effects ?? []) as unknown as Prisma.InputJsonValue,
          },
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
    });
    return toKbArticleRow(row);
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
  updatedAt: Date;
}): TenantAdminKbArticleRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    tags: row.tags,
    status: row.status,
    published_at: row.publishedAt?.toISOString() ?? null,
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

function toServiceConfigRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  isActive: boolean;
  effectiveSlaDays: number | null;
  effectiveFeeConfig: Prisma.JsonValue;
  requiredDocuments: Prisma.JsonValue;
  updatedAt: Date;
  revenueHead: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    accountingCode: string;
  } | null;
}): TenantAdminServiceConfig {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_active: row.isActive,
    effective_sla_days: row.effectiveSlaDays,
    updated_at: row.updatedAt.toISOString(),
    fee_rule: row.effectiveFeeConfig,
    fee_preview_paise: previewFeeRule(row.effectiveFeeConfig),
    required_documents: row.requiredDocuments,
    revenue_head: row.revenueHead
      ? {
          id: row.revenueHead.id,
          code: row.revenueHead.code,
          name: row.revenueHead.name,
          accounting_code: row.revenueHead.accountingCode,
        }
      : null,
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
    name: Prisma.JsonValue;
    description: Prisma.JsonValue;
    isActive: boolean;
    updatedAt: Date;
    category: { code: string };
    globalService: { code: string } | null;
  },
  globalCode: string | null,
  source: TenantAdminCatalogueRow['source'],
): TenantAdminCatalogueRow {
  return {
    code: row.code,
    source,
    global_code: globalCode,
    tenant_service_id: row.id,
    category_code: row.category.code,
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
  return {
    code: row.code,
    version: row.version,
    stages: row.stages
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((stage) => ({
        code: stage.code,
        label: stage.label as { en: string; bn: string; hi: string },
        owner_role: stage.ownerRole,
        sla_hours: stage.slaHours ?? undefined,
        initial: stage.isInitial,
        terminal: stage.isTerminal,
      })),
    transitions: row.transitions.map((transition) => ({
      from: transition.fromStage.code,
      to: transition.toStage.code,
      verb: transition.verb,
      actor_role: transition.actorRole,
      requires_comment: transition.requiresComment,
      effects: transition.sideEffects as unknown as WorkflowEffect[],
    })),
  };
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
