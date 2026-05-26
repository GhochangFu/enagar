import type {
  ChatbotSseDone,
  ChatbotSseError,
  ChatbotSseMeta,
  ChatbotSseToken,
} from '@enagar/types';

export type ParsedChatbotSseEvent =
  | { event: 'meta'; data: ChatbotSseMeta }
  | { event: 'token'; data: ChatbotSseToken }
  | { event: 'done'; data: ChatbotSseDone }
  | { event: 'error'; data: ChatbotSseError };

/** Parse a full SSE text buffer into discrete events (Sprint 7.3 contract). */
export function parseChatbotSseBuffer(buffer: string): ParsedChatbotSseEvent[] {
  const events: ParsedChatbotSseEvent[] = [];
  const blocks = buffer.split('\n\n').filter((block) => block.trim());
  for (const block of blocks) {
    let eventName = 'message';
    let dataLine = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.slice(5).trim();
      }
    }
    if (!dataLine) {
      continue;
    }
    try {
      const payload = JSON.parse(dataLine) as unknown;
      if (eventName === 'meta') {
        events.push({ event: 'meta', data: payload as ChatbotSseMeta });
      } else if (eventName === 'token') {
        events.push({ event: 'token', data: payload as ChatbotSseToken });
      } else if (eventName === 'done') {
        events.push({ event: 'done', data: payload as ChatbotSseDone });
      } else if (eventName === 'error') {
        events.push({ event: 'error', data: payload as ChatbotSseError });
      }
    } catch {
      /* ignore malformed chunk */
    }
  }
  return events;
}
