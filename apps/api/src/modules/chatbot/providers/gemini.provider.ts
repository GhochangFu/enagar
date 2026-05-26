import { readSseDataLines, type FetchLike } from './stream-utils';

import type {
  ILLMProvider,
  LLMHealth,
  LLMProviderName,
  LLMRequest,
  LLMStreamChunk,
} from '@enagar/types';

type GeminiPart = { text?: string };
type GeminiCandidate = {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
};
type GeminiStreamPayload = {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export class GeminiProvider implements ILLMProvider {
  readonly name: LLMProviderName = 'gemini';

  constructor(
    readonly model: string = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    private readonly apiKey: string = process.env.GEMINI_API_KEY ?? '',
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}` +
      `:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: req.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gemini stream failed (${response.status}): ${detail}`);
    }

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let finishReason: LLMStreamChunk['finishReason'];

    for await (const line of readSseDataLines(response.body)) {
      let payload: GeminiStreamPayload;
      try {
        payload = JSON.parse(line) as GeminiStreamPayload;
      } catch {
        continue;
      }

      if (payload.usageMetadata) {
        inputTokens = payload.usageMetadata.promptTokenCount;
        outputTokens = payload.usageMetadata.candidatesTokenCount;
      }

      const candidate = payload.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const delta = parts.map((p) => p.text ?? '').join('');
      if (candidate?.finishReason) {
        finishReason = mapGeminiFinish(candidate.finishReason);
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
      const response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`,
      );
      return { ok: response.ok, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}

function mapGeminiFinish(reason: string): LLMStreamChunk['finishReason'] {
  const upper = reason.toUpperCase();
  if (upper.includes('MAX')) {
    return 'length';
  }
  if (upper.includes('SAFETY')) {
    return 'safety';
  }
  if (upper === 'STOP') {
    return 'stop';
  }
  return 'error';
}
