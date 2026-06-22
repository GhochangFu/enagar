import type { SetupAssistantSseEvent } from '@enagar/types';
import type { Response } from 'express';

export function writeSetupAssistantSse(res: Response, event: SetupAssistantSseEvent): void {
  const { type, ...data } = event;
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function streamSetupAssistantSse(
  res: Response,
  source: AsyncIterable<SetupAssistantSseEvent>,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    for await (const event of source) {
      writeSetupAssistantSse(res, event);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup assistant message failed';
    const status =
      typeof (error as { getStatus?: () => number }).getStatus === 'function'
        ? (error as { getStatus: () => number }).getStatus()
        : 500;
    if (!res.headersSent) {
      res.status(status);
    }
    writeSetupAssistantSse(res, { type: 'error', message });
  } finally {
    res.end();
  }
}
