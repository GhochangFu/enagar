import {
  pendingActorFromWorkflowStage,
  type WorkflowDefinition,
  type WorkflowEffect,
  type WorkflowStageKind,
} from '@enagar/workflow';

export { pendingActorFromWorkflowStage };
import type { Prisma } from '../../generated/prisma';

export type WorkflowStageRow = {
  code: string;
  label: Prisma.JsonValue;
  ownerRole: string;
  ownerDesignation: string | null;
  stageKind: string | null;
  allowedVerbs: Prisma.JsonValue | null;
  slaHours: number | null;
  isInitial: boolean;
  isTerminal: boolean;
  sortOrder: number;
};

export type WorkflowTransitionRow = {
  verb: string;
  actorRole: string;
  actorDesignation: string | null;
  guard: Prisma.JsonValue | null;
  requiresComment: boolean;
  sideEffects: Prisma.JsonValue;
  fromStage: { code: string };
  toStage: { code: string };
};

export function mapWorkflowStageToDefinition(stage: WorkflowStageRow) {
  return {
    code: stage.code,
    label: stage.label as { en: string; bn: string; hi: string },
    owner_role: stage.ownerRole,
    ...(stage.ownerDesignation ? { owner_designation: stage.ownerDesignation } : {}),
    ...(isWorkflowStageKind(stage.stageKind) ? { stage_kind: stage.stageKind } : {}),
    ...(coerceStringArray(stage.allowedVerbs)
      ? { allowed_verbs: coerceStringArray(stage.allowedVerbs) }
      : {}),
    sla_hours: stage.slaHours ?? undefined,
    initial: stage.isInitial,
    terminal: stage.isTerminal,
  };
}

export function mapWorkflowTransitionToDefinition(transition: WorkflowTransitionRow) {
  return {
    from: transition.fromStage.code,
    to: transition.toStage.code,
    verb: transition.verb,
    actor_role: transition.actorRole,
    ...(transition.actorDesignation ? { actor_designation: transition.actorDesignation } : {}),
    ...(isRecord(transition.guard)
      ? { guard: transition.guard as unknown as Record<string, unknown> }
      : {}),
    requires_comment: transition.requiresComment,
    effects: transition.sideEffects as unknown as WorkflowEffect[],
  };
}

export function workflowDefinitionFromRows(
  code: string,
  version: number,
  stages: WorkflowStageRow[],
  transitions: WorkflowTransitionRow[],
): WorkflowDefinition {
  return {
    code,
    version,
    stages: stages
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((stage) => mapWorkflowStageToDefinition(stage)),
    transitions: transitions.map((transition) => mapWorkflowTransitionToDefinition(transition)),
  };
}

export function pendingActorFromStage(stage: {
  ownerDesignation: string | null;
  ownerRole: string;
}): { pending_designation: string | null; pending_role: string | null } {
  if (stage.ownerDesignation) {
    return { pending_designation: stage.ownerDesignation, pending_role: null };
  }
  return { pending_designation: null, pending_role: stage.ownerRole };
}

export function workflowStageCreateInput(
  tenantId: string,
  workflowId: string,
  stage: {
    code: string;
    label: { en: string; bn: string; hi: string };
    owner_role: string;
    owner_designation?: string;
    stage_kind?: WorkflowStageKind;
    allowed_verbs?: string[];
    sla_hours?: number;
    initial?: boolean;
    terminal?: boolean;
  },
  sortOrder: number,
) {
  return {
    tenantId,
    workflowId,
    code: stage.code,
    label: stage.label as unknown as Prisma.InputJsonValue,
    ownerRole: stage.owner_role,
    ownerDesignation: stage.owner_designation ?? null,
    stageKind: stage.stage_kind ?? null,
    allowedVerbs: stage.allowed_verbs?.length
      ? (stage.allowed_verbs as Prisma.InputJsonValue)
      : undefined,
    slaHours: stage.sla_hours,
    isInitial: stage.initial === true,
    isTerminal: stage.terminal === true,
    sortOrder,
  };
}

export function workflowTransitionCreateInput(
  tenantId: string,
  workflowId: string,
  fromStageId: string,
  toStageId: string,
  transition: {
    verb: string;
    actor_role: string;
    actor_designation?: string;
    guard?: Record<string, unknown>;
    requires_comment?: boolean;
    effects?: WorkflowEffect[];
  },
) {
  return {
    tenantId,
    workflowId,
    fromStageId,
    toStageId,
    verb: transition.verb,
    actorRole: transition.actor_role,
    actorDesignation: transition.actor_designation ?? null,
    guard: transition.guard ? (transition.guard as Prisma.InputJsonValue) : undefined,
    requiresComment: transition.requires_comment === true,
    sideEffects: (transition.effects ?? []) as unknown as Prisma.InputJsonValue,
  };
}

function isWorkflowStageKind(value: string | null): value is WorkflowStageKind {
  return (
    value === 'maker' ||
    value === 'checker' ||
    value === 'approver' ||
    value === 'dept_head' ||
    value === 'municipality' ||
    value === 'post_approval' ||
    value === 'citizen' ||
    value === 'system'
  );
}

function coerceStringArray(value: Prisma.JsonValue | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const verbs = value.filter(
    (item): item is string => typeof item === 'string' && Boolean(item.trim()),
  );
  return verbs.length ? verbs : undefined;
}

function isRecord(value: Prisma.JsonValue | null | undefined): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
