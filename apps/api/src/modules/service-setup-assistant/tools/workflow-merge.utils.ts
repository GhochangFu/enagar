import type { WorkflowDefinition, WorkflowStage, WorkflowTransition } from '@enagar/workflow';

function transitionKey(transition: WorkflowTransition): string {
  return `${transition.from}|${transition.to}|${transition.verb}`;
}

export function bindWorkflowToService(
  workflow: WorkflowDefinition,
  serviceCode: string,
  version = 1,
): WorkflowDefinition {
  return {
    ...workflow,
    code: `${serviceCode}-workflow-v${version}`,
    version,
  };
}

export function mergeWorkflowDraft(
  base: WorkflowDefinition,
  patch: WorkflowDefinition,
): WorkflowDefinition {
  const stageByCode = new Map<string, WorkflowStage>();
  for (const stage of base.stages) {
    stageByCode.set(stage.code, stage);
  }
  const stageOrder = base.stages.map((stage) => stage.code);
  for (const stage of patch.stages) {
    if (!stageByCode.has(stage.code)) {
      stageOrder.push(stage.code);
    }
    stageByCode.set(stage.code, stage);
  }

  const transitionByKey = new Map<string, WorkflowTransition>();
  for (const transition of base.transitions) {
    transitionByKey.set(transitionKey(transition), transition);
  }
  for (const transition of patch.transitions) {
    transitionByKey.set(transitionKey(transition), transition);
  }

  return {
    ...base,
    code: patch.code?.trim() ? patch.code : base.code,
    version: patch.version ?? base.version,
    stages: stageOrder.map((code) => stageByCode.get(code)!),
    transitions: Array.from(transitionByKey.values()),
  };
}

export function formatWorkflowStagesForPrompt(
  workflow: WorkflowDefinition | null | undefined,
): string {
  if (!workflow?.stages?.length) {
    return '(no workflow draft yet)';
  }
  const lines = workflow.stages.map((stage) => {
    const label = stage.label?.en?.trim() || stage.code;
    const flags = [
      stage.initial ? 'initial' : null,
      stage.terminal ? 'terminal' : null,
      stage.owner_designation ?? stage.owner_role,
    ]
      .filter(Boolean)
      .join(', ');
    return `- ${stage.code}: "${label}" (${flags})`;
  });
  return `${lines.join('\n')}\nTransitions: ${workflow.transitions.length}`;
}
