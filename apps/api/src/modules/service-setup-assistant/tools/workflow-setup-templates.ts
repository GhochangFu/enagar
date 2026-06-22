import {
  bookingWorkflow,
  certificateIssuanceWorkflow,
  createLinearWorkflowDraft,
  type WorkflowDefinition,
} from '@enagar/workflow';

import { bindWorkflowToService } from './workflow-merge.utils';

export const WORKFLOW_TEMPLATE_IDS = ['linear_approval', 'scrutiny', 'booking'] as const;

export type WorkflowTemplateId = (typeof WORKFLOW_TEMPLATE_IDS)[number];

export function resolveWorkflowTemplate(
  templateId: string,
  serviceCode: string,
  version = 1,
): WorkflowDefinition | null {
  const key = templateId.trim().toLowerCase() as WorkflowTemplateId;
  switch (key) {
    case 'linear_approval':
      return bindWorkflowToService(
        createLinearWorkflowDraft(serviceCode, version),
        serviceCode,
        version,
      );
    case 'scrutiny':
      return bindWorkflowToService(certificateIssuanceWorkflow, serviceCode, version);
    case 'booking':
      return {
        ...bookingWorkflow,
        code: `${serviceCode}-booking-v${version}`,
        version,
      };
    default:
      return null;
  }
}

export function listWorkflowTemplatesForPrompt(): string {
  return WORKFLOW_TEMPLATE_IDS.map((id) => `- ${id}`).join('\n');
}
