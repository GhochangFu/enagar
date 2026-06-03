import type { WorkflowDefinition } from '@enagar/workflow';

/** Published/desk workflow row or definition code for hall booking (clerk slot review). */
export function isBookingWorkflowCode(workflowCode: string): boolean {
  const code = workflowCode.trim();
  return code === 'booking-v1' || code.endsWith('-booking-v1');
}

export function workflowDefinitionIsBooking(
  workflow: Pick<WorkflowDefinition, 'code' | 'stages' | 'transitions'>,
): boolean {
  if (isBookingWorkflowCode(workflow.code)) {
    return true;
  }
  if (workflow.stages.some((stage) => stage.code === 'slot-review')) {
    return true;
  }
  if (workflow.transitions.some((transition) => transition.verb === 'review-slot')) {
    return true;
  }
  return false;
}
