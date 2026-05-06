# ADR-0008 — LLM provider strategy: hosted-API adapter pattern (OpenAI / Gemini), Ollama optional

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Status**          | Accepted                                                           |
| **Date**            | 2026-05-06                                                         |
| **Decision-makers** | Project Technical Lead                                             |
| **Supersedes**      | The implicit Ollama-only assumption in `ARCHITECTURE.md` §1 and §4 |
| **Related**         | ADR-0001 (Postgres), ADR-0005 (Hosting), ADR-0002 (NestJS)         |

## Context

Earlier project documents (`ARCHITECTURE.md`, the original `AGENT.md`, the original `docs/charter.md`) committed Sahayak AI to **on-prem inference via Ollama** running Llama 3.1 8B / Mistral 7B, citing data sovereignty as a non-negotiable pillar. The pillar literally read: _"Citizen queries never leave government servers."_

After Phase 0 kick-off review, the decision-maker chose to **pivot to hosted LLM APIs (OpenAI and Google Gemini)** for the chatbot. The drivers are:

1. **Quality at v1**: Llama 3.1 8B is acceptable for English but uneven for Bengali long-context KB grounding. GPT-4o / Gemini 1.5 Pro are materially better for multilingual RAG with citations.
2. **Time-to-pilot**: Eliminates GPU procurement runway (no GPU = ~2–4 s per token on CPU Llama, which is unusable). Pilot can ship without waiting for hardware.
3. **Solo execution constraint** (Charter §9): one fewer infrastructure subsystem to operate.
4. **Cost shape**: predictable OpEx per query at pilot volume (~thousands of queries/day) is cheaper than CapEx for a GPU pool that sits idle off-peak.

The decision-maker also explicitly chose to **drop the AI-sovereignty pillar permanently** — citizen-data sovereignty for storage, identity, and inference inputs **remains on-prem** (Postgres, MinIO, Keycloak, Qdrant), but the **LLM inference call itself** is allowed to use approved third-party providers.

This ADR records that decision, defines the adapter contract that keeps it reversible, and specifies the DPDP-compliance work that the change creates.

## Decision

**We adopt a provider-adapter pattern (`ILLMProvider`) for chatbot inference. Three implementations ship in v1: `OpenAIProvider`, `GeminiProvider`, and `OllamaProvider`. The active provider is selected by the `LLM_PROVIDER` environment variable (and may also be overridden per-tenant in `tenants.config.chatbot.provider`).**

Concretely:

### Adapter contract (TypeScript shape)

```ts
// packages/types/src/llm.ts
export interface LLMRequest {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  // Per-tenant overrides are resolved before this call.
  maxTokens: number;
  temperature: number;
  // Trace context for cost & DPDP audit.
  tenantId: string;
  citizenId: string | null;
  sessionId: string;
}

export interface LLMStreamChunk {
  delta: string; // token text
  done: boolean;
  // Only populated on the final chunk:
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: 'stop' | 'length' | 'safety' | 'error';
}

export interface ILLMProvider {
  readonly name: 'openai' | 'gemini' | 'ollama';
  readonly model: string;
  /** Streams tokens; throws on transport error. Caller wraps SSE response. */
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
  /** Optional health probe used by /healthz. */
  health(): Promise<{ ok: boolean; latencyMs: number }>;
}
```

### Implementations (v1)

| Provider | Default model (configurable)                               | Notes                                                                                     |
| -------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `openai` | `gpt-4o-mini` (fast, cheap) → `gpt-4o` for premium tenants | Streaming via `chat/completions` with `stream: true`                                      |
| `gemini` | `gemini-1.5-flash` → `gemini-1.5-pro` for premium tenants  | Streaming via `streamGenerateContent`                                                     |
| `ollama` | `llama3.1:8b`                                              | Off by default in production; available locally and for any future migration back on-prem |

### Selection precedence (highest wins)

1. `tenants.config.chatbot.provider` (per-tenant override; e.g. a sensitive ULB chooses `ollama` while others use `openai`).
2. `LLM_PROVIDER` environment variable (default for the deployment).
3. Hard-coded fallback: `openai` (in production) / `ollama` (in local dev if API keys absent).

### Mandatory PII-redaction layer (DPDP control)

Before any prompt leaves the platform boundary, a redaction step replaces:

| Original                         | Placeholder       |
| -------------------------------- | ----------------- |
| Citizen mobile (`+91XXXXXXXXXX`) | `[CITIZEN_PHONE]` |
| Aadhaar last-4                   | `[AADHAAR_4]`     |
| Holding number                   | `[HOLDING]`       |
| Docket / application no.         | `[DOCKET]`        |
| Citizen name                     | `[CITIZEN_NAME]`  |
| Address fields                   | `[ADDRESS]`       |

A reverse-substitution map is kept **server-side only**, scoped to the request. The model responds with placeholders; the chatbot service substitutes back before streaming to the client. This means **PII never reaches the third-party provider**, even though the conversational substance does.

This is implemented once in `apps/api/src/modules/chatbot/redaction.ts` and unit-tested with adversarial fixtures.

### Logging & audit (DPDP control)

Every `ILLMProvider.stream()` call is wrapped by an audit interceptor that records, in the local audit table:

```
{ request_id, tenant_id, citizen_id, session_id, provider, model,
  input_tokens, output_tokens, latency_ms, redaction_count,
  query_hash (SHA-256 of redacted query), timestamp }
```

The **raw query text is never logged**, only its hash. This satisfies "we processed your query" auditability without becoming a PII liability ourselves.

### Cost telemetry

