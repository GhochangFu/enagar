import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { Prisma } from '../../generated/prisma';

export interface TenantConfigView {
  tenantId: string;
  lateFeePaise: number;
}

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<TenantConfigView> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, lateFeePaise: true },
    });
    if (!t) throw new BadRequestException('Tenant not found');
    return { tenantId: t.id, lateFeePaise: t.lateFeePaise ?? 0 };
  }

  async updateLateFee(
    tenantId: string,
    actorSubject: string,
    actorRole: string,
    targetCode: string,
    lateFeePaise: number,
  ) {
    if (!Number.isInteger(lateFeePaise) || lateFeePaise < 0) {
      throw new BadRequestException('lateFeePaise must be a non-negative integer');
    }
    const before = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, lateFeePaise: true },
    });
    if (!before) throw new BadRequestException('Tenant not found');
    // The update and the audit row must commit atomically: if the audit insert
    // fails after the update succeeds, the late-fee would be mutated with no
    // trail. Matches the auditTenantMutation pattern in admin-tenant.service.ts.
    const [after] = await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { lateFeePaise },
        select: { id: true, lateFeePaise: true },
      }),
      this.prisma.stateAuditLog.create({
        data: {
          actorSubject,
          actorRole,
          action: 'TENANT_LATE_FEE_UPDATED',
          targetTenantId: tenantId,
          targetCode,
          metadata: {
            entityType: 'Tenant',
            entityId: tenantId,
            oldValue: before.lateFeePaise ?? 0,
            newValue: lateFeePaise,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
    return { tenantId: after.id, lateFeePaise: after.lateFeePaise ?? 0 };
  }
}
