# eNagarSeba

> A unified, multi-tenant, multilingual municipal services platform for the Government of West Bengal.
> Built once. Deployed everywhere. Owned by the state.

[![Status](https://img.shields.io/badge/status-Phase_0-blue)]()
[![License](https://img.shields.io/badge/license-AGPL--3.0-green)]()
[![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20Next.js%20%7C%20Expo%20%7C%20Postgres%20%7C%20Qdrant-informational)]()

---

## What this is

A single application that lets every Urban Local Body (ULB) in West Bengal — Municipal Corporations, Municipalities, Notified Area Authorities — deliver citizen services digitally:

- **Apply** for any of 76+ services (certificates, licences, taxes, water, health, welfare, advertising, bookings, smart-city, tenders, fines, RTI…).
- **Pay** instantly via UPI, card, net-banking, or wallet.
- **Track** every application with a docket number and a live SLA timer.
- **Complain** with photo + GPS + auto-routing to the right department.
- **Ask Sahayak AI** — a multilingual RAG chatbot grounded in each tenant's actual rules and the citizen's own application history. Retrieval is on-prem (Qdrant + local embeddings); inference uses an `ILLMProvider` adapter with OpenAI / Gemini in production and Ollama as a fallback ([ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md)). PII is redacted at the boundary.

All in **English, Bengali, and Hindi**, on a phone or in a browser.

Each municipality is a **tenant**: its own services, fees, SLAs, workflows, branding — configured by an admin in a portal, never in code.

## Why it exists

- **For citizens**: one app for every service in your municipality, in your language, on your phone.
- **For municipalities**: stop maintaining bespoke vendor websites; configure your services and watch them ship.
- **For the state**: a single, observable, sovereign platform with state-wide analytics and a path to SLA-driven governance.

## Documentation

| Document                               | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| [`docs/charter.md`](./docs/charter.md) | Vision, KPIs, scope, risks, sponsor sign-off             |
| [`AGENT.md`](./AGENT.md)               | Operating manual for any contributor (human or AI)       |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Technical architecture (multi-tenancy, RLS, RAG, schema) |
| [`ROADMAP.md`](./ROADMAP.md)           | Phase-wise delivery plan                                 |
| [`docs/ADRs/`](./docs/ADRs/)           | Ratified architecture decisions                          |
| `docs/glossary.md`                     | _Coming Sprint 0.2_                                      |
| `docs/security/threat-model.md`        | _Coming Sprint 0.2_                                      |

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  Citizen PWA   │  Citizen Mobile (RN)  │  Field Officer App │
└─────────┬─────────────────┬─────────────────────┬───────────┘
          │                 │                     │
          └─────────────────┼─────────────────────┘
                            │  HTTPS / JWT
                  ┌─────────▼──────────┐
                  │   Tenant Admin     │
                  │   State Super-Admin│
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │  NestJS API Gateway│   ← OpenAPI → typed SDK
                  │  (sets app.tenant_id from JWT)
                  └─────────┬──────────┘
                            │
   ┌─────────┬──────────┬───┴─────┬──────────┬──────────┬─────────────┐
   │Postgres │  Redis   │ MinIO   │ BullMQ   │ Keycloak │ Qdrant      │
   │  + RLS  │  Cache   │ (files) │  Queue   │  (auth)  │ (on-prem)   │
   └─────────┴──────────┴─────────┴──────────┴──────────┴──────┬──────┘
                                                                │
                                                  ┌─────────────▼──────────────┐
                                                  │ ILLMProvider (PII-redacted)│
                                                  │  OpenAI │ Gemini │ Ollama  │
                                                  └────────────────────────────┘
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full picture.

## Tech stack (ratified ADRs)

| Layer            | Choice                                                            | ADR                                                      |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Database         | PostgreSQL 16 (RLS, JSONB, GiST)                                  | [ADR-0001](./docs/ADRs/ADR-0001-database-postgresql.md)  |
| Backend          | NestJS / Node 20 / TypeScript                                     | [ADR-0002](./docs/ADRs/ADR-0002-backend-nestjs.md)       |
| Citizen surfaces | Next.js PWA + React Native (Expo) — both                          | [ADR-0003](./docs/ADRs/ADR-0003-mobile-pwa-parallel.md)  |
| Hosting          | On-prem WB State Data Centre (cloud-portable IaC)                 | [ADR-0005](./docs/ADRs/ADR-0005-hosting-onprem.md)       |
| LLM (chatbot)    | `ILLMProvider` adapter — OpenAI / Gemini in prod, Ollama optional | [ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md) |
| Vector DB        | Qdrant                                                            | _per ARCHITECTURE.md_                                    |
| Identity         | Keycloak                                                          | _per ARCHITECTURE.md_                                    |
| Object store     | MinIO                                                             | _per ARCHITECTURE.md_                                    |
| Cache / Queue    | Redis + BullMQ                                                    | _per ARCHITECTURE.md_                                    |

## Quickstart

> Phase 0 is in progress. The infrastructure runs today; app scaffolds arrive in the next batch.

### Prerequisites

- **Node.js 20 LTS** (use `nvm` or `fnm`)
- **PNPM 9+** (`npm install -g pnpm@9`)
- **Docker** (with Compose v2)
- **Git**
- ~5 GB free disk for default volumes (Postgres + MinIO + Qdrant). Add ~5 GB more if you bring up the optional Ollama profile for offline LLM dev.

### Bring up local infrastructure

```bash
# 1. Configure environment
cp infrastructure/.env.example infrastructure/.env
# Edit infrastructure/.env: passwords, LLM_PROVIDER, OPENAI_API_KEY / GEMINI_API_KEY

# 2. Start the default stack (Postgres, Redis, MinIO, Keycloak, Qdrant, Meilisearch, Mailhog)
pnpm infra:up

# 3. Tail logs
pnpm infra:logs
```

#### Optional: offline LLM development with Ollama

If you want to develop without API keys (or run the chatbot fully offline), bring up the `offline-llm` profile:

```bash
# Boot stack including Ollama
pnpm infra:up:offline

# (One-time) pull the model into Ollama (~4.7 GB)
pnpm infra:pull-llm

# Then set in your .env:
#   LLM_PROVIDER=ollama
```

What you get:

| Service                                    | URL                      | Default credentials    |
| ------------------------------------------ | ------------------------ | ---------------------- |
| Postgres                                   | `localhost:5432`         | from `.env`            |
| Redis                                      | `localhost:6379`         | from `.env`            |
| MinIO API                                  | `http://localhost:9000`  | from `.env`            |
| MinIO Console                              | `http://localhost:9001`  | from `.env`            |
| Keycloak                                   | `http://localhost:8080`  | from `.env`            |
| Qdrant                                     | `http://localhost:6333`  | none                   |
| Meilisearch                                | `http://localhost:7700`  | master key from `.env` |
| Mailhog UI                                 | `http://localhost:8025`  | none                   |
| Ollama (optional, `--profile offline-llm`) | `http://localhost:11434` | none                   |

### Stop / reset

```bash
pnpm infra:down       # stop containers, keep volumes
pnpm infra:reset      # stop AND wipe volumes (destroys all dev data)
```

### Application development

After `pnpm install`, every app and package is wired up:

```bash
pnpm install                              # install all workspace deps
pnpm dev                                  # run every dev server in parallel (turbo)
pnpm --filter @enagar/api dev             # just the NestJS API → http://localhost:3001
pnpm --filter @enagar/citizen-pwa dev     # just the citizen PWA → http://localhost:3000

pnpm lint                                 # lint everything (max-warnings=0)
pnpm typecheck                            # type-check everything
pnpm test                                 # unit tests across the monorepo
pnpm test:security                        # cross-tenant isolation guards (Phase 1+)
pnpm format                               # prettier write
```

Smoke-test endpoints (after Batch 2):

| What          | Where                           |
| ------------- | ------------------------------- |
| API health    | `http://localhost:3001/health`  |
| API liveness  | `http://localhost:3001/healthz` |
| API readiness | `http://localhost:3001/ready`   |
| Swagger UI    | `http://localhost:3001/docs`    |
| Citizen PWA   | `http://localhost:3000`         |

## Repository layout

```
enagarseba/
├── apps/
│   ├── api/                    # NestJS backend (port 3001)
│   ├── citizen-pwa/            # Next.js 14 PWA (port 3000)
│   ├── admin-tenant/           # ULB admin portal (port 3002)        — stub, Phase 6
│   ├── admin-state/            # State super-admin portal (port 3003) — stub, Phase 6
│   ├── mobile/                 # Citizen RN/Expo app                  — stub, Phase 5/8
│   └── staff-mobile/           # Field-staff RN/Expo app              — stub, Phase 4
├── packages/
│   ├── config/                 # ESLint + tsconfig + Tailwind presets
│   ├── types/                  # Shared domain types + ILLMProvider contract
│   ├── sdk/                    # Generated API client                 — stub, Phase 1
│   ├── forms/                  # JSON-Schema form runtime             — stub, Phase 2
│   ├── i18n/                   # en/bn/hi translation runtime         — stub, Phase 2
│   ├── ui/                     # Web UI primitives                    — stub, Phase 2
│   ├── ui-native/              # RN UI primitives                     — stub, Phase 5
│   ├── tenant-theme/           # Per-tenant runtime theming           — stub, Phase 1
│   └── workflow/               # Workflow / state-machine types       — stub, Phase 2
├── services/
│   ├── workflow-engine/        # BullMQ runner                        — stub, Phase 2
│   ├── notification-worker/    # SMS/email/WhatsApp/push fan-out      — stub, Phase 1/2
│   ├── reporting-worker/       # Scheduled reports + MV refreshes     — stub, Phase 6
│   └── rag-indexer/            # Python · FastAPI · Qdrant indexer    — stub, Phase 7
├── infrastructure/             # docker-compose, env, seed (helm/terraform: Phase 9)
├── tests/security/             # Cross-cutting tenant-isolation guards
└── docs/                       # Charter, ADRs (00x), glossary, threat model
```

## Contributing

Read [`AGENT.md`](./AGENT.md) before opening a PR. The TL;DR is:

1. Multi-tenancy first. Every tenant-scoped query carries `tenant_id`.
2. Plug-and-play. New services / municipalities are data, not code.
3. Open-source-first stack. Data sovereignty for storage / identity / vector KB; hosted-API LLM with PII redaction at the boundary (ADR-0008).
4. Three-language parity (en / bn / hi) from day one.
5. Audit log on every state change.
6. RLS is enforced and CI-checked.
7. Definition of Done is in `AGENT.md` §9.

## Licence

AGPL-3.0-or-later. © Government of West Bengal.

## Status

**Phase 0 — Foundation & Discovery** in progress. See [`ROADMAP.md`](./ROADMAP.md).

---

_Made for the citizens of West Bengal. Open-source, sovereign, free forever._
