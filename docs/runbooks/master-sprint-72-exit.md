# Master Sprint 7.2 Exit — LLM adapter, PII redaction & audit

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.  
**Plan:** [`master-sprint-72-plan.md`](./master-sprint-72-plan.md) · Depends on [**7.1 closed**](./master-sprint-71-exit.md)

## Delivered (engineering)

| ID  | Deliverable                          | Evidence                                                           |
| --- | ------------------------------------ | ------------------------------------------------------------------ |
| D1  | `ILLMProvider` contract              | `packages/types/src/llm.ts`                                        |
| D2  | PII redact + restore                 | `apps/api/src/modules/chatbot/redaction.ts`                        |
| D3  | Audit persist + query hash           | `apps/api/src/modules/chatbot/audit.ts`                            |
| D4  | OpenAI / Gemini / Ollama providers   | `apps/api/src/modules/chatbot/providers/`                          |
| D5  | Factory + DPA guard + env precedence | `chatbot-llm.service.ts`                                           |
| D6  | `chatbot_audit_logs` + Prisma model  | migration `20260526120000_*`, `schema.prisma`                      |
| D7  | `GET /api/chatbot/llm/health`        | `chatbot.controller.ts`                                            |
| D8  | Adversarial redaction tests (≥25)    | `redaction.spec.ts`                                                |
| D9  | Provider conformance (mock fetch)    | `llm-provider.conformance.spec.ts`                                 |
| D10 | Security contracts                   | `tests/security/master-sprint-72.spec.ts`, `pii-redaction.spec.ts` |
| D11 | Env docs                             | `infrastructure/.env.example`                                      |

## Exit criteria

| ID  | Criterion                      | Pass | Evidence                                       |
| --- | ------------------------------ | ---- | ---------------------------------------------- |
| E1  | `@enagar/api` typecheck + test | ✅   | `pnpm --filter @enagar/api typecheck` · `test` |
| E2  | Security specs                 | ✅   | `master-sprint-72` · `pii-redaction`           |
| E3  | Redaction ≥25 cases            | ✅   | `redaction.spec.ts`                            |
| E4  | Three providers conformance    | ✅   | `llm-provider.conformance.spec.ts`             |
| E5  | DPA guard + dev skip           | ✅   | `chatbot-llm.service.spec.ts`                  |
| E6  | Audit hash only, no raw query  | ✅   | migration + `audit.spec.ts`                    |
| E7  | LLM health route               | ✅   | `GET /api/chatbot/llm/health?tenant_code=KMC`  |

## Verification commands

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-72.spec.ts
pnpm test:security -- --runTestsByPath tests/security/pii-redaction.spec.ts
curl -s "http://localhost:3001/api/chatbot/llm/health?tenant_code=KMC"
```

## Out of scope (unchanged)

- `POST /chatbot/query` SSE, Qdrant retrieval, guardrails, consent UI (**7.3** / **7.4**)

## Next

**Sprint 7.3** — RAG query pipeline + `POST /chatbot/query` ([`ROADMAP.md`](../../ROADMAP.md)).
