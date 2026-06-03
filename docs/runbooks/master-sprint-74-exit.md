# Master Sprint 7.4 Exit — Sahayak UI, consent & feedback

**Status:** **closed — engineering** (2026-05-26). Sponsor sign-off optional.  
**Plan:** [`master-sprint-74-plan.md`](./master-sprint-74-plan.md) · Depends on [**7.3 closed**](./master-sprint-73-exit.md)

## Delivered (engineering)

| ID  | Deliverable                                                   | Evidence                                            |
| --- | ------------------------------------------------------------- | --------------------------------------------------- |
| D1  | Consent + feedback types                                      | `packages/types/src/chatbot.ts`                     |
| D2  | `chatbot_consents`, `chatbot_feedback`                        | migration `20260528120000_*`                        |
| D3  | `GET/POST /api/chatbot/consent`, `POST /api/chatbot/feedback` | controller + services                               |
| D4  | KB-only path (no LLM)                                         | `kb-only-reply.ts`, `chatbot.service.ts`            |
| D5  | PWA Sahayak UI + SSE client                                   | `sahayak-workspace.tsx`, `lib/chatbot-*.ts`         |
| D6  | PWA hub/workspace **Sahayak** tab                             | `app/page.tsx`                                      |
| D7  | Mobile Sahayak screen                                         | `SahayakChatScreen.tsx`, `chatbotApi.ts`            |
| D8  | Mobile hub/workspace entry                                    | `CitizenHubScreen`, `WorkspaceScreen`, `hubTabs.ts` |
| D9  | Unit tests                                                    | API + PWA `chatbot-sse.spec.ts`                     |
| D10 | Security contract                                             | `master-sprint-74.spec.ts`                          |

## Exit criteria

| ID  | Criterion                   | Pass | Evidence                                              |
| --- | --------------------------- | ---- | ----------------------------------------------------- |
| E1  | API + PWA typecheck + tests | ✅   | `pnpm --filter @enagar/api test` · `citizen-pwa` jest |
| E2  | Security spec               | ✅   | `master-sprint-74.spec.ts`                            |
| E3  | Consent API                 | ✅   | `chatbot-consent.service.spec.ts`                     |
| E4  | Feedback API                | ✅   | `chatbot-feedback.service.ts` + controller            |
| E5  | KB-only without LLM         | ✅   | `chatbot.service.spec.ts`                             |
| E6  | PWA consent + chat UI       | ✅   | `sahayak-workspace.tsx`                               |
| E7  | Mobile navigator            | ✅   | `SahayakChat` route                                   |
| E8  | Guardrails (7.3)            | ✅   | `guardrails.spec.ts` unchanged green                  |

## Verification commands

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-74.spec.ts

# Manual: sign in on PWA → hub or ULB workspace → Sahayak tab → accept consent → ask question
# Requires API + rag-indexer + CHATBOT_DPA_SKIP_DEV or seeded dpa_signed
```

## Phase 7 engineering complete

Sprints **7.1–7.4** deliver indexer, LLM adapter, query pipeline, and citizen UI.

**Master phase exit:** [`phase-7-exit.md`](./phase-7-exit.md) (**closed 2026-06-03**).

**Optional VM pilot:** [`phase-7-vm-pilot-plan.md`](./phase-7-vm-pilot-plan.md) · [`phase-7-vm-pilot-exit.md`](./phase-7-vm-pilot-exit.md).

**Deferred:** Prometheus / State Super-Admin cost dashboard (sponsor deferred). Production **legal DPA** with OpenAI/Google remains a sponsor gate outside VM demo (`dpa_signed` in seed is demo-only).
