# Master Sprint 7.4 Plan — Sahayak UI, consent & feedback

**Status:** **closed — engineering** · Exit: [`master-sprint-74-exit.md`](./master-sprint-74-exit.md)  
**Phase:** 7 — Sahayak AI · Depends on [**7.3 closed**](./master-sprint-73-exit.md)  
**ADR:** [`ADR-0008`](../ADRs/ADR-0008-llm-provider-adapter.md)

## Objective

Ship **citizen-facing Sahayak** on PWA and mobile: gradient chat UI wired to `POST /api/chatbot/query` (SSE), **first-session consent** (LLM vs KB-only), **thumbs feedback**, and security contracts. Reuse 7.3 guardrails; no Prometheus dashboard (deferred).

## Deliverables

| #   | Deliverable                               | Location                                                                |
| --- | ----------------------------------------- | ----------------------------------------------------------------------- |
| D1  | Consent + feedback types                  | `packages/types/src/chatbot.ts`                                         |
| D2  | `chatbot_consents`, `chatbot_feedback`    | Prisma migration + models                                               |
| D3  | Consent + feedback API                    | `chatbot-consent.service.ts`, `chatbot-feedback.service.ts`, controller |
| D4  | KB-only query path (no LLM egress)        | `chatbot.service.ts`                                                    |
| D5  | PWA SSE client + Sahayak workspace        | `lib/chatbot-sse.ts`, `components/sahayak-workspace.tsx`                |
| D6  | PWA hub/workspace **Sahayak** tab         | `app/page.tsx`                                                          |
| D7  | Mobile chat screen + API                  | `api/chatbotApi.ts`, `screens/sahayak/SahayakChatScreen.tsx`            |
| D8  | Mobile navigation + hub entry             | `CitizenNavigator`, `CitizenHubScreen`, `hubTabs.ts`                    |
| D9  | Unit tests (SSE parse, consent, feedback) | `*.spec.ts`                                                             |
| D10 | Security contract + smoke notes           | `master-sprint-74.spec.ts`                                              |

## Out of scope

- Voice input, WhatsApp channel (Phase 12)
- State Super-Admin cost dashboard / Prometheus (Phase 7 follow-up)
- Full E2E Playwright against live LLM (manual smoke with bearer token)

## Exit criteria

| ID  | Criterion                                                    | Verification                |
| --- | ------------------------------------------------------------ | --------------------------- |
| E1  | `@enagar/api` + `@enagar/citizen-pwa` typecheck + test       | CI / local                  |
| E2  | `pnpm test:security` — `master-sprint-74`                    | Repo root                   |
| E3  | `GET/POST /api/chatbot/consent` persisted per tenant+citizen | Unit test                   |
| E4  | `POST /api/chatbot/feedback` stores rating                   | Unit test                   |
| E5  | KB-only mode streams without `streamWithAudit`               | `chatbot.service.spec.ts`   |
| E6  | PWA Sahayak tab renders consent + chat                       | Component + SSE parser spec |
| E7  | Mobile `SahayakChat` screen registered                       | Security spec + navigator   |
| E8  | Adversarial guardrails still pass (7.3 suite unchanged)      | `guardrails.spec.ts`        |

## Verification

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-74.spec.ts
```
