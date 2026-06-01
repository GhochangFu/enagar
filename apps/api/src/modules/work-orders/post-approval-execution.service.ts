import { Injectable } from '@nestjs/common';

import { WorkOrdersService } from '../work-orders/work-orders.service';

import type { PrismaService } from '../../common/database/prisma.service';
import type { WorkflowEffect } from '@enagar/workflow';

/** Side effects for post-approval execution (Phase 12 / ADR-0012). */
@Injectable()
export class PostApprovalExecutionService {
  constructor(private readonly workOrders: WorkOrdersService) {}

  async handleTransitionEffects(
    prisma: PrismaService,
    tenantId: string,
    applicationId: string,
    effects: WorkflowEffect[],
    toStageCode: string,
  ): Promise<void> {
    if (!effects.some((effect) => effect.type === 'create_work_order')) {
      return;
    }
    if (toStageCode !== 'work-order-issued') {
      return;
    }

    const application = await prisma.application.findFirst({
      where: { id: applicationId, tenantId },
      select: {
        id: true,
        tenant: { select: { code: true } },
      },
    });
    if (!application) {
      return;
    }

    await this.workOrders.createForApplication(tenantId, application.tenant.code, applicationId);
  }

  async syncWorkOrderStatusForStage(
    tenantId: string,
    applicationId: string,
    stageCode: string,
  ): Promise<void> {
    if (stageCode === 'work-in-progress') {
      await this.workOrders.markInProgress(tenantId, applicationId);
    }
    if (stageCode === 'work-completed') {
      await this.workOrders.markCompleted(tenantId, applicationId);
    }
  }
}
