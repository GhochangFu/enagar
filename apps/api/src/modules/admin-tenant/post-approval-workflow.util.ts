import { randomUUID } from 'node:crypto';

import {
  evaluateTransition,
  pendingActorFromWorkflowStage,
  POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
  type WorkflowDefinition,
} from '@enagar/workflow';

import { workflowDefinitionFromRows } from '../services/workflow-designation.mapper';

import type { PrismaService } from '../../common/database/prisma.service';
import type { Prisma } from '../../generated/prisma';
import type { PostApprovalExecutionService } from '../work-orders/post-approval-execution.service';

const publishedWorkflowInclude = {
  stages: { orderBy: { sortOrder: 'asc' as const } },
  transitions: {
    include: {
      fromStage: true,
      toStage: true,
    },
  },
} as const;

function toSnapshot(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function loadPublishedWorkflow(
  prisma: PrismaService,
  serviceId: string,
): Promise<WorkflowDefinition | null> {
  const row = await prisma.workflow.findFirst({
    where: { serviceId, status: 'published' },
    orderBy: { version: 'desc' },
    include: publishedWorkflowInclude,
  });
  if (!row) {
    return null;
  }
  return workflowDefinitionFromRows(row.code, row.version, row.stages, row.transitions);
}

type ApplicationRow = {
  id: string;
  tenantId: string;
  serviceId: string | null;
  status: string;
  paymentStatus: string;
  runtimeSnapshot: Prisma.JsonValue;
  workflowId: string | null;
};

async function loadApplicationRow(
  prisma: PrismaService,
  tenantId: string,
  applicationId: string,
): Promise<ApplicationRow | null> {
  return prisma.application.findFirst({
    where: { id: applicationId, tenantId },
    select: {
      id: true,
      tenantId: true,
      serviceId: true,
      status: true,
      paymentStatus: true,
      runtimeSnapshot: true,
      workflowId: true,
    },
  });
}

async function applySystemTransition(
  prisma: PrismaService,
  execution: PostApprovalExecutionService | undefined,
  row: ApplicationRow,
  verb: string,
): Promise<boolean> {
  if (!row.serviceId) {
    return false;
  }

  const snapshot = toSnapshot(row.runtimeSnapshot);
  const currentStage =
    typeof snapshot.current_stage === 'string' ? snapshot.current_stage : row.status;

  const workflow = await loadPublishedWorkflow(prisma, row.serviceId);
  if (!workflow) {
    return false;
  }

  const paymentStatus =
    typeof snapshot.payment_status === 'string' ? snapshot.payment_status : row.paymentStatus;

  const evaluated = evaluateTransition({
    workflow,
    current_stage: currentStage,
    verb,
    actor_roles: ['system'],
    runtime_snapshot: { ...snapshot, payment_status: paymentStatus },
  });
  if (!evaluated.ok) {
    return false;
  }

  const now = new Date();
  const pendingActor = pendingActorFromWorkflowStage(evaluated.to);
  const timeline = Array.isArray(snapshot.timeline) ? snapshot.timeline : [];
  const nextSnapshot = {
    ...snapshot,
    current_stage: evaluated.to.code,
    status: evaluated.to.terminal ? 'closed' : evaluated.to.code,
    status_label: evaluated.to.label.en,
    pending_role: pendingActor.pending_role,
    pending_designation: pendingActor.pending_designation,
    payment_status: paymentStatus,
    timeline: [
      ...timeline,
      {
        id: randomUUID(),
        from_stage: evaluated.from.code,
        to_stage: evaluated.to.code,
        verb: evaluated.transition.verb,
        actor_role: evaluated.transition.actor_role,
        actor_designation: evaluated.transition.actor_designation ?? null,
        comment: null,
        created_at: now.toISOString(),
      },
    ],
  };

  const publishedWorkflow = await prisma.workflow.findFirst({
    where: { serviceId: row.serviceId, status: 'published' },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      stages: { where: { code: evaluated.to.code }, select: { id: true }, take: 1 },
    },
  });
  const nextStage = publishedWorkflow?.stages[0] ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: row.id },
      data: {
        workflowId: publishedWorkflow?.id ?? row.workflowId ?? undefined,
        currentStageId: nextStage?.id ?? null,
        status: nextSnapshot.status as string,
        statusLabel: { en: nextSnapshot.status_label as string },
        pendingRole: pendingActor.pending_role,
        pendingDesignation: pendingActor.pending_designation,
        paymentStatus: paymentStatus,
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
        actorSubject: 'system',
        actorRole: 'system',
        actorDesignation: null,
        comment: null,
        metadata: { effects: evaluated.effects, auto: verb } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  if (execution) {
    await execution.handleTransitionEffects(
      prisma,
      row.tenantId,
      row.id,
      evaluated.effects,
      evaluated.to.code,
    );
    await execution.syncWorkOrderStatusForStage(row.tenantId, row.id, evaluated.to.code);
  }

  return true;
}

/**
 * After citizen payment settles, advance `payment-pending` → `payment-received` when the
 * published workflow defines the Phase 11 system transition (guard `payment_paid`).
 */
export async function tryAdvancePostApprovalOnPaymentPaid(
  prisma: PrismaService,
  tenantId: string,
  applicationId: string,
  execution?: PostApprovalExecutionService,
): Promise<boolean> {
  const row = await loadApplicationRow(prisma, tenantId, applicationId);
  if (!row) {
    return false;
  }

  const snapshot = toSnapshot(row.runtimeSnapshot);
  const currentStage =
    typeof snapshot.current_stage === 'string' ? snapshot.current_stage : row.status;
  if (currentStage !== 'payment-pending') {
    return false;
  }

  const paymentStatus =
    typeof snapshot.payment_status === 'string' ? snapshot.payment_status : row.paymentStatus;
  if (paymentStatus !== 'paid' && paymentStatus !== 'not_required') {
    return false;
  }

  const advanced = await applySystemTransition(
    prisma,
    execution,
    row,
    POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
  );
  if (!advanced) {
    return false;
  }

  const refreshed = await loadApplicationRow(prisma, tenantId, applicationId);
  if (!refreshed) {
    return true;
  }

  const refreshedSnapshot = toSnapshot(refreshed.runtimeSnapshot);
  const stageAfter =
    typeof refreshedSnapshot.current_stage === 'string'
      ? refreshedSnapshot.current_stage
      : refreshed.status;
  if (stageAfter === 'payment-received') {
    await applySystemTransition(prisma, execution, refreshed, 'forward');
  }

  return true;
}
