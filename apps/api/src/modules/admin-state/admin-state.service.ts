import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SignJWT } from 'jose';

import { PrismaService } from '../../common/database/prisma.service';
import { globalServices } from '../services/service-catalogue.seed';

import {
  assertHexColor,
  assertImpersonationReason,
  assertLanguages,
  assertOnboardingStatus,
  assertStateAdmin,
  assertTenantCode,
} from './admin-state.contracts';

import type { CreateImpersonationTokenDto, UpsertTenantDto } from './dto/state-admin.dto';
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

@Injectable()
export class AdminStateService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.inherit_default_services !== false) {
      await this.inheritDefaultServices(tenant.id);
    }
    await this.audit(principal, 'tenant.upsert', tenant.id, tenant.code, {
      inherit_default_services: dto.inherit_default_services !== false,
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
