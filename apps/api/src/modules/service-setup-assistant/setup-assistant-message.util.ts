/** Heuristic: staff message likely expects a proposeFormFields tool call. */
export function looksLikeFormFieldEditRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) {
    return false;
  }
  const hasAction =
    /\b(add|insert|create|new|remove|delete|update|change|rename|move|make|set|require|optional|validate|validation|after|before|also)\b/.test(
      text,
    );
  const hasFieldContext =
    /\bfield\b/.test(text) ||
    /\b(phone|email|name|address|date|number|guardian|applicant|contact|section|textarea|select|radio|file)\b/.test(
      text,
    );
  return hasAction && hasFieldContext;
}

/** Heuristic: staff message likely expects a workflow tool call. */
export function looksLikeWorkflowEditRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) {
    return false;
  }
  if (
    /^(what|how|why|when|who|which|explain|tell me)\b/.test(text) &&
    !/\b(add|apply|replace|merge|remove|change|update)\b/.test(text)
  ) {
    return false;
  }
  const hasAction =
    /\b(apply|replace|merge|add|remove|insert|start over|template|regenerate|change|update|scrutiny|linear|booking|stage|transition|workflow)\b/.test(
      text,
    );
  const hasWorkflowContext =
    /\bworkflow\b/.test(text) ||
    /\b(stage|transition|approval|scrutiny|linear|booking|clerk|officer|boc)\b/.test(text);
  return hasAction && hasWorkflowContext;
}

export const FORM_TOOL_RETRY_USER_MESSAGE =
  'Apply the form change I requested using proposeFormFields. Reply with ONLY a fenced JSON block: {"tool_calls":[{"name":"proposeFormFields","arguments":{"fields":[...]}}]}. Use ids and referenceField from the current form fields in the system prompt.';

export const WORKFLOW_TOOL_RETRY_USER_MESSAGE =
  'Apply the workflow change I requested using applyWorkflowTemplate, replaceWorkflowDraft, mergeWorkflowDraft, or applyWorkflowDraft. Reply with ONLY a fenced JSON block: {"tool_calls":[{"name":"applyWorkflowTemplate","arguments":{"template_id":"linear_approval"}}]}. Use current workflow stages from the system prompt.';
