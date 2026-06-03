# Phase 7 VM pilot exit — Sahayak (no Prometheus)

**Status:** optional VM pilot checklist (repo **Phase 7** closed **2026-06-03** per [`phase-7-exit.md`](./phase-7-exit.md)). Use on the **demo VM** after [`phase-7-vm-pilot-plan.md`](./phase-7-vm-pilot-plan.md).  
**Prometheus / cost dashboard:** **deferred** — not part of this exit.

## Prerequisites

- [ ] Unified portal base: [`unified-portal-option-a-exit.md`](./unified-portal-option-a-exit.md) hub + citizen HTTPS (or documented exceptions)
- [ ] `pnpm infra:up` (includes **Qdrant**)
- [ ] `prisma:migrate:deploy` + `pnpm db:seed` (chatbot tables + `dpa_signed` on operational ULBs)
- [ ] RAG indexer running on `127.0.0.1:8100`
- [ ] `infrastructure/.env` includes `RAG_INDEXER_URL` and LLM profile (OpenAI key **or** Ollama offline)

## Automated smoke

| ID  | Command                                        | Pass                                        |
| --- | ---------------------------------------------- | ------------------------------------------- |
| S1  | `node scripts/smoke-phase-7-vm-pilot.mjs`      | RAG health + search; API chatbot LLM health |
| S2  | `node scripts/smoke-sprint-71-rag-indexer.mjs` | Indexer + Qdrant points (optional full)     |

## Manual citizen smoke (HTTPS)

| ID  | Steps                                                             | Pass                                                                 |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| M1  | `https://enagarcitizen.demosites.co.in` → OTP login → pin **KMC** | Session OK                                                           |
| M2  | Bottom-right **Sahayak** FAB visible on hub/workspace             | Opens drawer                                                         |
| M3  | First open → accept consent (AI-assisted or KB-only)              | Chat input enabled                                                   |
| M4  | Ask (EN): `How do I apply for a birth certificate?`               | Streamed reply + KB citations                                        |
| M5  | Ask (BN): `আমি কীভাবে জন্ম সার্টিফিকেট পাবো?`                     | Reply in Bengali or mixed; cites birth help                          |
| M6  | Ask: `How many grievances have I filed under KMC?`                | Exact count from account data (not “I don’t know”) if profile linked |
| M7  | Thumbs up/down on a reply                                         | No error banner                                                      |

## Engineering regression (laptop or VM)

```bash
pnpm --filter @enagar/api test -- --testPathPattern=chatbot
pnpm test:security -- --runTestsByPath tests/security/master-sprint-74.spec.ts
```

## Explicitly deferred (do not fail exit)

| Item                                    | Notes                                      |
| --------------------------------------- | ------------------------------------------ |
| Prometheus `llm_tokens_total` dashboard | Sponsor deferred                           |
| State Super-Admin cost panel            | Same                                       |
| Signed OpenAI/Google DPA                | Production gate; VM uses seed `dpa_signed` |
| Full adversarial red-team in production | CI suites already green in-repo            |

## Sign-off

| Tester | Date | LLM profile (OpenAI / Ollama) | S1  | M1–M7 | Notes |
| ------ | ---- | ----------------------------- | --- | ----- | ----- |
|        |      |                               |     |       |       |

When all required rows pass, Phase 7 **VM pilot** is **closed**. Phase 8 (bookings) may start per [`ROADMAP.md`](../../ROADMAP.md).
