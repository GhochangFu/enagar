import { parseChatbotSseBuffer } from './chatbot-sse';

describe('parseChatbotSseBuffer', () => {
  it('parses meta, token, and done events', () => {
    const raw = [
      'event: meta',
      'data: {"session_id":"s1","language":"bn","citations":[]}',
      '',
      'event: token',
      'data: {"delta":"হ্যালো"}',
      '',
      'event: done',
      'data: {"session_id":"s1","finish_reason":"stop"}',
      '',
    ].join('\n');

    const events = parseChatbotSseBuffer(raw);
    expect(events).toHaveLength(3);
    expect(events[0]?.event).toBe('meta');
    expect(events[1]?.event).toBe('token');
    expect(events[2]?.event).toBe('done');
  });
});
