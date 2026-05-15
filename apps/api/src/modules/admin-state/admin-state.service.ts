import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
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

export type StateAnalytics = {
  tenants_total: number;
  tenants_active: number;
  services_total: number;
  citizens_total: number;
  applications_open: number;
  grievances_open: number;
  payments_settled_last_30_days: number;
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

  async listAuditLogs(principal: AuthenticatedPrincipal) {
    assertStateAdmin(principal);
    return this.prisma.stateAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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
