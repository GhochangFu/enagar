import type {
  WorkflowDefinition,
  WorkflowRole,
  WorkflowStage,
  WorkflowTransition,
} from '@enagar/workflow';

export type WorkflowInsertPosition =
  | { kind: 'before'; stageCode: string }
  | { kind: 'after'; stageCode: string };

const ROLE_ALIASES: Record<string, WorkflowRole> = {
  tenant_admin: 'tenant_admin',
  tenant_clerk: 'tenant_clerk',
  admin: 'tenant_admin',
  clerk: 'tenant_clerk',
  citizen: 'citizen',
};

const SKIP_REDIRECT_VERBS = new Set(['reject', 'cancel', 'withdraw', 'return']);

function slugifyStageCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function completeLabel(en: string): WorkflowStage['label'] {
  const text = en.trim() || 'Stage';
  return { en: text, bn: text, hi: text };
}

export function resolveStageReference(
  workflow: WorkflowDefinition,
  reference: string,
): string | undefined {
  const needle = reference.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  for (const stage of workflow.stages) {
    if (stage.code.toLowerCase() === needle || slugifyStageCode(reference) === stage.code) {
      return stage.code;
    }
    const label = stage.label?.en?.trim().toLowerCase();
    if (label === needle || label?.includes(needle) || needle.includes(label ?? '')) {
      return stage.code;
    }
  }
  return undefined;
}

function resolveOwnerRole(record: Record<string, unknown>): WorkflowRole {
  const raw = String(
    record.owner_role ??
      record.ownerRole ??
      record.stage_type ??
      record.stageType ??
      'tenant_clerk',
  )
    .trim()
    .toLowerCase();
  return ROLE_ALIASES[raw] ?? (raw as WorkflowRole);
}

function normalizeStageRecord(raw: Record<string, unknown>): WorkflowStage | null {
  const labelRaw = raw.label ?? raw.stage_name ?? raw.stageName ?? raw.name;
  const labelEn =
    typeof labelRaw === 'string'
      ? labelRaw.trim()
      : labelRaw && typeof labelRaw === 'object' && !Array.isArray(labelRaw)
        ? String((labelRaw as { en?: string }).en ?? '').trim()
        : '';
  const codeRaw = String(raw.stage_code ?? raw.stageCode ?? raw.code ?? '').trim();
  const code = slugifyStageCode(codeRaw || labelEn);
  if (!code) {
    return null;
  }
  return {
    code,
    label: completeLabel(labelEn || code),
    owner_role: resolveOwnerRole(raw),
    stage_kind:
      typeof raw.stage_kind === 'string'
        ? (raw.stage_kind as WorkflowStage['stage_kind'])
        : undefined,
    initial: raw.initial === true,
    terminal: raw.terminal === true,
  };
}

function resolveInsertPosition(
  args: Record<string, unknown>,
  base: WorkflowDefinition,
  stage: WorkflowStage,
): WorkflowInsertPosition {
  const beforeRef =
    args.insert_before ?? args.insertBefore ?? args.before_stage ?? args.beforeStage;
  if (typeof beforeRef === 'string') {
    const code = resolveStageReference(base, beforeRef);
    if (code) {
      return { kind: 'before', stageCode: code };
    }
  }

  const afterRef =
    args.insert_after ??
    args.insertAfter ??
    args.after_stage ??
    args.afterStage ??
    args.reference_stage ??
    args.referenceStage;
  if (typeof afterRef === 'string') {
    const code = resolveStageReference(base, afterRef);
    if (code) {
      return { kind: 'after', stageCode: code };
    }
  }

  if (stage.owner_role === 'tenant_admin') {
    const approved = resolveStageReference(base, 'approved');
    if (approved) {
      return { kind: 'before', stageCode: approved };
    }
  }

  const nonTerminal = base.stages.filter((item) => !item.terminal);
  const anchor = nonTerminal[nonTerminal.length - 1] ?? base.stages[0];
  return { kind: 'after', stageCode: anchor.code };
}

