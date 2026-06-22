import type { SetupAssistantSseEvent } from '@enagar/types';

export type ParsedSetupAssistantSseEvent = SetupAssistantSseEvent;

export function parseSetupAssistantSseBuffer(buffer: string): ParsedSetupAssistantSseEvent[] {
  const events: ParsedSetupAssistantSseEvent[] = [];
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
      const payload = JSON.parse(dataLine) as Record<string, unknown>;
      events.push({ type: eventName, ...payload } as ParsedSetupAssistantSseEvent);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return events;
}

export async function postSetupAssistantMessage(params: {
  apiBase: string;
  token: string;
  path: string;
  message: string;
  onEvent: (event: ParsedSetupAssistantSseEvent) => void;
}): Promise<void> {
  const response = await fetch(`${params.apiBase}${params.path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: params.message }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Setup assistant message failed (${response.status}): ${body.slice(0, 200)}`);
  }
  if (!response.body) {
    throw new Error('Setup assistant response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let doneReading = false;
  while (!doneReading) {
    const { done, value } = await reader.read();
    if (done) {
      doneReading = true;
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSetupAssistantSseBuffer(buffer);
    if (parsed.length > 0) {
      for (const event of parsed) {
        params.onEvent(event);
      }
      buffer = '';
    }
  }

  const tail = parseSetupAssistantSseBuffer(buffer);
  for (const event of tail) {
    params.onEvent(event);
  }
}
