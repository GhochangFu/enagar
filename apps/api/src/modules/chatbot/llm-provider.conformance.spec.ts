import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAIProvider } from './providers/openai.provider';

import type { FetchLike } from './providers/stream-utils';
import type { LLMRequest } from '@enagar/types';

const baseReq: LLMRequest = {
  systemPrompt: 'You are Sahayak.',
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 64,
  temperature: 0.2,
  tenantId: '11111111-1111-4111-8111-111111111111',
  citizenId: null,
  sessionId: 'sess-conformance',
};

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = lines.map((l) => `data: ${l}\n\n`).join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function ndjsonBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = lines.map((l) => `${l}\n`).join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function mockFetch(
  handlers: Record<string, (url: string, init?: RequestInit) => Response>,
): FetchLike {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [needle, handler] of Object.entries(handlers)) {
      if (url.includes(needle)) {
        return handler(url, init);
      }
    }
    return new Response('not found', { status: 404 });
  }) as FetchLike;
}

describe('ILLMProvider conformance (mocked HTTP)', () => {
  it('OpenAIProvider streams tokens and reports health', async () => {
    const fetchFn = mockFetch({
      'chat/completions': () =>
        new Response(
          sseBody([
            JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] }),
            JSON.stringify({
              choices: [{ finish_reason: 'stop' }],
              usage: { prompt_tokens: 3, completion_tokens: 1 },
            }),
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      '/v1/models': () => new Response('{}', { status: 200 }),
    });

    const provider = new OpenAIProvider('gpt-4o-mini', 'test-key', fetchFn);
    const chunks: string[] = [];
    for await (const chunk of provider.stream(baseReq)) {
      if (chunk.delta) {
        chunks.push(chunk.delta);
      }
    }
    expect(chunks.join('')).toBe('Hi');
    const health = await provider.health();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('GeminiProvider streams tokens and reports health', async () => {
    const fetchFn = mockFetch({
      streamGenerateContent: () =>
        new Response(
          sseBody([
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'নমস্কার' }] } }],
            }),
            JSON.stringify({
              candidates: [{ finishReason: 'STOP' }],
              usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1 },
            }),
          ]),
          { status: 200 },
        ),
      '/v1beta/models': () => new Response('{}', { status: 200 }),
    });

    const provider = new GeminiProvider('gemini-1.5-flash', 'gem-key', fetchFn);
    const chunks: string[] = [];
    for await (const chunk of provider.stream(baseReq)) {
      if (chunk.delta) {
        chunks.push(chunk.delta);
      }
    }
    expect(chunks.join('')).toContain('নমস্কার');
    expect((await provider.health()).ok).toBe(true);
  });

  it('OllamaProvider streams NDJSON and reports health', async () => {
    const fetchFn = mockFetch({
      '/api/chat': () =>
        new Response(
          ndjsonBody([
            JSON.stringify({ message: { content: 'Local' } }),
            JSON.stringify({
              done: true,
              prompt_eval_count: 4,
              eval_count: 2,
            }),
          ]),
          { status: 200 },
        ),
      '/api/tags': () => new Response('{"models":[]}', { status: 200 }),
    });

    const provider = new OllamaProvider('llama3.1:8b', 'http://127.0.0.1:11434', fetchFn);
    const chunks: string[] = [];
    let terminal = false;
    for await (const chunk of provider.stream(baseReq)) {
      if (chunk.delta) {
        chunks.push(chunk.delta);
      }
      if (chunk.done) {
        terminal = true;
        expect(chunk.inputTokens).toBe(4);
        expect(chunk.outputTokens).toBe(2);
      }
    }
    expect(chunks.join('')).toBe('Local');
    expect(terminal).toBe(true);
    expect((await provider.health()).ok).toBe(true);
  });

  it('providers throw when API keys are missing', async () => {
    await expect(
      (async () => {
        for await (const _ of new OpenAIProvider('gpt-4o-mini', '').stream(baseReq)) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/OPENAI_API_KEY/);

    await expect(
      (async () => {
        for await (const _ of new GeminiProvider('gemini-1.5-flash', '').stream(baseReq)) {
          /* drain */
        }
      })(),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
