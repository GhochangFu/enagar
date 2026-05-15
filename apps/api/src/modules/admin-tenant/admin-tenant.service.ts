import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

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

export type TenantAdminServiceRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  is_active: boolean;
  effective_sla_days: number | null;
  updated_at: string;
};

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
}
