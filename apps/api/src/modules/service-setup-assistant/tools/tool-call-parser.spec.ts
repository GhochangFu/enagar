import {
  normalizeWorkflowToolCalls,
  parseToolCallsFromAssistantText,
  stripToolCallMarkupFromAssistantText,
} from './tool-call-parser';

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

  it('parses bare tool_calls JSON without fences', () => {
    const text =
      'Proceeding now {"tool_calls":[{"name":"detectArchetype","arguments":{"description":"birth cert"}}]}';
    const result = parseToolCallsFromAssistantText(text);
    expect(result.displayText).toBe('Proceeding now');
    expect(result.toolCalls[0]?.name).toBe('detectArchetype');
  });

  it('strips truncated fenced JSON from display text', () => {
    const text = 'Would you like that?```json { "tool_calls": [] }';
    const result = parseToolCallsFromAssistantText(text);
    expect(result.displayText).toBe('Would you like that?');
    expect(result.toolCalls).toEqual([]);
  });

  it('normalizes replaceWorkflowDraft+template_id to applyWorkflowTemplate', () => {
    const text = `\`\`\`json
{"tool_calls":[{"name":"replaceWorkflowDraft","arguments":{"template_id":"linear_approval"}}]}
\`\`\``;
    const result = parseToolCallsFromAssistantText(text);
    expect(result.toolCalls).toEqual([
      { name: 'applyWorkflowTemplate', arguments: { template_id: 'linear_approval' } },
    ]);
  });
});

describe('normalizeWorkflowToolCalls', () => {
  it('maps applyWorkflowDraft with template_id', () => {
    expect(
      normalizeWorkflowToolCalls([
        { name: 'applyWorkflowDraft', arguments: { template_id: 'scrutiny' } },
      ]),
    ).toEqual([{ name: 'applyWorkflowTemplate', arguments: { template_id: 'scrutiny' } }]);
  });
});

describe('stripToolCallMarkupFromAssistantText', () => {
  it('removes inline fenced blocks', () => {
    expect(
      stripToolCallMarkupFromAssistantText('Done. ```json {"tool_calls":[]} ``` Thanks.'),
    ).toBe('Done. Thanks.');
  });
});
