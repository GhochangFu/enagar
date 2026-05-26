# Master Sprint 7.3 Plan — Chatbot RAG query pipeline & SSE

**Status:** **closed — engineering** · Exit: [`master-sprint-73-exit.md`](./master-sprint-73-exit.md)  
**Phase:** 7 — Sahayak AI · Depends on [**7.2 closed**](./master-sprint-72-exit.md), [**7.1 closed**](./master-sprint-71-exit.md)  
**ADR:** [`ADR-0008`](../ADRs/ADR-0008-llm-provider-adapter.md)

## Objective

Wire the **end-to-end Sahayak query path** in NestJS: citizen `POST /api/chatbot/query` → RAG retrieval (rag-indexer) → context augmentation → guardrails → PII redaction → `ILLMProvider.stream()` → SSE to client, with session history and provider failover.

## Deliverables

| #   | Deliverable                            | Location                                                  |
| --- | -------------------------------------- | --------------------------------------------------------- |
| D1  | Chatbot SSE + query types              | `packages/types/src/chatbot.ts`                           |
| D2  | RAG retrieval client                   | `rag-retrieval.service.ts`                                |
| D3  | Guardrails + language detect           | `guardrails.ts`, `language.ts`                            |
| D4  | Prompt builder + citizen context       | `prompt.ts`, `chatbot-context.service.ts`                 |
| D5  | Query orchestration + SSE              | `chatbot.service.ts`, `chatbot.controller.ts`             |
| D6  | Session history tables                 | `chatbot_sessions`, `chatbot_messages` migration          |
| D7  | `GET /api/chatbot/history/:session_id` | `chatbot.controller.ts`                                   |
| D8  | Provider failover                      | `chatbot-llm.service.ts` + env                            |
| D9  | Seed `chatbot` tenant config (dev)     | `prisma/seed.ts`                                          |
| D10 | Unit + integration tests               | `*.spec.ts` under `chatbot/`                              |
| D11 | Security contract + smoke              | `master-sprint-73.spec.ts`, `smoke-sprint-73-chatbot.mjs` |
| D12 | Env docs                               | `infrastructure/.env.example`                             |

## Out of scope (7.4)

- Mobile / PWA chat UI, consent screen, thumbs feedback API
- Prometheus `/metrics` counters (token counts land in `chatbot_audit_logs` only)
- BM25 hybrid rerank in indexer
- Personalised application narrative E2E fixture (covered by context builder unit test)

## Exit criteria

| ID  | Criterion                                                             | Verification                                     |
| --- | --------------------------------------------------------------------- | ------------------------------------------------ |
| E1  | `pnpm --filter @enagar/api typecheck` + `test` green                  | CI / local                                       |
| E2  | `pnpm test:security` — `master-sprint-73`                             | Repo root                                        |
| E3  | `POST /api/chatbot/query` returns SSE `meta` + `token` + `done`       | Unit test (mocked RAG + LLM)                     |
| E4  | Guardrails block injection fixtures 100 %                             | `guardrails.spec.ts`                             |
| E5  | RAG client calls `RAG_INDEXER_URL/search` with tenant scope           | `rag-retrieval.service.spec.ts`                  |
| E6  | History persisted (redacted user text); audit row on completion       | DB + unit test                                   |
| E7  | Failover to `CHATBOT_FALLBACK_PROVIDER` when primary throws           | `chatbot-llm.service.spec.ts`                    |
| E8  | Smoke: Bengali query returns citation slug `help-services-birth-cert` | `smoke-sprint-73-chatbot.mjs` (indexer + API up) |

## Verification

```bash
pnpm infra:up
pnpm db:seed
cd services/rag-indexer && poetry run uvicorn enagar_rag_indexer.main:app --port 8100
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api dev
node scripts/smoke-sprint-73-chatbot.mjs
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-73.spec.ts
```
