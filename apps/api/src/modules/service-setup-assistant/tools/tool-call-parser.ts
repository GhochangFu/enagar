export type ParsedToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

const TOOL_CALLS_RE = /```json\s*([\s\S]*?)\s*```/i;

/** Extract tool_calls JSON block from assistant text; returns cleaned display text. */
export function parseToolCallsFromAssistantText(text: string): {
  displayText: string;
  toolCalls: ParsedToolCall[];
} {
  const match = TOOL_CALLS_RE.exec(text);
  if (!match) {
    return { displayText: text.trim(), toolCalls: [] };
  }

  const displayText =
    `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`.trim();
  try {
    const payload = JSON.parse(match[1] ?? '') as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { displayText: text.trim(), toolCalls: [] };
    }
    const rawCalls = (payload as { tool_calls?: unknown }).tool_calls;
    if (!Array.isArray(rawCalls)) {
      return { displayText: text.trim(), toolCalls: [] };
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
    return { displayText, toolCalls };
  } catch {
    return { displayText: text.trim(), toolCalls: [] };
  }
}
