import { parseToolCallsFromAssistantText } from './tool-call-parser';

describe('parseToolCallsFromAssistantText', () => {
  it('returns empty tool calls when no JSON block', () => {
    const result = parseToolCallsFromAssistantText('Hello admin');
    expect(result.toolCalls).toEqual([]);
    expect(result.displayText).toBe('Hello admin');
  });

  it('parses tool_calls from fenced JSON block', () => {
    const text = `I will add the field now.

\`\`\`json
{"tool_calls":[{"name":"applyFormDraft","arguments":{"form_schema":{"service_code":"TRADE","fields":[]}}}]}
\`\`\``;
    const result = parseToolCallsFromAssistantText(text);
    expect(result.displayText).toBe('I will add the field now.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('applyFormDraft');
  });
});
