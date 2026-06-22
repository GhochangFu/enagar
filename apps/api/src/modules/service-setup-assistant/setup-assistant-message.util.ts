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

export const FORM_TOOL_RETRY_USER_MESSAGE =
  'Apply the form change I requested using proposeFormFields. Reply with ONLY a fenced JSON block: {"tool_calls":[{"name":"proposeFormFields","arguments":{"fields":[...]}}]}. Use ids and referenceField from the current form fields in the system prompt.';
