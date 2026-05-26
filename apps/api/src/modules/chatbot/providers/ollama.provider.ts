import { readNdjsonLines, type FetchLike } from './stream-utils';

import type {
  ILLMProvider,
  LLMHealth,
  LLMProviderName,
  LLMRequest,
  LLMStreamChunk,
} from '@enagar/types';

type OllamaStreamChunk = {
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

export class OllamaProvider implements ILLMProvider {
  readonly name: LLMProviderName = 'ollama';

  constructor(
    readonly model: string = process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
    private readonly baseUrl: string = resolveOllamaBaseUrl(),
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        options: { temperature: req.temperature, num_predict: req.maxTokens },
        messages: [
          { role: 'system', content: req.systemPrompt },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Ollama stream failed (${response.status}): ${detail}`);
    }

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    for await (const line of readNdjsonLines(response.body)) {
      let payload: OllamaStreamChunk;
      try {
        payload = JSON.parse(line) as OllamaStreamChunk;
      } catch {
        continue;
      }

      const delta = payload.message?.content ?? '';
      if (delta) {
        yield { delta, done: false };
      }

      if (payload.done) {
        inputTokens = payload.prompt_eval_count;
        outputTokens = payload.eval_count;
        yield {
          delta: '',
          done: true,
          inputTokens,
          outputTokens,
          finishReason: 'stop',
        };
        return;
      }
    }

    yield { delta: '', done: true, finishReason: 'stop' };
  }

  async health(): Promise<LLMHealth> {
    const started = Date.now();
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/tags`);
      return { ok: response.ok, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}

function resolveOllamaBaseUrl(): string {
  const port = process.env.OLLAMA_PORT ?? '11434';
  const explicit = process.env.OLLAMA_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  return `http://127.0.0.1:${port}`;
}
