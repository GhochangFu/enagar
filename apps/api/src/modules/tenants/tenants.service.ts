import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  CITIZEN_PORTAL_TENANT_CODE,
  tenantSeeds,
  type TenantConfigResponse,
  type TenantSummary,
} from './tenant.seed';

import type { Prisma } from '../../generated/prisma';

export type TenantPublicBanner = {
  code: string;
  severity: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma?: PrismaService) {}

  /** Active ULBs for pickers / workspace; excludes the statewide citizen portal tenant. */
  list(): TenantSummary[] {
    return tenantSeeds.filter(
      (tenant) => tenant.is_active && tenant.code !== CITIZEN_PORTAL_TENANT_CODE,
    );
  }

  getConfig(idOrCode: string): TenantConfigResponse {
    const tenant = tenantSeeds.find(
      (candidate) =>
        candidate.id === idOrCode || candidate.code.toLowerCase() === idOrCode.toLowerCase(),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      ...tenant,
      config: {
        default_language: 'en',
        service_summary: {
          total_services: 76,
          categories: 14,
        },
        feature_flags: {
          digilocker_enabled: false,
          tenant_switcher_enabled: true,
        },
      },
    };
  }

  async listActiveBanners(idOrCode: string): Promise<TenantPublicBanner[]> {
    if (!this.prisma) {
      this.getConfig(idOrCode);
      return [];
    }

    const now = new Date();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrCode);
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: idOrCode }] : []),
          { code: { equals: idOrCode, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const rows = await this.prisma.tenantBanner.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ severity: 'desc' }, { updatedAt: 'desc' }],
    });

    return rows.map((row) => ({
      code: row.code,
      severity: row.severity,
      title: row.title,
      body: row.body,
      link_url: row.linkUrl,
      starts_at: row.startsAt?.toISOString() ?? null,
      ends_at: row.endsAt?.toISOString() ?? null,
    }));
  }
}
