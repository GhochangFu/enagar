# Phase 7 VM pilot plan — Sahayak on demosites.co.in

**Status:** **active** (engineering 7.1–7.4 closed; this plan closes **VM pilot** without Prometheus).  
**Exit:** [`phase-7-vm-pilot-exit.md`](./phase-7-vm-pilot-exit.md)  
**VM base:** [`unified-portal-vm-setup-beginner.md`](./unified-portal-vm-setup-beginner.md)  
**ADR:** [`ADR-0008`](../ADRs/ADR-0008-llm-provider-adapter.md)

## Objective

Run **Sahayak AI** on the **demo VM** alongside the unified portal (Caddy + citizen PWA + API), with RAG search and chat working for at least one ULB (e.g. **KMC**). Close Phase 7 **engineering pilot** on the VM.

## In scope

| #   | Deliverable                    | Notes                                                                                                         |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| D1  | **Prometheus cost dashboard**  | **Deferred** — not required for VM pilot                                                                      |
| D2  | VM env for RAG + chatbot       | Merge into `infrastructure/.env` — see § Environment                                                          |
| D3  | Qdrant + RAG indexer on VM     | Qdrant via `pnpm infra:up`; indexer Python process on `:8100`                                                 |
| D4  | KB index for pilot ULBs        | `POST /index/tenant-all` or per-tenant                                                                        |
| D5  | LLM on VM                      | **Option A:** `OPENAI_API_KEY` on VM · **Option B:** `pnpm infra:up:offline` + Ollama + `LLM_PROVIDER=ollama` |
| D6  | Citizen Sahayak smoke          | FAB → consent → Bengali/English query + grievance count                                                       |
| D7  | Automated smoke (laptop or VM) | `node scripts/smoke-phase-7-vm-pilot.mjs`                                                                     |
| D8  | Manual QA rows                 | [`unified-portal-manual-qa.md`](./unified-portal-manual-qa.md) § G                                            |
| D9  | Help doc cross-link            | [`start-the-app-step-by-step.md`](../help/start-the-app-step-by-step.md) § Phase 7                            |

## Out of scope (this pilot)

- State Super-Admin **Prometheus / token cost panel** (deferred indefinitely until sponsor asks)
- Sponsor **legal DPA** with OpenAI/Google — VM uses **seeded `dpa_signed: true`** for demo; production needs real DPA
- DOCX/PDF loaders in indexer (roadmap scope; KB markdown + services snapshot sufficient for pilot)
- Mobile app VM build (PWA on `enagarcitizen` is enough for demo)

## Environment (merge into `infrastructure/.env` on VM)

```env
# ---- Sahayak / RAG (Phase 7 VM) ----
RAG_INDEXER_URL=http://127.0.0.1:8100
RAG_INDEXER_PORT=8100
QDRANT_URL=http://127.0.0.1:6333

# LLM — pick one profile:
# Profile A (cloud, needs key):
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# Profile B (on-prem, no egress):
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.1:8b

# Demo VM: seed already sets tenants.config.chatbot.dpa_signed — do not set CHATBOT_DPA_SKIP_DEV in prod-like VM unless debugging
# CHATBOT_RAG_TOP_K=5
```

Reference: `infrastructure/.env.production.example` (Sahayak block).

## VM procedure (summary)

1. Complete unified portal Steps 1–8 ([`unified-portal-vm-setup-beginner.md`](./unified-portal-vm-setup-beginner.md)).
2. **Step 8c — Sahayak stack** (this plan):
   - Confirm Qdrant healthy: `docker ps` → `enagar-qdrant`
   - Start RAG indexer (new PowerShell window):

     ```powershell
     cd c:\projects\enagar
     pnpm rag:dev
     ```

   - Index KB:

     ```powershell
     curl -X POST http://127.0.0.1:8100/index/tenant-all
     ```

   - Restart API after env merge.
   - Optional offline LLM: `pnpm infra:up:offline` then `pnpm infra:pull-llm`

3. Caddy + HTTPS smoke (portal runbook Steps 9–12).
4. Browser: citizen host → sign in → pin **KMC** → **Sahayak FAB** → consent → test queries.
5. Run [`phase-7-vm-pilot-exit.md`](./phase-7-vm-pilot-exit.md) checklist.

## Verification commands

```powershell
cd c:\projects\enagar
node scripts/smoke-phase-7-vm-pilot.mjs
# Optional full chat SSE (needs citizen JWT):
# $env:SMOKE_CHATBOT_BEARER = "<token>"
# node scripts/smoke-sprint-73-chatbot.mjs
```

## Sponsor items (non-blocking for VM demo)

| Item                    | VM workaround                                   |
| ----------------------- | ----------------------------------------------- |
| DPA with OpenAI/Google  | `dpa_signed: true` in seed for operational ULBs |
| Charter sign-off        | Track in ROADMAP open items                     |
| P95 &lt; 3s Bengali E2E | Measure manually on VM; no Prometheus           |

## After exit

- Mark Phase 7 VM pilot closed in [`phase-7-vm-pilot-exit.md`](./phase-7-vm-pilot-exit.md).
- Next **feature** sprint on roadmap: **Phase 8 / Sprint 8.1** (bookings) when sponsor prioritises it.
