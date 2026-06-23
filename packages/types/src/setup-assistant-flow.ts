import type {
  SetupAssistantScope,
  SetupReadinessChecklist,
  SetupSessionDto,
} from './service-setup-assistant.js';

export const SETUP_SCOPE_STEPS: Record<SetupAssistantScope, number[]> = {
  full: [1, 2, 3, 4, 5],
  form: [2, 5],
  workflow: [3, 5],
  payment: [4, 5],
  review: [5],
};

export const SETUP_STEP_LABELS: Record<number, string> = {
  1: 'Intent & archetype',
  2: 'Form design',
  3: 'Workflow design',
  4: 'Payment & documents',
  5: 'Review & publish',
};

const DRAFT_LAYER_KEYS = [
  'form_draft_valid',
  'workflow_draft_valid',
  'config_complete',
  'booking_assets',
] as const;

export function allowedStepsForScope(scope: SetupAssistantScope): number[] {
  return SETUP_SCOPE_STEPS[scope];
}

export function stepLabel(step: number): string {
  return SETUP_STEP_LABELS[step] ?? `Step ${step}`;
}

export function previousStep(scope: SetupAssistantScope, currentStep: number): number | null {
  const steps = allowedStepsForScope(scope);
  const index = steps.indexOf(currentStep);
  if (index <= 0) {
    return null;
  }
  return steps[index - 1] ?? null;
}

export function nextStep(
  scope: SetupAssistantScope,
  currentStep: number,
  stepCompletion: Record<string, boolean> = {},
): number | null {
  const steps = allowedStepsForScope(scope);
  const index = steps.indexOf(currentStep);
  if (index < 0 || index >= steps.length - 1) {
    return null;
  }

  if (scope !== 'full') {
    return steps[index + 1] ?? null;
  }

  for (let i = index + 1; i < steps.length; i++) {
    const candidate = steps[i]!;
    if (candidate === 5 || stepCompletion[String(candidate)] !== true) {
      return candidate;
    }
  }
  return 5;
}

export function canSkipToReview(
  scope: SetupAssistantScope,
  currentStep: number,
  stepCompletion: Record<string, boolean>,
): boolean {
  if (!allowedStepsForScope(scope).includes(5)) {
    return false;
  }
  if (scope === 'full') {
    const prerequisites = [1, 2, 3, 4];
    return prerequisites.every((step) => stepCompletion[String(step)] === true);
  }
  return stepCompletion[String(currentStep)] === true;
}

export function areDraftLayersReady(checklist: SetupReadinessChecklist): boolean {
  return DRAFT_LAYER_KEYS.every(
    (key) => checklist.items.find((item) => item.key === key)?.status === 'green',
  );
}

export function formatStepProgress(session: SetupSessionDto): string {
  const steps = allowedStepsForScope(session.scope);
  const index = steps.indexOf(session.current_step);
  const position = index >= 0 ? index + 1 : session.current_step;
  return `Step ${position} of ${steps.length} — ${stepLabel(session.current_step)}`;
}
