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
  'Apply the workflow change I requested using mergeWorkflowDraft. To add: stage_code, stage_name, stage_type, insert_before/insert_after. To remove: remove_stage_code only. Reply with ONLY a fenced JSON block. Remove example: {"tool_calls":[{"name":"mergeWorkflowDraft","arguments":{"remove_stage_code":"tenant-verification"}}]}.';

/** Heuristic: staff message likely expects an intent tool call. */
export function looksLikeIntentCaptureRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) {
    return false;
  }
  if (
    /^(what|how|why|when|who|which|explain|tell me)\b/.test(text) &&
    !/\b(classify|detect|summarize|record|archetype|requirement)\b/.test(text)
  ) {
    return false;
  }
  const hasAction =
    /\b(classify|detect|summarize|record|set up|setup|configure|certificate|booking|scrutiny|approval|fee|payment|purpose)\b/.test(
      text,
    );
  const hasServiceContext =
    /\b(service|birth|death|trade|hall|certificate|licence|license|permit|noc)\b/.test(text);
  return hasAction && hasServiceContext;
}

/** Heuristic: staff message likely expects a config tool call. */
export function looksLikeConfigEditRequest(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) {
    return false;
  }
  if (
    /^(what|how|why|when|who|which|explain|tell me|list)\b/.test(text) &&
    !/\b(set|apply|add|configure|fee|document|revenue)\b/.test(text)
  ) {
    return false;
  }
  const hasAction =
    /\b(set|apply|add|configure|update|change|map|require|fee|document|revenue|payment|schedule|boc|signoff)\b/.test(
      text,
    );
  const hasConfigContext =
    /\b(fee|document|revenue|payment|schedule|paise|rupee|₹|aadhaar|pdf|head)\b/.test(text);
  return hasAction && hasConfigContext;
}

export const INTENT_TOOL_RETRY_USER_MESSAGE =
  'Classify and record what I described using detectArchetype and summarizeRequirements. Reply with ONLY a fenced JSON block. Example: {"tool_calls":[{"name":"detectArchetype","arguments":{"description":"..."}},{"name":"summarizeRequirements","arguments":{"summary":{...}}}]}.';

export const CONFIG_TOOL_RETRY_USER_MESSAGE =
  'Apply the payment/config change I requested using applyServiceConfig (or proposeFeeRule / setRequiredDocuments). Use revenue_head_code from the Masters list in the system prompt. Reply with ONLY a fenced JSON block.';
