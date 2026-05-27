import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SignJWT } from 'jose';

import { PrismaService } from '../../common/database/prisma.service';
import { KeycloakAdminProvisionerService } from '../../common/keycloak/keycloak-admin-provisioner.service';
import { globalServices } from '../services/service-catalogue.seed';

import { AdminStateGrievanceLibraryService } from './admin-state-grievance-library.service';
import {
  assertHexColor,
  assertImpersonationReason,
  assertLanguages,
  assertOnboardingStatus,
  assertStateAdmin,
  assertTenantCode,
} from './admin-state.contracts';

import type {
  CreateImpersonationTokenDto,
  GlobalServiceLifecycleDto,
  UpsertGlobalServiceTemplateDto,
  UpsertStateIntegrationDto,
  UpsertTenantDto,
} from './dto/state-admin.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

export type StateTenantRow = {
  id: string;
  code: string;
  name: string;
  district: string | null;
  ward_count: number | null;
  theme_color: string | null;
  languages_enabled: string[];
  is_active: boolean;
  services_total: number;
  citizens_total: number;
  applications_total: number;
};

export type StateAuditLogRow = {
  id: string;
  action: string;
  actorSubject: string;
  actorRole: string;
  targetCode: string | null;
  metadata: Prisma.JsonValue;
  createdAt: string;
};

export type StateAuditLogPage = {
  rows: StateAuditLogRow[];
  next_cursor: string | null;
};

export type StateTenantDetail = StateTenantRow & {
  config: Prisma.JsonValue;
  logo_url: string | null;
  active_services_total: number;
  grievances_open: number;
  payments_total: number;
  banners_active: number;
  staff_assignments_total: number;
  recent_audit_logs: StateAuditLogRow[];
  warnings: string[];
};

export type StateAuditLogQuery = {
  actor?: string;
  action?: string;
  tenant_code?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string;
};

export type StateAnalytics = {
  tenants_total: number;
  tenants_active: number;
  services_total: number;
  citizens_total: number;
  applications_open: number;
  grievances_open: number;
  payments_settled_last_30_days: number;
};

export type StateAnalyticsV2 = {
  window: { from: string; to: string };
  totals: {
    applications: number;
    grievances: number;
    payments_settled: number;
    payment_amount_paise: number;
    sla_breached_grievances: number;
  };
  deltas: Record<keyof StateAnalyticsV2['totals'], number>;
  tenant_slices: Array<{
    tenant_code: string;
    tenant_name: string;
    applications: number;
    grievances: number;
    payments_settled: number;
    sla_breached_grievances: number;
  }>;
  anomaly_hints: string[];
};

export type ImpersonationResult = {
  token: string;
  token_id: string;
  expires_at: string;
  tenant_code: string;
};

export type StateGlobalServiceTemplateRow = {
  id: string;
  code: string;
  category_code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  workflow_pattern: string;
  default_sla_days: number | null;
  fee_config: Prisma.JsonValue;
  required_documents: Prisma.JsonValue;
  lifecycle_status: string;
  library_version: number;
  tenant_adoptions: number;
  curator_notes: string | null;
  updated_at: string;
};

export type StateGlobalServicePreview = {
  code: string;
  lifecycle_status: string;
  affected_tenants: number;
  tenant_overrides_preserved: number;
  warnings: string[];
};

export type StateIntegrationRow = {
  provider_key: string;
  environment: string;
  status: string;
  owner: string | null;
  notes: string | null;
  readiness: Prisma.JsonValue;
  last_checked_at: string | null;
  updated_at: string;
};

export type AuditCoverageMatrix = {
  covered_actions: string[];
  required_actions: string[];
  missing_actions: string[];
};

const ONBOARDING_STUB_FORM_SCHEMA = {
  version: 1,
  fields: [
    {
      id: 'applicant_name',
      type: 'text',
      label: { en: 'Applicant name', bn: 'আবেদনকারীর নাম', hi: 'आवेदक का नाम' },
      required: true,
      max_length: 120,
    },
  ],
} as const;

export type OnboardingCatalogueResponse = {
  service_categories: Array<{
    code: string;
    name: Prisma.JsonValue;
    published_service_count: number;
  }>;
  grievance_categories: Array<{ code: string; name: Prisma.JsonValue }>;
  published_service_total: number;
};

@Injectable()
export class AdminStateService {
  private readonly logger = new Logger(AdminStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakProvisioner: KeycloakAdminProvisionerService,
    private readonly grievanceLibrary: AdminStateGrievanceLibraryService,
  ) {}

