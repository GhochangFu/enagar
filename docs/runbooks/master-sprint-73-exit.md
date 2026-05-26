# Master Sprint 7.3 Exit — Chatbot RAG query pipeline & SSE

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.  
**Plan:** [`master-sprint-73-plan.md`](./master-sprint-73-plan.md) · Depends on [**7.2 closed**](./master-sprint-72-exit.md)

## Delivered (engineering)

| ID  | Deliverable                            | Evidence                                                      |
| --- | -------------------------------------- | ------------------------------------------------------------- |
| D1  | Chatbot SSE types                      | `packages/types/src/chatbot.ts`                               |
| D2  | RAG retrieval client                   | `rag-retrieval.service.ts`                                    |
| D3  | Guardrails + language detect           | `guardrails.ts`, `language.ts`                                |
| D4  | Prompt + citizen context               | `prompt.ts`, `chatbot-context.service.ts`                     |
| D5  | `POST /api/chatbot/query` SSE          | `chatbot.service.ts`, `chatbot.controller.ts`                 |
| D6  | Session tables                         | `20260527120000_chatbot_sessions`                             |
| D7  | `GET /api/chatbot/history/:session_id` | `chatbot.controller.ts`                                       |
| D8  | Provider failover                      | `chatbot-llm.service.ts`, `CHATBOT_FALLBACK_PROVIDER`         |
| D9  | Seed `chatbot.dpa_signed`              | `prisma/seed.ts`                                              |
| D10 | Unit tests                             | `guardrails`, `rag-retrieval`, `chatbot.service`, `llm` specs |
| D11 | Security + smoke                       | `master-sprint-73.spec.ts`, `smoke-sprint-73-chatbot.mjs`     |
| D12 | Env docs                               | `infrastructure/.env.example`                                 |

## Exit criteria

| ID  | Criterion                  | Pass | Evidence                                                               |
| --- | -------------------------- | ---- | ---------------------------------------------------------------------- |
| E1  | typecheck + chatbot tests  | ✅   | `pnpm --filter @enagar/api typecheck` · jest `chatbot`                 |
| E2  | Security spec              | ✅   | `master-sprint-73.spec.ts`                                             |
| E3  | SSE meta + token + done    | ✅   | `chatbot.service.spec.ts`                                              |
| E4  | Guardrails injection suite | ✅   | `guardrails.spec.ts`                                                   |
| E5  | RAG `/search` client       | ✅   | `rag-retrieval.service.spec.ts`                                        |
| E6  | History + audit on stream  | ✅   | Prisma models + service persistence                                    |
| E7  | Failover env               | ✅   | `chatbot-llm.service.spec.ts`                                          |
| E8  | Smoke RAG Bengali slug     | ✅   | `node scripts/smoke-sprint-73-chatbot.mjs` (RAG leg; SSE needs bearer) |

## Verification commands

```bash
pnpm infra:up
pnpm db:seed
cd services/rag-indexer && poetry run uvicorn enagar_rag_indexer.main:app --port 8100
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api dev

node scripts/smoke-sprint-73-chatbot.mjs
# Full SSE leg:
# SMOKE_CHATBOT_BEARER=<citizen-jwt> node scripts/smoke-sprint-73-chatbot.mjs

pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-73.spec.ts
```

## Out of scope (7.4)

- PWA / mobile Sahayak UI, consent screen, `POST /chatbot/feedback`
- Prometheus cost dashboards

## Next

**Sprint 7.4** — Citizen UI + consent + feedback loop ([`ROADMAP.md`](../../ROADMAP.md)).