Per-tenant Prometheus counters track `llm_tokens_total{tenant,provider,direction}` and `llm_cost_inr_total{tenant,provider}`. State Super-Admin dashboard renders a daily / monthly view. A configurable monthly budget per tenant fires an alert when 80 % consumed.

## Alternatives considered

| Option                                                              | Pros                                                       | Cons                                                                                     | Rejected because                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Stick with Ollama on-prem** (original design)                     | Full sovereignty; predictable CapEx                        | GPU procurement runway 6+ months; quality gap for Bengali; ops burden                    | Decision-maker overrode in Phase 0 review                       |
| **OpenAI only**                                                     | Simpler than adapter; one bill, one TOS                    | Single point of vendor dependence; outage = chatbot down state-wide; pricing change risk | Adapter pattern is ~1 day extra work for permanent optionality  |
| **Gemini only**                                                     | Strong multilingual; Google has India region               | Same single-vendor risk                                                                  | Same as OpenAI-only                                             |
| **OpenAI primary + Gemini fallback**                                | Highest availability                                       | Doesn't help latency or per-tenant sensitivity choice                                    | Adapter pattern subsumes this and adds tenant-level granularity |
| **Anthropic Claude**                                                | Strong long-context; the prototype already calls Anthropic | Not requested by decision-maker; can be added as a fourth provider in v2                 | Out of scope this ADR; trivial to add later                     |
| **Self-hosted Llama 3.1 70B on managed GPU (e.g. Runpod, vast.ai)** | Compromise between sovereignty and quality                 | Adds vendor + regulatory complexity (data leaves India); costs $$$                       | Defeats the point either way                                    |

## Consequences

### Positive

- **Time-to-pilot drops by months** — no GPU procurement on the critical path.
- **Higher chatbot quality** at launch; better Bengali handling.
- **Lower v1 cost** at pilot volume (~₹0.50–₹2 per query at 2026 prices for `gpt-4o-mini`).
- **Reversible**: when GPU capacity becomes available, set `LLM_PROVIDER=ollama` and the platform behaves identically.
- **Per-tenant flexibility**: a security-conscious tenant can pin their config to `ollama` even while others use hosted.
- **Vendor-risk hedged** by adapter — provider outage = config change, not a rewrite.

### Negative / costs

- **Sovereignty pillar lost for inference** — must be acknowledged in `AGENT.md` §2, `ARCHITECTURE.md` §1, `docs/charter.md` §3 / §8.
- **DPDP compliance work**: redaction layer, audit table, consent UI, Data Processing Agreement on file with each provider, designated Data Protection Officer.
- **Cross-border-transfer disclosure** required in privacy policy — must be drafted by legal/compliance counsel before pilot.
- **Operational dependence** on third-party uptime (OpenAI: 99.9 % SLA at scale; Gemini: similar).
- **Cost variability** at state-wide rollout. A 100-ULB rollout with average 50 chatbot queries / day / 1 % MAU could be ₹10–25 lakh / month. Monitoring + budget caps are mandatory, not optional.
- **Pricing change risk** — providers can reprice or change TOS unilaterally.
- **Data-egress dependency** — air-gapped on-prem deployment becomes impossible while hosted-API is the active provider.

### Neutral / follow-ups required

- **Phase 7 deliverable change**: implement `ILLMProvider` adapter + 3 implementations + redaction layer + audit + cost telemetry. Net effort similar to the original Ollama-only scope.
- **Phase 0 follow-up**: privacy-policy draft including cross-border disclosure (legal counsel input).
- **Phase 0 follow-up**: data-processing-agreement (DPA) signed with OpenAI and Google before pilot.
- **Phase 1 follow-up**: chatbot consent UI on first session — explicit "your queries are processed by OpenAI / Google; PII is redacted before transmission" with an opt-out (offline-fallback to KB-search-only).
- **Phase 11 follow-up**: revisit when state-wide query volume crosses N (TBD); decide whether to bring inference back on-prem with procured GPUs.
- **Documentation**: charter §3 / §8, AGENT.md §2 / §4, ARCHITECTURE.md §1 / §4 updated in the same PR as this ADR.

## Compliance / verification

- **CI test** (`tests/security/redaction.spec.ts`): the redaction layer correctly strips 25+ adversarial PII fixtures including obfuscated Aadhaar, multilingual addresses, and split-token mobile numbers.
- **CI test** (`tests/integration/llm-adapter.spec.ts`): every `ILLMProvider` implementation passes the same conformance suite (streaming, error handling, token counting, health check).
- **Runtime guard**: chatbot service refuses to call any provider for which the DPA flag is not set in `tenants.config.chatbot.dpa_signed`. This forces operational discipline.
- **Audit assertion**: every chatbot session has matching entries in `chatbot_audit_log`. Sample-audited daily by a job; missing entries page on-call.
- **Cost guard**: BullMQ scheduled job at midnight aggregates token usage and posts a Slack/email alert if any tenant has exceeded 80 % of monthly budget.

## References

- Replaces `ARCHITECTURE.md` §1 row 6 (LLM Inference) and supplements §4 (RAG pipeline)
- Affects `AGENT.md` §2 pillar 3 (Sovereign by default)
- Affects `docs/charter.md` §3 O3 (Sovereign infrastructure KPI) and §8 (Constraints / Sovereignty)
- DPDP Act 2023 §16 (Cross-border data transfer)
- OpenAI Enterprise privacy: <https://openai.com/enterprise-privacy>
- Google Cloud Gemini data-handling: <https://cloud.google.com/gemini/docs/discover/data-governance>
