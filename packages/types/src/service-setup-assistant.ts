export type SetupAssistantScope = 'full' | 'form' | 'workflow' | 'payment' | 'review';

export type SetupAssistantStep = 1 | 2 | 3 | 4 | 5;

export type ChecklistStatus = 'green' | 'amber' | 'red';

export type SetupReadinessItem = {
  key: string;
  label: string;
  status: ChecklistStatus;
  message?: string;
};

export type SetupReadinessChecklist = {
  items: SetupReadinessItem[];
  ready_to_publish: boolean;
};

export type SetupSessionStatus = 'active' | 'completed' | 'abandoned';

export type SetupSessionDto = {
  id: string;
  scope: SetupAssistantScope;
  current_step: SetupAssistantStep;
  archetype: string | null;
  step_completion: Record<string, boolean>;
  status: SetupSessionStatus;
};

export type SetupAssistantSseEvent =
  | { type: 'meta'; session_id: string; step: number }
  | { type: 'token'; delta: string }
  | { type: 'tool_result'; name: string; success: boolean; summary: string }
  | { type: 'draft_updated'; layer: 'form' | 'workflow' | 'config' }
  | { type: 'done' }
  | { type: 'error'; message: string };
