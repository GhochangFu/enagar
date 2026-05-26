/** Parse Server-Sent Events lines (`data: …`) from a streaming fetch body. */
export async function* readSseDataLines(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string> {
  if (!body) {
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== '[DONE]') {
          yield payload;
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
      const payload = tail.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        yield payload;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parse newline-delimited JSON objects (Ollama streaming). */
export async function* readNdjsonLines(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string> {
  if (!body) {
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed) {
          yield trimmed;
        }
      }
    }
    const tail = buffer.trim();
    if (tail) {
      yield tail;
    }
  } finally {
    reader.releaseLock();
  }
}

export type FetchLike = typeof fetch;
