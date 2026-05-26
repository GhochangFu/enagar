import { readSseDataLines, type FetchLike } from './stream-utils';

import type {
  ILLMProvider,
  LLMHealth,
  LLMProviderName,
  LLMRequest,
  LLMStreamChunk,
} from '@enagar/types';

type OpenAiStreamChoice = {
  delta?: { content?: string };
  finish_reason?: string | null;
};

type OpenAiStreamPayload = {
  choices?: OpenAiStreamChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenAIProvider implements ILLMProvider {
  readonly name: LLMProviderName = 'openai';

  constructor(
    readonly model: string = process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    private readonly apiKey: string = process.env.OPENAI_API_KEY ?? '',
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await this.fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENAI_ORG_ID ? { 'OpenAI-Organization': process.env.OPENAI_ORG_ID } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        messages: [
          { role: 'system', content: req.systemPrompt },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI stream failed (${response.status}): ${detail}`);
    }

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let finishReason: LLMStreamChunk['finishReason'];

    for await (const line of readSseDataLines(response.body)) {
      let payload: OpenAiStreamPayload;
      try {
        payload = JSON.parse(line) as OpenAiStreamPayload;
      } catch {
        continue;
      }

      if (payload.usage) {
        inputTokens = payload.usage.prompt_tokens;
        outputTokens = payload.usage.completion_tokens;
      }

      const choice = payload.choices?.[0];
      const delta = choice?.delta?.content ?? '';
      if (choice?.finish_reason) {
        finishReason = mapFinishReason(choice.finish_reason);
      }
      if (delta) {
        yield { delta, done: false };
      }
    }

    yield {
      delta: '',
      done: true,
      inputTokens,
      outputTokens,
      finishReason: finishReason ?? 'stop',
    };
  }

  async health(): Promise<LLMHealth> {
    const started = Date.now();
    if (!this.apiKey) {
      return { ok: false, latencyMs: Date.now() - started };
    }
    try {
      const response = await this.fetchFn('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return { ok: response.ok, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}

function mapFinishReason(reason: string): LLMStreamChunk['finishReason'] {
  if (reason === 'length') {
    return 'length';
  }
  if (reason === 'content_filter') {
    return 'safety';
  }
  if (reason === 'stop') {
    return 'stop';
  }
  return 'error';
}