  async getOnboardingCatalogue(
    principal: AuthenticatedPrincipal,
  ): Promise<OnboardingCatalogueResponse> {
    assertStateAdmin(principal);
    const [serviceCategories, grievanceCategories, publishedGlobals] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.globalGrievanceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.globalService.findMany({
        where: { lifecycleStatus: 'published', isActive: true },
        select: { code: true, category: { select: { code: true } } },
      }),
    ]);

    const publishedByCategory = new Map<string, number>();
    for (const row of publishedGlobals) {
      const code = row.category.code;
      publishedByCategory.set(code, (publishedByCategory.get(code) ?? 0) + 1);
    }

    return {
      service_categories: serviceCategories.map((row) => ({
        code: row.code,
        name: row.name,
        published_service_count: publishedByCategory.get(row.code) ?? 0,
      })),
      grievance_categories: grievanceCategories.map((row) => ({
        code: row.code,
        name: row.name,
      })),
      published_service_total: publishedGlobals.length,
    };
  }

  async getAnalytics(principal: AuthenticatedPrincipal): Promise<StateAnalytics> {
    assertStateAdmin(principal);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      tenants_total,
      tenants_active,
      services_total,
      citizens_total,
      applications_open,
      grievances_open,
      payments_settled_last_30_days,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenantService.count(),
      this.prisma.citizen.count(),
      this.prisma.application.count({ where: { NOT: { status: 'closed' } } }),
      this.prisma.grievance.count({ where: { NOT: { status: { in: ['resolved', 'closed'] } } } }),
      this.prisma.payment.count({
        where: { status: 'settled', settledAt: { gte: thirtyDaysAgo } },
      }),
    ]);
    return {
      tenants_total,
      tenants_active,
      services_total,
      citizens_total,
      applications_open,
      grievances_open,
      payments_settled_last_30_days,
    };
  }

  async getAnalyticsV2(
    principal: AuthenticatedPrincipal,
    query: { from?: string; to?: string } = {},
  ): Promise<StateAnalyticsV2> {
    assertStateAdmin(principal);
    const window = analyticsWindow(query);
    const previous = previousWindow(window);
    const [tenants, current, prior] = await Promise.all([
      this.prisma.tenant.findMany({ select: { id: true, code: true, name: true } }),
      this.analyticsTotals(window),
      this.analyticsTotals(previous),
    ]);
    const slices = await Promise.all(
      tenants.map(async (tenant) => {
        const [applications, grievances, payments, breached] = await Promise.all([
          this.prisma.application.count({
            where: { tenantId: tenant.id, submittedAt: { gte: window.from, lte: window.to } },
          }),
          this.prisma.grievance.count({
            where: { tenantId: tenant.id, createdAt: { gte: window.from, lte: window.to } },
          }),
          this.prisma.payment.count({
            where: {
              tenantId: tenant.id,
              status: 'settled',
              settledAt: { gte: window.from, lte: window.to },
            },
          }),
          this.prisma.grievance.count({
            where: {
              tenantId: tenant.id,
              slaBreachedAt: { gte: window.from, lte: window.to },
            },
          }),
        ]);
        return {
          tenant_code: tenant.code,
          tenant_name: tenant.name,
          applications,
          grievances,
          payments_settled: payments,
          sla_breached_grievances: breached,
        };
      }),
    );
    const tenantSlices = slices
      .sort(
        (left, right) =>
          right.applications + right.grievances - (left.applications + left.grievances) ||
          left.tenant_code.localeCompare(right.tenant_code),
      )
      .slice(0, 10);
    return {
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      totals: current,
      deltas: {
        applications: current.applications - prior.applications,
        grievances: current.grievances - prior.grievances,
        payments_settled: current.payments_settled - prior.payments_settled,
        payment_amount_paise: current.payment_amount_paise - prior.payment_amount_paise,
        sla_breached_grievances: current.sla_breached_grievances - prior.sla_breached_grievances,
      },
      tenant_slices: tenantSlices,
      anomaly_hints: analyticsHints(current, prior, tenantSlices),
    };
  }

  async listTenants(principal: AuthenticatedPrincipal): Promise<StateTenantRow[]> {
    assertStateAdmin(principal);
    const rows = await this.prisma.tenant.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            services: true,
            citizens: true,
            applications: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      district: row.district,
      ward_count: row.wardCount,
      theme_color: row.themeColor,
      languages_enabled: row.languagesEnabled,
      is_active: row.isActive,
      services_total: row._count.services,
      citizens_total: row._count.citizens,
      applications_total: row._count.applications,
    }));
  }

  async upsertTenant(
    principal: AuthenticatedPrincipal,
    dto: UpsertTenantDto,
  ): Promise<StateTenantRow> {
    assertStateAdmin(principal);
    assertTenantCode(dto.code);
    assertHexColor(dto.theme_color);
    assertLanguages(dto.languages_enabled);
    assertOnboardingStatus(dto.status ?? 'active');
    assertWizardOnboarding(dto);

    const isActive = (dto.status ?? 'active') === 'active';
    const tenant = await this.prisma.tenant.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name,
        district: dto.district,
        wardCount: dto.ward_count ?? 0,
        themeColor: dto.theme_color,
        logoUrl: dto.logo_url || null,
        languagesEnabled: dto.languages_enabled,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        isActive,
      },
      update: {
        name: dto.name,
        district: dto.district,
        wardCount: dto.ward_count ?? 0,
        themeColor: dto.theme_color,
        logoUrl: dto.logo_url || null,
        languagesEnabled: dto.languages_enabled,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        isActive,
      },
      include: { _count: { select: { services: true, citizens: true, applications: true } } },
    });

    await this.prisma.tenantConfig.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id },
      update: {},
    });

    const serviceCategories = dto.service_category_codes
      ?.map((code) => code.trim())
      .filter(Boolean);
    const grievanceCategories = dto.grievance_category_codes
      ?.map((code) => code.trim())
      .filter(Boolean);

    if (serviceCategories?.length) {
      await this.adoptPublishedServicesByCategories(tenant.id, serviceCategories);
    } else if (dto.inherit_default_services !== false) {
      await this.inheritDefaultServices(tenant.id);
    }

    if (grievanceCategories?.length && isActive) {
      await this.grievanceLibrary.adoptForTenant(principal, tenant.code, {
        category_codes: grievanceCategories,
      });
    }

    let tenantAdminProvision: { username: string } | undefined;
    if (isActive && dto.tenant_admin_username?.trim()) {
      const provisioned = await this.keycloakProvisioner.provisionTenantAdmin({
        tenantId: tenant.id,
        tenantCode: tenant.code,
        username: dto.tenant_admin_username.trim(),
        email: dto.tenant_admin_email,
        firstName: dto.tenant_admin_first_name,
        lastName: dto.tenant_admin_last_name,
        temporaryPassword: dto.tenant_admin_password,
      });
      tenantAdminProvision = { username: provisioned.username };
    }

    if (isActive) {
      void this.triggerTenantRagIndex(tenant.code);
    }

    await this.audit(principal, 'tenant.upsert', tenant.id, tenant.code, {
      inherit_default_services: dto.inherit_default_services !== false,
      service_category_codes: serviceCategories ?? [],
      grievance_category_codes: grievanceCategories ?? [],
      tenant_admin: tenantAdminProvision?.username ?? null,
    });
    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      district: tenant.district,
      ward_count: tenant.wardCount,
      theme_color: tenant.themeColor,
      languages_enabled: tenant.languagesEnabled,
      is_active: tenant.isActive,
      services_total: tenant._count.services,
      citizens_total: tenant._count.citizens,
      applications_total: tenant._count.applications,
    };
  }

  async createImpersonationToken(
    principal: AuthenticatedPrincipal,
    dto: CreateImpersonationTokenDto,
  ): Promise<ImpersonationResult> {
    assertStateAdmin(principal);
    assertTenantCode(dto.tenant_code);
    assertImpersonationReason(dto.reason);
    const tenant = await this.prisma.tenant.findUnique({ where: { code: dto.tenant_code } });
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Active tenant not found');
    }

    const tokenId = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const secret = new TextEncoder().encode(
      process.env.STATE_IMPERSONATION_JWT_SECRET ?? 'dev-state-impersonation-secret-change-me',
    );
    const token = await new SignJWT({
      typ: 'state_impersonation',
      tenant_id: tenant.id,
      tenant_code: tenant.code,
      actor_sub: principal.subject,
      reason: dto.reason,
      role: ['state_admin', 'tenant_admin'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(`impersonation:${principal.subject}:${tenant.code}`)
      .setJti(tokenId)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secret);

    await this.prisma.impersonationToken.create({
      data: {
        targetTenantId: tenant.id,
        actorSubject: principal.subject,
        actorRole: 'state_admin',
        reason: dto.reason,
        tokenId,
        expiresAt,
      },
    });
    await this.audit(principal, 'impersonation.create', tenant.id, tenant.code, {
      reason: dto.reason,
      token_id: tokenId,
    });
    return {
      token,
      token_id: tokenId,
      expires_at: expiresAt.toISOString(),
      tenant_code: tenant.code,
    };
  }

  async listAuditLogs(
    principal: AuthenticatedPrincipal,
    query: StateAuditLogQuery = {},
  ): Promise<StateAuditLogPage> {
    assertStateAdmin(principal);
    const limit = clampLimit(query.limit);
    const rows = await this.prisma.stateAuditLog.findMany({
      where: auditWhere(query),
      orderBy: { createdAt: 'desc' },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    const pageRows = rows.slice(0, limit);
    return {
      rows: pageRows.map(toAuditLogRow),
      next_cursor: rows.length > limit ? (pageRows.at(-1)?.id ?? null) : null,
    };
  }

  async exportAuditLogsCsv(
    principal: AuthenticatedPrincipal,
    query: StateAuditLogQuery = {},
  ): Promise<string> {
    assertStateAdmin(principal);
    const rows = await this.prisma.stateAuditLog.findMany({
      where: auditWhere(query),
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return toCsv(
      ['created_at', 'actor_subject', 'actor_role', 'action', 'target_code', 'metadata'],
      rows.map((row) => [
        row.createdAt.toISOString(),
        row.actorSubject,
        row.actorRole,
        row.action,
        row.targetCode ?? '',
        JSON.stringify(row.metadata),
      ]),
    );
  }

  async getTenantOnboardingContext(
    principal: AuthenticatedPrincipal,
    code: string,
  ): Promise<{
    code: string;
    service_category_codes: string[];
    grievance_category_codes: string[];
    tenant_admin_username: string;
    default_language: string;
    support_email: string;
  }> {
    assertStateAdmin(principal);
    assertTenantCode(code);
    const tenant = await this.prisma.tenant.findUnique({
      where: { code },
      select: {
        code: true,
        config: true,
        services: {
          where: { isActive: true },
          select: { category: { select: { code: true } } },
        },
        grievanceCategories: {
          where: { isActive: true },
          select: { code: true },
          orderBy: { code: 'asc' },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const serviceCategoryCodes = Array.from(
      new Set(tenant.services.map((row) => row.category.code).filter(Boolean)),
    ).sort();
    const grievanceCategoryCodes = tenant.grievanceCategories.map((row) => row.code);

    const config =
      tenant.config && typeof tenant.config === 'object' && !Array.isArray(tenant.config)
        ? (tenant.config as Record<string, unknown>)
        : {};

    const slug = tenant.code.trim().toLowerCase();
    return {
      code: tenant.code,
      service_category_codes: serviceCategoryCodes,
      grievance_category_codes: grievanceCategoryCodes,
      tenant_admin_username: `${slug}-tenant-admin`,
      default_language:
        typeof config.default_language === 'string' ? config.default_language : 'bn',
      support_email:
        typeof config.support_email === 'string'
          ? config.support_email
          : `support@${slug}.example.gov.in`,
    };
  }

  async getTenantDetail(
    principal: AuthenticatedPrincipal,
    code: string,
  ): Promise<StateTenantDetail> {
    assertStateAdmin(principal);
    assertTenantCode(code);
    const tenant = await this.prisma.tenant.findUnique({
      where: { code },
      include: {
        tenantConfig: true,
        _count: {
          select: {
            services: true,
            citizens: true,
            applications: true,
            banners: true,
            userRoles: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [activeServices, openGrievances, payments, recentAuditLogs] = await Promise.all([
      this.prisma.tenantService.count({ where: { tenantId: tenant.id, isActive: true } }),
      this.prisma.grievance.count({
        where: { tenantId: tenant.id, NOT: { status: { in: ['resolved', 'closed'] } } },
      }),
      this.prisma.payment.count({ where: { tenantId: tenant.id } }),
      this.prisma.stateAuditLog.findMany({
        where: { targetTenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const base: StateTenantRow = {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      district: tenant.district,
      ward_count: tenant.wardCount,
      theme_color: tenant.themeColor,
      languages_enabled: tenant.languagesEnabled,
      is_active: tenant.isActive,
      services_total: tenant._count.services,
      citizens_total: tenant._count.citizens,
      applications_total: tenant._count.applications,
    };
    return {
      ...base,
      config: tenant.config,
      logo_url: tenant.logoUrl,
      active_services_total: activeServices,
      grievances_open: openGrievances,
      payments_total: payments,
      banners_active: tenant._count.banners,
      staff_assignments_total: tenant._count.userRoles,
      recent_audit_logs: recentAuditLogs.map(toAuditLogRow),
      warnings: tenantWarnings(base, {
        hasConfig: Boolean(tenant.tenantConfig),
        activeServices,
      }),
    };
  }

  async listGlobalServiceTemplates(
    principal: AuthenticatedPrincipal,
  ): Promise<StateGlobalServiceTemplateRow[]> {
    assertStateAdmin(principal);
    const rows = await this.prisma.globalService.findMany({
      include: { category: true, _count: { select: { tenantServices: true } } },
      orderBy: [{ lifecycleStatus: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toGlobalServiceTemplateRow);
  }

  async previewGlobalServiceTemplate(
    principal: AuthenticatedPrincipal,
    code: string,
  ): Promise<StateGlobalServicePreview> {
    assertStateAdmin(principal);
    assertTemplateCode(code);
    const row = await this.prisma.globalService.findUnique({
      where: { code },
      include: { tenantServices: true },
    });
    if (!row) {
      throw new NotFoundException('Global service template not found');
    }
    const overridden = row.tenantServices.filter((service) => {
      return service.overrideConfig && JSON.stringify(service.overrideConfig) !== '{}';
    }).length;
    return {
      code: row.code,
      lifecycle_status: row.lifecycleStatus,
      affected_tenants: row.tenantServices.length,
      tenant_overrides_preserved: overridden,
      warnings:
        row.lifecycleStatus === 'deprecated'
          ? ['Template is deprecated; publish creates a new review point for tenants.']
          : ['Publishing does not mutate tenant overrides automatically.'],
    };
  }

  async upsertGlobalServiceTemplate(
    principal: AuthenticatedPrincipal,
    dto: UpsertGlobalServiceTemplateDto,
  ): Promise<StateGlobalServiceTemplateRow> {
    assertStateAdmin(principal);
    assertTemplateCode(dto.code);
    assertTemplateCode(dto.category_code);
    assertLifecycleStatus(dto.lifecycle_status ?? 'draft');
    assertPositiveDays(dto.default_sla_days);
    const category = await this.prisma.serviceCategory.upsert({
      where: { code: dto.category_code },
      create: {
        code: dto.category_code,
        name: dto.name as Prisma.InputJsonValue,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
      },
      update: {},
    });
    const row = await this.prisma.globalService.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        categoryId: category.id,
        name: dto.name as Prisma.InputJsonValue,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
        workflowPattern: dto.workflow_pattern ?? 'single_window',
        defaultSlaDays: dto.default_sla_days ?? null,
        feeConfig: (dto.fee_config ?? {}) as Prisma.InputJsonValue,
        requiredDocuments: (dto.required_documents ?? []) as Prisma.InputJsonValue,
        formSchema: (dto.form_schema ?? {}) as Prisma.InputJsonValue,
        workflowConfig: (dto.workflow_config ?? {}) as Prisma.InputJsonValue,
        lifecycleStatus: dto.lifecycle_status ?? 'draft',
        isActive: (dto.lifecycle_status ?? 'draft') !== 'deprecated',
        curatorNotes: dto.curator_notes ?? null,
      },
      update: {
        categoryId: category.id,
        name: dto.name as Prisma.InputJsonValue,
        description: (dto.description ?? {}) as Prisma.InputJsonValue,
        workflowPattern: dto.workflow_pattern ?? 'single_window',
        defaultSlaDays: dto.default_sla_days ?? null,
        feeConfig: (dto.fee_config ?? {}) as Prisma.InputJsonValue,
        requiredDocuments: (dto.required_documents ?? []) as Prisma.InputJsonValue,
        formSchema: (dto.form_schema ?? {}) as Prisma.InputJsonValue,
        workflowConfig: (dto.workflow_config ?? {}) as Prisma.InputJsonValue,
        lifecycleStatus: dto.lifecycle_status ?? 'draft',
        isActive: (dto.lifecycle_status ?? 'draft') !== 'deprecated',
        curatorNotes: dto.curator_notes ?? null,
        libraryVersion: { increment: 1 },
      },
      include: { category: true, _count: { select: { tenantServices: true } } },
    });
    await this.audit(principal, 'global_library.upsert', null, dto.code, {
      lifecycle_status: row.lifecycleStatus,
      library_version: row.libraryVersion,
    });
    return toGlobalServiceTemplateRow(row);
  }

  async updateGlobalServiceLifecycle(
    principal: AuthenticatedPrincipal,
    dto: GlobalServiceLifecycleDto,
  ): Promise<StateGlobalServiceTemplateRow> {
    assertStateAdmin(principal);
    assertTemplateCode(dto.code);
    const lifecycle =
      dto.action === 'publish' ? 'published' : dto.action === 'deprecate' ? 'deprecated' : null;
    if (!lifecycle) {
      throw new BadRequestException('action must be publish or deprecate');
    }
    const row = await this.prisma.globalService.update({
      where: { code: dto.code },
      data: {
        lifecycleStatus: lifecycle,
        isActive: lifecycle === 'published',
        libraryVersion: { increment: 1 },
      },
      include: { category: true, _count: { select: { tenantServices: true } } },
    });
    await this.audit(principal, `global_library.${dto.action}`, null, dto.code, {
      library_version: row.libraryVersion,
    });
    return toGlobalServiceTemplateRow(row);
  }

  async listIntegrations(principal: AuthenticatedPrincipal): Promise<StateIntegrationRow[]> {
    assertStateAdmin(principal);
    await this.ensureDefaultIntegrations();
    const rows = await this.prisma.stateIntegration.findMany({ orderBy: { providerKey: 'asc' } });
    return rows.map(toIntegrationRow);
  }

  async upsertIntegration(
    principal: AuthenticatedPrincipal,
    dto: UpsertStateIntegrationDto,
  ): Promise<StateIntegrationRow> {
    assertStateAdmin(principal);
    assertProviderKey(dto.provider_key);
    assertIntegrationEnvironment(dto.environment);
    assertIntegrationStatus(dto.status);
    rejectSecretLikeValues(dto);
    const row = await this.prisma.stateIntegration.upsert({
      where: { providerKey: dto.provider_key },
      create: {
        providerKey: dto.provider_key,
        environment: dto.environment,
        status: dto.status,
        owner: dto.owner ?? null,
        notes: dto.notes ?? null,
        readiness: { required_docs: dto.required_docs ?? [] } as Prisma.InputJsonValue,
        updatedBySubject: principal.subject,
      },
      update: {
        environment: dto.environment,
        status: dto.status,
        owner: dto.owner ?? null,
        notes: dto.notes ?? null,
        readiness: { required_docs: dto.required_docs ?? [] } as Prisma.InputJsonValue,
        updatedBySubject: principal.subject,
      },
    });
    await this.audit(principal, 'integration_cockpit.update', null, dto.provider_key, {
      environment: row.environment,
      status: row.status,
    });
    return toIntegrationRow(row);
  }

  async checkIntegration(
    principal: AuthenticatedPrincipal,
    providerKey: string,
  ): Promise<StateIntegrationRow> {
    assertStateAdmin(principal);
    assertProviderKey(providerKey);
    const row = await this.prisma.stateIntegration.upsert({
      where: { providerKey },
      create: {
        providerKey,
        status: 'manual_check_required',
        readiness: integrationReadiness(providerKey) as Prisma.InputJsonValue,
        lastCheckedAt: new Date(),
        updatedBySubject: principal.subject,
      },
      update: {
        readiness: integrationReadiness(providerKey) as Prisma.InputJsonValue,
        lastCheckedAt: new Date(),
        updatedBySubject: principal.subject,
      },
    });
    await this.audit(principal, 'integration_cockpit.check', null, providerKey, {
      status: row.status,
    });
    return toIntegrationRow(row);
  }

  async exportIntegrationsCsv(principal: AuthenticatedPrincipal): Promise<string> {
    assertStateAdmin(principal);
    const rows = await this.listIntegrations(principal);
    return toCsv(
      ['provider_key', 'environment', 'status', 'owner', 'last_checked_at', 'notes'],
      rows.map((row) => [
        row.provider_key,
        row.environment,
        row.status,
        row.owner ?? '',
        row.last_checked_at ?? '',
        row.notes ?? '',
      ]),
    );
  }

  async getAuditCoverage(principal: AuthenticatedPrincipal): Promise<AuditCoverageMatrix> {
    assertStateAdmin(principal);
    const required = requiredAuditActions();
    const rows = await this.prisma.stateAuditLog.findMany({
      where: { action: { in: required } },
      select: { action: true },
      distinct: ['action'],
    });
    const covered = rows.map((row) => row.action);
    return {
      covered_actions: covered,
      required_actions: required,
      missing_actions: required.filter((action) => !covered.includes(action)),
    };
  }

  private async analyticsTotals(window: {
    from: Date;
    to: Date;
  }): Promise<StateAnalyticsV2['totals']> {
    const [applications, grievances, payments, paymentSum, breached] = await Promise.all([
      this.prisma.application.count({
        where: { submittedAt: { gte: window.from, lte: window.to } },
      }),
      this.prisma.grievance.count({
        where: { createdAt: { gte: window.from, lte: window.to } },
      }),
      this.prisma.payment.count({
        where: { status: 'settled', settledAt: { gte: window.from, lte: window.to } },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'settled', settledAt: { gte: window.from, lte: window.to } },
        _sum: { amountPaise: true },
      }),
      this.prisma.grievance.count({
        where: { slaBreachedAt: { gte: window.from, lte: window.to } },
      }),
    ]);
    return {
      applications,
      grievances,
      payments_settled: payments,
      payment_amount_paise: paymentSum._sum.amountPaise ?? 0,
      sla_breached_grievances: breached,
    };
  }

  private async adoptPublishedServicesByCategories(
    tenantId: string,
    categoryCodes: string[],
  ): Promise<void> {
    const normalized = Array.from(new Set(categoryCodes.map((code) => code.trim().toLowerCase())));
    const categories = await this.prisma.serviceCategory.findMany({
      where: { code: { in: normalized }, isActive: true },
    });
    const categoryIds = categories.map((row) => row.id);
    if (!categoryIds.length) {
      return;
    }

    const globals = await this.prisma.globalService.findMany({
      where: {
        lifecycleStatus: 'published',
        isActive: true,
        categoryId: { in: categoryIds },
      },
      include: { category: true },
    });

    for (const global of globals) {
      const revenueHeadId = global.revenueHeadId;
      const tenantService = await this.prisma.tenantService.upsert({
        where: { tenantId_code: { tenantId, code: global.code } },
        create: {
          tenantId,
          code: global.code,
          globalServiceId: global.id,
          categoryId: global.categoryId,
          revenueHeadId,
          name: global.name as Prisma.InputJsonValue,
          description: global.description as Prisma.InputJsonValue,
          isActive: true,
          effectiveFeeConfig: global.feeConfig as Prisma.InputJsonValue,
          effectiveSlaDays: global.defaultSlaDays,
          requiredDocuments: global.requiredDocuments as Prisma.InputJsonValue,
        },
        update: { isActive: true, globalServiceId: global.id },
      });
      await this.ensurePublishedOnboardingForm(tenantId, tenantService.id, global.formSchema);
    }
  }

  private async ensurePublishedOnboardingForm(
    tenantId: string,
    serviceId: string,
    globalFormSchema: Prisma.JsonValue,
  ): Promise<void> {
    const existing = await this.prisma.serviceFormVersion.findFirst({
      where: { tenantId, serviceId, status: 'published' },
    });
    if (existing) {
      return;
    }

    const schema =
      globalFormSchema &&
      typeof globalFormSchema === 'object' &&
      !Array.isArray(globalFormSchema) &&
      Object.keys(globalFormSchema as object).length > 0
        ? globalFormSchema
        : ONBOARDING_STUB_FORM_SCHEMA;

    const latest = await this.prisma.serviceFormVersion.aggregate({
      where: { tenantId, serviceId },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;

    await this.prisma.serviceFormVersion.create({
      data: {
        tenantId,
        serviceId,
        version,
        formSchema: schema as Prisma.InputJsonValue,
        uiSchema: {} as Prisma.InputJsonValue,
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }

  private async triggerTenantRagIndex(tenantCode: string): Promise<void> {
    const base = process.env.RAG_INDEXER_URL?.replace(/\/$/, '');
    if (!base) {
      return;
    }
    try {
      const response = await fetch(`${base}/index/tenant/${encodeURIComponent(tenantCode)}`, {
        method: 'POST',
      });
      if (!response.ok) {
        this.logger.warn(`RAG index for ${tenantCode} returned HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `RAG index for ${tenantCode} failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async inheritDefaultServices(tenantId: string): Promise<void> {
    const [categories, revenueHeads, globals] = await Promise.all([
      this.prisma.serviceCategory.findMany(),
      this.prisma.revenueHead.findMany(),
      this.prisma.globalService.findMany(),
    ]);
    const categoryByCode = new Map(categories.map((row) => [row.code, row.id]));
    const revenueByCode = new Map(revenueHeads.map((row) => [row.code, row.id]));
    const globalByCode = new Map(globals.map((row) => [row.code, row]));
    for (const seed of globalServices.slice(0, 10)) {
      const categoryId = categoryByCode.get(seed.category_code);
      if (!categoryId) continue;
      const global = globalByCode.get(seed.code);
      await this.prisma.tenantService.upsert({
        where: { tenantId_code: { tenantId, code: seed.code } },
        create: {
          tenantId,
          code: seed.code,
          globalServiceId: global?.id ?? null,
          categoryId,
          revenueHeadId: seed.revenue_head_code ? revenueByCode.get(seed.revenue_head_code) : null,
          name: seed.name as Prisma.InputJsonValue,
          description: seed.description as Prisma.InputJsonValue,
          isActive: true,
          effectiveFeeConfig: seed.fee_config as Prisma.InputJsonValue,
          effectiveSlaDays: seed.default_sla_days,
          requiredDocuments: seed.required_documents as Prisma.InputJsonValue,
        },
        update: { isActive: true },
      });
    }
  }

  private async ensureDefaultIntegrations(): Promise<void> {
    for (const providerKey of [
      'digilocker',
      'psp',
      'sms-dlt',
      'email',
      'whatsapp',
      'object-storage',
      'rag-indexer',
    ]) {
      await this.prisma.stateIntegration.upsert({
        where: { providerKey },
        create: {
          providerKey,
          environment: 'sandbox',
          status: 'not_configured',
          readiness: integrationReadiness(providerKey) as Prisma.InputJsonValue,
        },
        update: {},
      });
    }
  }

  private async audit(
    principal: AuthenticatedPrincipal,
    action: string,
    targetTenantId: string | null,
    targetCode: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.stateAuditLog.create({
      data: {
        actorSubject: principal.subject,
        actorRole: 'state_admin',
        action,
        targetTenantId,
        targetCode,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function toAuditLogRow(row: {
  id: string;
  action: string;
  actorSubject: string;
  actorRole: string;
  targetCode: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): StateAuditLogRow {
  return {
    id: row.id,
    action: row.action,
    actorSubject: row.actorSubject,
    actorRole: row.actorRole,
    targetCode: row.targetCode,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function toGlobalServiceTemplateRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  workflowPattern: string;
  defaultSlaDays: number | null;
  feeConfig: Prisma.JsonValue;
  requiredDocuments: Prisma.JsonValue;
  lifecycleStatus: string;
  libraryVersion: number;
  curatorNotes: string | null;
  updatedAt: Date;
  category: { code: string };
  _count: { tenantServices: number };
}): StateGlobalServiceTemplateRow {
  return {
    id: row.id,
    code: row.code,
    category_code: row.category.code,
    name: row.name,
    description: row.description,
    workflow_pattern: row.workflowPattern,
    default_sla_days: row.defaultSlaDays,
    fee_config: row.feeConfig,
    required_documents: row.requiredDocuments,
    lifecycle_status: row.lifecycleStatus,
    library_version: row.libraryVersion,
    tenant_adoptions: row._count.tenantServices,
    curator_notes: row.curatorNotes,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toIntegrationRow(row: {
  providerKey: string;
  environment: string;
  status: string;
  owner: string | null;
  notes: string | null;
  readiness: Prisma.JsonValue;
  lastCheckedAt: Date | null;
  updatedAt: Date;
}): StateIntegrationRow {
  return {
    provider_key: row.providerKey,
    environment: row.environment,
    status: row.status,
    owner: row.owner,
    notes: row.notes,
    readiness: row.readiness,
    last_checked_at: row.lastCheckedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
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

function auditWhere(query: StateAuditLogQuery): Prisma.StateAuditLogWhereInput {
  const from = parseOptionalDate(query.from, 'from');
  const to = parseOptionalDate(query.to, 'to');
  return {
    ...(query.actor ? { actorSubject: { contains: query.actor, mode: 'insensitive' } } : {}),
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
    ...(query.tenant_code
      ? { targetCode: { equals: query.tenant_code.toUpperCase(), mode: 'insensitive' } }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
}

function analyticsWindow(query: { from?: string; to?: string }): { from: Date; to: Date } {
  const to = parseOptionalDate(query.to, 'to') ?? new Date();
  const from =
    parseOptionalDate(query.from, 'from') ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to) {
    throw new BadRequestException('from must be before to');
  }
  if (to.getTime() - from.getTime() > 180 * 24 * 60 * 60 * 1000) {
    throw new BadRequestException('analytics v2 range cannot exceed 180 days');
  }
  return { from, to };
}

function previousWindow(window: { from: Date; to: Date }): { from: Date; to: Date } {
  const duration = window.to.getTime() - window.from.getTime();
  return {
    from: new Date(window.from.getTime() - duration),
    to: new Date(window.from.getTime()),
  };
}

function analyticsHints(
  current: StateAnalyticsV2['totals'],
  prior: StateAnalyticsV2['totals'],
  tenantSlices: StateAnalyticsV2['tenant_slices'],
): string[] {
  const hints: string[] = [];
  if (prior.applications > 0 && current.applications > prior.applications * 1.5) {
    hints.push('Applications are more than 50% above the previous equivalent window');
  }
  if (
    prior.sla_breached_grievances > 0 &&
    current.sla_breached_grievances > prior.sla_breached_grievances * 1.25
  ) {
    hints.push('SLA-breached grievances are trending above the previous window');
  }
  const highLoadTenant = tenantSlices[0];
  if (highLoadTenant && highLoadTenant.applications + highLoadTenant.grievances > 50) {
    hints.push(`${highLoadTenant.tenant_code} is the highest workload tenant in this window`);
  }
  return hints;
}

function clampLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
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

function tenantWarnings(
  tenant: StateTenantRow,
  facts: { hasConfig: boolean; activeServices: number },
): string[] {
  const warnings: string[] = [];
  if (!tenant.is_active) {
    warnings.push('Tenant is inactive');
  }
  if (!facts.hasConfig) {
    warnings.push('Tenant config row is missing');
  }
  if (tenant.languages_enabled.length === 0) {
    warnings.push('No enabled languages configured');
  }
  if (tenant.services_total === 0) {
    warnings.push('No services inherited or configured');
  }
  if (facts.activeServices === 0) {
    warnings.push('No active services available to citizens');
  }
  if (!tenant.theme_color) {
    warnings.push('Theme color is missing');
  }
  return warnings;
}

function assertWizardOnboarding(dto: UpsertTenantDto): void {
  if ((dto.status ?? 'active') !== 'active') {
    return;
  }
  const errors: string[] = [];
  if (!dto.name?.trim()) errors.push('name');
  if (!dto.district?.trim()) errors.push('district');
  if (!dto.ward_count || dto.ward_count < 1) errors.push('ward_count');
  const config = dto.config ?? {};
  if (config.onboarding_source !== 'state_wizard') {
    errors.push('config.onboarding_source=state_wizard');
  }
  if (config.wizard_completed !== true) {
    errors.push('config.wizard_completed=true');
  }
  if (errors.length) {
    throw new BadRequestException(
      `wizard onboarding required before active tenant: ${errors.join(', ')}`,
    );
  }
}

function assertTemplateCode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{1,79}$/i.test(value)) {
    throw new BadRequestException(
      'code must be 2-80 chars and use letters, numbers, dash, underscore',
    );
  }
}

function assertLifecycleStatus(value: unknown): asserts value is string {
  if (!['draft', 'published', 'deprecated'].includes(String(value))) {
    throw new BadRequestException('lifecycle_status must be draft, published, or deprecated');
  }
}

function assertPositiveDays(value: unknown): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 365)
  ) {
    throw new BadRequestException('default_sla_days must be an integer between 1 and 365');
  }
}

function assertProviderKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(value)) {
    throw new BadRequestException('provider_key must use lowercase provider-key format');
  }
}

function assertIntegrationEnvironment(value: unknown): asserts value is string {
  if (!['sandbox', 'pilot', 'production'].includes(String(value))) {
    throw new BadRequestException('environment must be sandbox, pilot, or production');
  }
}

function assertIntegrationStatus(value: unknown): asserts value is string {
  if (!['not_configured', 'manual_check_required', 'ready', 'blocked'].includes(String(value))) {
    throw new BadRequestException(
      'status must be not_configured, manual_check_required, ready, or blocked',
    );
  }
}

function rejectSecretLikeValues(dto: UpsertStateIntegrationDto): void {
  const serialized = JSON.stringify(dto).toLowerCase();
  for (const marker of ['secret', 'password', 'private_key', 'client_secret', 'token=']) {
    if (serialized.includes(marker)) {
      throw new BadRequestException(
        'integration cockpit accepts metadata only; remove secret-like values',
      );
    }
  }
}

function integrationReadiness(providerKey: string): Record<string, unknown> {
  const localChecks: Record<string, string> = {
    psp: 'local payment stub reachable through application payment flows',
    'object-storage': 'storage metadata contract present; external bucket check is manual',
    'rag-indexer': 'KB index queue metadata present; worker readiness is manual',
  };
  return {
    mode: localChecks[providerKey] ? 'local_stub' : 'manual_check_required',
    summary: localChecks[providerKey] ?? 'No safe local health endpoint configured in Sprint 6.12',
    checked_without_secrets: true,
  };
}

function requiredAuditActions(): string[] {
  return [
    'tenant.upsert',
    'impersonation.create',
    'global_library.upsert',
    'global_library.publish',
    'global_library.deprecate',
    'integration_cockpit.update',
    'integration_cockpit.check',
    'staff_invite.create',
    'staff_invite.retry',
    'staff_invite.disable',
    'staff.role_map',
  ];
}