export function insertWorkflowStage(
  base: WorkflowDefinition,
  newStage: WorkflowStage,
  position: WorkflowInsertPosition,
): WorkflowDefinition {
  const stageByCode = new Map(base.stages.map((stage) => [stage.code, stage]));
  stageByCode.set(newStage.code, newStage);

  const stageOrder = base.stages.map((stage) => stage.code);
  const anchorIndex = stageOrder.indexOf(position.stageCode);
  const insertIndex =
    position.kind === 'before'
      ? anchorIndex >= 0
        ? anchorIndex
        : stageOrder.length
      : anchorIndex >= 0
        ? anchorIndex + 1
        : stageOrder.length;

  if (!stageOrder.includes(newStage.code)) {
    stageOrder.splice(insertIndex, 0, newStage.code);
  }

  let transitions: WorkflowTransition[];

  if (position.kind === 'before') {
    const target = position.stageCode;
    const incoming = base.transitions.filter((transition) => transition.to === target);
    const rest = base.transitions.filter((transition) => transition.to !== target);
    const redirected = incoming.map((transition) => ({ ...transition, to: newStage.code }));
    const bridge: WorkflowTransition = {
      from: newStage.code,
      to: target,
      verb: 'forward',
      actor_role: newStage.owner_role,
      effects: [{ type: 'audit' }],
    };
    transitions = [...rest, ...redirected, bridge];
  } else {
    const after = position.stageCode;
    const outgoing = base.transitions.filter(
      (transition) =>
        transition.from === after && !SKIP_REDIRECT_VERBS.has(transition.verb.toLowerCase()),
    );
    const skip = new Set(outgoing);
    const rest = base.transitions.filter((transition) => !skip.has(transition));
    const redirected = outgoing.map((transition) => ({ ...transition, to: newStage.code }));
    const bridges = outgoing.map((transition) => ({
      from: newStage.code,
      to: transition.to,
      verb: 'forward',
      actor_role: newStage.owner_role,
      effects: [{ type: 'audit' as const }],
    }));
    transitions =
      outgoing.length > 0
        ? [...rest, ...redirected, ...bridges]
        : [
            ...rest,
            {
              from: after,
              to: newStage.code,
              verb: 'forward',
              actor_role: stageByCode.get(after)?.owner_role ?? newStage.owner_role,
              effects: [{ type: 'audit' }],
            },
          ];
  }

  return {
    ...base,
    stages: stageOrder.map((code) => stageByCode.get(code)!),
    transitions,
  };
}

/** Coerce LLM shorthand merge args into a workflow patch or full inserted draft. */
export function normalizeMergeWorkflowArgs(
  args: Record<string, unknown>,
  base: WorkflowDefinition,
): WorkflowDefinition {
  if (Array.isArray(args.stages) && args.stages.length > 0) {
    const stages = args.stages
      .map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? normalizeStageRecord(item as Record<string, unknown>)
          : null,
      )
      .filter((stage): stage is WorkflowStage => stage !== null);
    if (stages.length === 1) {
      const position = resolveInsertPosition(args, base, stages[0]);
      return insertWorkflowStage(base, stages[0], position);
    }
    return {
      code: base.code,
      version: base.version,
      stages,
      transitions: Array.isArray(args.transitions)
        ? (args.transitions as WorkflowTransition[])
        : [],
    };
  }

  const stage = normalizeStageRecord(args);
  if (!stage) {
    throw new Error('workflow must be an object');
  }
  const position = resolveInsertPosition(args, base, stage);
  return insertWorkflowStage(base, stage, position);
}

function hasShorthandStageArgs(args: Record<string, unknown>): boolean {
  return (
    typeof args.stage_code === 'string' ||
    typeof args.stageCode === 'string' ||
    typeof args.stage_name === 'string' ||
    typeof args.stageName === 'string' ||
    typeof args.stage_type === 'string' ||
    typeof args.stageType === 'string' ||
    (Array.isArray(args.stages) && !args.workflow)
  );
}

/** Resolve LLM merge arguments to a fully merged workflow definition. */
export function resolveMergedWorkflow(
  args: Record<string, unknown>,
  base: WorkflowDefinition,
  merge: (base: WorkflowDefinition, patch: WorkflowDefinition) => WorkflowDefinition,
): WorkflowDefinition {
  if (hasShorthandStageArgs(args)) {
    return normalizeMergeWorkflowArgs(args, base);
  }

  const workflowArg = args.workflow;
  if (workflowArg && typeof workflowArg === 'object' && !Array.isArray(workflowArg)) {
    const patch = workflowArg as WorkflowDefinition;
    if (Array.isArray(patch.stages)) {
      return merge(base, patch);
    }
  }

  throw new Error('workflow must be an object');
}
