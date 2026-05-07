import type { WorkflowEffectType } from '@enagar/workflow';

export interface WorkflowEffectJob {
  tenant_id: string;
  application_id: string;
  transition_id: string;
  effect_type: WorkflowEffectType;
  payload?: Record<string, unknown>;
}

export interface SlaEscalationJob {
  tenant_id: string;
  application_id: string;
  stage_code: string;
  due_at: string;
}

export interface DueStage {
  tenant_id: string;
  application_id: string;
  stage_code: string;
  due_at: string;
  escalated: boolean;
}

export interface IdempotencyStore {
  has(key: string): boolean;
  add(key: string): void;
}

export function effectIdempotencyKey(job: WorkflowEffectJob): string {
  return [job.tenant_id, job.application_id, job.transition_id, job.effect_type].join(':');
}

export function executeEffectOnce(
  job: WorkflowEffectJob,
  store: IdempotencyStore,
): { executed: boolean; key: string } {
  const key = effectIdempotencyKey(job);
  if (store.has(key)) {
    return { executed: false, key };
  }

  store.add(key);
  return { executed: true, key };
}

export function createSlaEscalationJob(stage: DueStage): SlaEscalationJob {
  return {
    tenant_id: stage.tenant_id,
    application_id: stage.application_id,
    stage_code: stage.stage_code,
    due_at: stage.due_at,
  };
}

export function reconcileDueStages(now: Date, stages: DueStage[]): SlaEscalationJob[] {
  return stages
    .filter((stage) => !stage.escalated && new Date(stage.due_at).getTime() <= now.getTime())
    .map(createSlaEscalationJob);
}
