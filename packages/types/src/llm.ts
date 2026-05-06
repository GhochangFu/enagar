// Contract for the chatbot LLM provider adapter, defined in
// ADR-0008 (docs/ADRs/ADR-0008-llm-provider-adapter.md).
//
// Every concrete provider (OpenAI, Gemini, Ollama, future Claude, …)
// must satisfy `ILLMProvider`. The chatbot service depends only on
// this interface; selection happens at composition time using the
// precedence:
//   tenants.config.chatbot.provider  >  LLM_PROVIDER env  >  default

export type LLMProviderName = 'openai' | 'gemini' | 'ollama';

export type LLMRole = 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMRequest {
  /** Pre-rendered system prompt (post-RAG, post-redaction). */
  systemPrompt: string;
  /** Conversation history (already trimmed to fit context). */
  messages: ReadonlyArray<LLMMessage>;
  /** Resolved per-tenant cap (model max may be lower). */
  maxTokens: number;
  /** 0–2; lower = less creative. Defaults to 0.2 for our use-case. */
  temperature: number;
  /** Trace context — required for cost telemetry & DPDP audit log. */
  tenantId: string;
  citizenId: string | null;
  sessionId: string;
}

export interface LLMStreamChunk {
  /** Incremental token text. Empty string is permitted on heartbeats. */
  delta: string;
  done: boolean;
  /** Populated only on the terminal chunk (done === true). */
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: 'stop' | 'length' | 'safety' | 'error';
}

export interface LLMHealth {
  ok: boolean;
  latencyMs: number;
  /** Optional provider-reported quota / billing hint. */
  quotaRemaining?: number;
}

export interface ILLMProvider {
  readonly name: LLMProviderName;
  readonly model: string;

  /**
   * Streams tokens for the given request. Throws on transport errors;
   * the caller (chatbot service) wraps these into SSE events.
   */
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;

  /** Lightweight health probe consumed by `/healthz`. */
  health(): Promise<LLMHealth>;
}
