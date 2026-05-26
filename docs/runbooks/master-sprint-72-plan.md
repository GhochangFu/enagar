# Master Sprint 7.2 Plan — LLM adapter, PII redaction & audit

**Status:** **closed — engineering** · Exit: [`master-sprint-72-exit.md`](./master-sprint-72-exit.md)  
**Phase:** 7 — Sahayak AI · Depends on [**7.1 closed**](./master-sprint-71-exit.md)  
**ADR:** [`ADR-0008`](../ADRs/ADR-0008-llm-provider-adapter.md)

## Objective

Ship the **provider boundary** for Sahayak: `ILLMProvider` implementations (OpenAI, Gemini, Ollama), **mandatory PII redaction** before any egress, and **audit logging** (query hash only, never raw text). No citizen chat UI or RAG query pipeline yet (**7.3**).

## Deliverables

| #   | Deliverable                                          | Location                                                           |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| D1  | Contract (existing)                                  | `packages/types/src/llm.ts`                                        |
| D2  | PII redact + restore                                 | `apps/api/src/modules/chatbot/redaction.ts`                        |
| D3  | Audit persist + query hash                           | `apps/api/src/modules/chatbot/audit.ts`                            |
| D4  | `OpenAIProvider`, `GeminiProvider`, `OllamaProvider` | `apps/api/src/modules/chatbot/providers/`                          |
| D5  | Factory + DPA guard + env precedence                 | `chatbot-llm.service.ts`                                           |
| D6  | `chatbot_audit_logs` migration + Prisma model        | `prisma/migrations/…`, `schema.prisma`                             |
| D7  | Dev health route `GET /api/chatbot/llm/health`       | `chatbot.controller.ts`                                            |
| D8  | Adversarial redaction tests (≥25)                    | `redaction.spec.ts`                                                |
| D9  | Provider conformance tests (mock fetch)              | `llm-provider.conformance.spec.ts`                                 |
| D10 | Security contract                                    | `tests/security/master-sprint-72.spec.ts`, `pii-redaction.spec.ts` |
| D11 | Env docs                                             | `infrastructure/.env.example`                                      |

## Out of scope (7.3 / 7.4)

- `POST /chatbot/query` SSE, Qdrant retrieval, guardrails, consent UI, Prometheus cost counters

## Exit criteria

| ID  | Criterion                                                                   | Verification                       |
| --- | --------------------------------------------------------------------------- | ---------------------------------- |
| E1  | `pnpm --filter @enagar/api typecheck` + `test` green                        | CI / local                         |
| E2  | `pnpm test:security` — `master-sprint-72` + `pii-redaction`                 | Repo root                          |
| E3  | Redaction suite ≥25 cases, 100% pass                                        | `redaction.spec.ts`                |
| E4  | All three providers pass conformance (stream + health, mocked HTTP)         | `llm-provider.conformance.spec.ts` |
| E5  | DPA guard blocks provider when `dpa_signed !== true` (unless dev skip flag) | Unit test                          |
| E6  | Audit row written with `query_hash`, no raw query column                    | Schema + unit test                 |
| E7  | `GET /api/chatbot/llm/health` returns active provider name                  | curl / smoke                       |

## Verification

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-72.spec.ts
pnpm test:security -- --runTestsByPath tests/security/pii-redaction.spec.ts
```
