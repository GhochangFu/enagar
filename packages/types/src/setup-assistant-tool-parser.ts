// Keep in sync with apps/api/src/modules/service-setup-assistant/tools/tool-call-parser.ts
export type ParsedToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

const FENCED_TOOL_CALLS_RE = /```json\s*([\s\S]*?)\s*```/i;
const BARE_TOOL_CALLS_RE = /\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/i;
const STRIP_FENCED_JSON_RE = /```json[\s\S]*?(?:```|$)/gi;
const STRIP_BARE_TOOL_CALLS_RE = /\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/g;

function parseToolCallsPayload(payload: unknown): ParsedToolCall[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const rawCalls = (payload as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(rawCalls)) {
    return [];
  }
  const toolCalls: ParsedToolCall[] = [];
  for (const item of rawCalls) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) {
      continue;
    }
    const args =
      record.arguments && typeof record.arguments === 'object' && !Array.isArray(record.arguments)
        ? (record.arguments as Record<string, unknown>)
        : {};
    toolCalls.push({ name, arguments: args });
  }
  return toolCalls;
}

function tryParseToolCallsJson(raw: string): ParsedToolCall[] {
  try {
    return parseToolCallsPayload(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** Remove tool-call JSON markup (fenced, bare, or truncated) from assistant text shown to operators. */
export function stripToolCallMarkupFromAssistantText(text: string): string {
  return text
    .replace(STRIP_FENCED_JSON_RE, '')
    .replace(STRIP_BARE_TOOL_CALLS_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Map mistaken workflow tool names/args to applyWorkflowTemplate when template_id is present. */
export function normalizeWorkflowToolCalls(toolCalls: ParsedToolCall[]): ParsedToolCall[] {
  return toolCalls.map((call) => {
    const templateId =
      typeof call.arguments.template_id === 'string' ? call.arguments.template_id.trim() : '';
    if (
      templateId &&
      (call.name === 'replaceWorkflowDraft' || call.name === 'applyWorkflowDraft')
    ) {
      return { name: 'applyWorkflowTemplate', arguments: { template_id: templateId } };
    }
    return call;
  });
}

/** Extract tool_calls JSON from assistant text; returns cleaned display text. */
export function parseToolCallsFromAssistantText(text: string): {
  displayText: string;
  toolCalls: ParsedToolCall[];
} {
  const fencedMatch = FENCED_TOOL_CALLS_RE.exec(text);
  if (fencedMatch) {
    const displayText = stripToolCallMarkupFromAssistantText(
      `${text.slice(0, fencedMatch.index)}${text.slice(fencedMatch.index + fencedMatch[0].length)}`,
    );
    const toolCalls = tryParseToolCallsJson(fencedMatch[1] ?? '');
    if (toolCalls.length > 0) {
      return { displayText, toolCalls: normalizeWorkflowToolCalls(toolCalls) };
    }
    return { displayText, toolCalls: [] };
  }

  const bareMatch = BARE_TOOL_CALLS_RE.exec(text);
  if (bareMatch) {
    const displayText = stripToolCallMarkupFromAssistantText(
      `${text.slice(0, bareMatch.index)}${text.slice(bareMatch.index + bareMatch[0].length)}`,
    );
    const toolCalls = tryParseToolCallsJson(bareMatch[0]);
    if (toolCalls.length > 0) {
      return { displayText, toolCalls: normalizeWorkflowToolCalls(toolCalls) };
    }
    return { displayText, toolCalls: [] };
  }

  return {
    displayText: stripToolCallMarkupFromAssistantText(text),
    toolCalls: [],
  };
}
