# eNagarSeba

> A unified, multi-tenant, multilingual municipal services platform for the Government of West Bengal.
> Built once. Deployed everywhere. Owned by the state.

[![Status](https://img.shields.io/badge/status-Phase_8_in_progress-blue)]()
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

| Document                                                                                                     | Purpose                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/charter.md`](./docs/charter.md)                                                                       | Vision, KPIs, scope, risks, sponsor sign-off                                                                                                                                        |
| [`docs/help/start-the-app-step-by-step.md`](./docs/help/start-the-app-step-by-step.md)                       | Beginner walkthrough — prerequisites, Docker, DB migrate/seed, run API + citizen PWA, dev OTP                                                                                       |
| [`AGENT.md`](./AGENT.md)                                                                                     | Operating manual for any contributor (human or AI)                                                                                                                                  |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                                                                       | Technical architecture (multi-tenancy, RLS, RAG, schema)                                                                                                                            |
| [`ROADMAP.md`](./ROADMAP.md)                                                                                 | Phase-wise delivery plan + **Citizen Unified Hub** programme (`H*.` sprints); [execution spine](./ROADMAP.md#execution-spine-master-phases--citizen-unified-hub)                    |
| [`docs/ADRs/`](./docs/ADRs/)                                                                                 | Ratified and proposed architecture decisions (ADR-0001 … ADR-0010)                                                                                                                  |
| [`docs/glossary.md`](./docs/glossary.md)                                                                     | Canonical vocabulary — entities, statuses, revenue heads, roles, anti-patterns                                                                                                      |
| [`docs/security/threat-model.md`](./docs/security/threat-model.md)                                           | STRIDE pass + security backlog                                                                                                                                                      |
| [`docs/service-catalogue.md`](./docs/service-catalogue.md)                                                   | 76 services, 6 workflow patterns, fee/SLA rules, ID formats, Phase-2 seed plan                                                                                                      |
| [`docs/design-system.md`](./docs/design-system.md)                                                           | Tokens, multi-tenant theming, component inventory, wireframes for the 6 critical flows                                                                                              |
| [`docs/runbooks/citizen-unified-hub.md`](./docs/runbooks/citizen-unified-hub.md)                             | Citizen **hub** (Option A): `X-Enagar-Tenant-Code`, aggregate vs workspace reads, **`GET /citizen/dashboard`** behaviour & logs (Hub **H6.1**)                                      |
| [`docs/runbooks/hub-h6-exit-checklist.md`](./docs/runbooks/hub-h6-exit-checklist.md)                         | Hub programme **H6.1** product/engineering exit checklist                                                                                                                           |
| [`docs/runbooks/master-sprint-66-exit.md`](./docs/runbooks/master-sprint-66-exit.md)                         | Phase 6 catalogue alignment: citizen PWA/mobile consume DB-published tenant services and forms                                                                                      |
| [`docs/runbooks/master-sprint-67-exit.md`](./docs/runbooks/master-sprint-67-exit.md)                         | Phase 6 designer polish: Tenant Admin drag/drop form palette and React Flow workflow canvas                                                                                         |
| [`docs/runbooks/master-sprint-68-exit.md`](./docs/runbooks/master-sprint-68-exit.md)                         | Phase 6 P1 operator polish: banners, guided fee/document config, and notification-template preview                                                                                  |
| [`docs/runbooks/master-sprint-69-plan.md`](./docs/runbooks/master-sprint-69-plan.md)                         | Phase 6 P2 sprint plan: dashboard depth, CSV exports, address bulk import, audit search, and tenant drill-down                                                                      |
| [`docs/runbooks/master-sprint-69-exit.md`](./docs/runbooks/master-sprint-69-exit.md)                         | Phase 6 P2 engineering exit: Tenant Admin reporting/bulk ops and State Admin visibility                                                                                             |
| [`docs/runbooks/master-sprint-610-plan.md`](./docs/runbooks/master-sprint-610-plan.md)                       | Phase 6 P3 sprint plan: masters UX parity, catalogue governance, workflow escalation, analytics v2, and transparency pack                                                           |
| [`docs/runbooks/master-sprint-610-exit.md`](./docs/runbooks/master-sprint-610-exit.md)                       | Phase 6 P3 engineering exit: catalogue governance, workflow depth, state analytics v2, and public transparency                                                                      |
| [`docs/runbooks/master-sprint-611-plan.md`](./docs/runbooks/master-sprint-611-plan.md)                       | Phase 6 P4 sprint plan: PDF reports, rich KB authoring, RAG index triggers, branding assets, and bookable assets/calendar MVP                                                       |
| [`docs/runbooks/master-sprint-611-exit.md`](./docs/runbooks/master-sprint-611-exit.md)                       | Phase 6 P4 engineering exit: PDF reports, KB/RAG hooks, branding asset pipeline, and bookings MVP                                                                                   |
| [`docs/runbooks/master-sprint-612-plan.md`](./docs/runbooks/master-sprint-612-plan.md)                       | Phase 6 P5 sprint plan: staff invites, global service library, integration cockpit, and audit/onboarding hardening                                                                  |
| [`docs/runbooks/master-sprint-612-exit.md`](./docs/runbooks/master-sprint-612-exit.md)                       | Phase 6 P5 engineering exit: identity lifecycle, state library curation, metadata-only integrations, and hardening                                                                  |
| [`docs/runbooks/object-storage-upload-programme.md`](./docs/runbooks/object-storage-upload-programme.md)     | Upload programme **6.25–6.30** (MinIO presign, real citizen uploads) — **closed engineering 2026-05-21** ([`master-sprint-630-exit.md`](./docs/runbooks/master-sprint-630-exit.md)) |
| [`docs/runbooks/phase-7-exit.md`](./docs/runbooks/phase-7-exit.md)                                           | **Phase 7 — Sahayak AI** programme exit (RAG, LLM adapter, citizen chatbot) — **closed engineering 2026-06-03**                                                                     |
| [`docs/runbooks/master-sprint-81-exit.md`](./docs/runbooks/master-sprint-81-exit.md)                         | **Sprint 8.1** — hourly bookings calendar, deposit linkage, citizen booking UI, desk sync — **closed 2026-06-03**                                                                   |
| [`docs/backlog/phase-6-vision-backlog-prioritized.md`](./docs/backlog/phase-6-vision-backlog-prioritized.md) | Phase 6 **roadmap vs shipped** backlog, **prioritized execution order** for optional 6.8+ / hardening slices                                                                        |

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

> Phases **0–7** are closed in-repo (through **Sahayak AI**). **Phase 8 — Bookings, Smart-City & Tenders** is in progress (**Sprint 8.1** closed 2026-06-03). Bring up infra, migrate/seed, then run the portals and API as below.

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
# Defaults include PAYMENT_STORE_PROVIDER=postgres (required for booking stub payments).

# 2. Start the default stack (Postgres, Redis, MinIO, Keycloak, Qdrant, Meilisearch, Mailhog)
pnpm infra:up

# Optional (dev): dummy Keycloak users — all roles × each ULB + portal citizen (see docs/runbooks/keycloak.md §7)
pnpm infra:seed-keycloak-users

# 3. Seed DB-backed tenant services + published citizen forms
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed

# 4. Tail logs
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
pnpm dev:portals                          # API + citizen PWA + tenant + state admin only
pnpm --filter @enagar/api dev             # just the NestJS API → http://localhost:3001
pnpm --filter @enagar/citizen-pwa dev     # just the citizen PWA → http://localhost:3000
pnpm --filter @enagar/admin-tenant dev    # Tenant Admin portal → http://localhost:3002
pnpm --filter @enagar/admin-state dev     # State Super-Admin portal → http://localhost:3003

pnpm lint                                 # lint everything (max-warnings=0)
pnpm typecheck                            # type-check everything
pnpm test                                 # unit tests across the monorepo
pnpm test:security                        # tenant, identity, onboarding, and security contract tests
pnpm security:zap:auth                    # OWASP ZAP API scan for auth endpoints
pnpm format                               # prettier write
```

Smoke-test endpoints:

| What          | Where                                          |
| ------------- | ---------------------------------------------- |
| API health    | `http://localhost:3001/health`                 |
| API liveness  | `http://localhost:3001/healthz`                |
| API readiness | `http://localhost:3001/ready`                  |
| Swagger UI    | `http://localhost:3001/docs`                   |
| Tenant list   | `http://localhost:3001/api/tenants`            |
| Tenant config | `http://localhost:3001/api/tenants/KMC/config` |
| Citizen PWA   | `http://localhost:3000`                        |
| Tenant Admin  | `http://localhost:3002`                        |
| State Admin   | `http://localhost:3003`                        |

## Repository layout

```
enagarseba/
├── apps/
│   ├── api/                    # NestJS backend (port 3001)
│   ├── citizen-pwa/            # Next.js 14 PWA (port 3000)
│   ├── admin-tenant/           # ULB admin portal (port 3002) — catalogue, designer, fee/doc/master config
│   ├── admin-state/            # State super-admin portal (port 3003) — onboarding, support, analytics
│   ├── mobile/                 # Citizen RN/Expo app                  — stub, Phase 5/8
│   └── staff-mobile/           # Field-staff RN/Expo app              — stub, Phase 4
├── packages/
│   ├── config/                 # ESLint + tsconfig + Tailwind presets
│   ├── types/                  # Shared domain types + ILLMProvider contract
│   ├── sdk/                    # Typed API client package             — automation continues in Phase 2
│   ├── forms/                  # JSON-Schema form runtime             — stub, Phase 2
│   ├── i18n/                   # en/bn/hi translation runtime
│   ├── ui/                     # Web UI primitives                    — stub, Phase 2
│   ├── ui-native/              # RN UI primitives                     — stub, Phase 5
│   ├── tenant-theme/           # Per-tenant runtime theming
│   └── workflow/               # Workflow / state-machine types       — stub, Phase 2
├── services/
│   ├── workflow-engine/        # BullMQ runner                        — stub, Phase 2
│   ├── notification-worker/    # SMS/email/WhatsApp/push fan-out      — stub, Phase 2+
│   ├── reporting-worker/       # Scheduled reports + MV refreshes     — stub, Phase 6
│   └── rag-indexer/            # Python · FastAPI · Qdrant indexer    — stub, Phase 7
├── infrastructure/             # docker-compose, env, seed (helm/terraform: Phase 9)
├── tests/security/             # Cross-cutting security contract tests
└── docs/                       # Charter, ADRs (00x), glossary, threat model
```

## Source repositories

The same `main` branch is maintained on two remotes:

| Remote   | URL                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `origin` | [github.com/GhochangFu/enagar](https://github.com/GhochangFu/enagar)                                             |
| `gitlab` | [gitlab.euphoriainfotech.com/.../enagar](https://gitlab.euphoriainfotech.com/eiipl-learnings/eiipl-india/enagar) |

After each merge to `main`, push both remotes to keep them aligned:

```bash
git push origin main
git push gitlab main
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

_Last updated: 2026-06-05 · authoritative detail in [`ROADMAP.md`](./ROADMAP.md)_

### In progress

**Phase 8 — Bookings, Smart-City & Tenders** ([`ROADMAP.md` § Phase 8](./ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Jira [EN-10](https://ghochangfu.atlassian.net/browse/EN-10))

- **Sprint 8.1 — closed 2026-06-03** — [`master-sprint-81-exit.md`](./docs/runbooks/master-sprint-81-exit.md) · Jira [EN-15](https://ghochangfu.atlassian.net/browse/EN-15) **Done**
  - Hourly slot grid, deposit linkage, confirmation PDF, citizen `BookingWorkspace`, desk `review-slot` sync
  - Tenant Admin Operations → Bookings (assets, availability, calendar) and service-designer asset mapping
  - KMC `community-hall` and `other-facility-booking` services; mapping saves **DB asset codes only** (no stale catalogue placeholders)
- **Next:** Sprint **8.2** (smart-city modules and tender workflows per Phase 8 plan)

### Closed (engineering)

| Phase / programme                  | Closed     | Highlights                                                                                                                                                                          |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Foundation**                 | 2026-05-06 | Monorepo, CI, charter, ADRs, glossary, threat model, service catalogue                                                                                                              |
| **1 — Tenant & identity**          | 2026-05-07 | Postgres RLS, Keycloak, citizen OTP → tenant, i18n, theming, onboarding CLI                                                                                                         |
| **2 — Service & workflow**         | 2026-05-07 | Catalogue, application intake, workflow engine (Sprints 2.1–2.6)                                                                                                                    |
| **3 — Payments (stub rail)**       | 2026-05-11 | Stub payment rail, receipts, finance hooks — **Sprint 3.1B** (real PSP) **deferred**                                                                                                |
| **4 — Grievances & SLA**           | 2026-05-14 | Citizen grievance tab, SLA engine, breach inbox, public KPI slices                                                                                                                  |
| **5 — Citizen mobile + PWA**       | 2026-05-15 | Expo shell, native apply, PWA forms spine, push/deep links, Lighthouse CI                                                                                                           |
| **6 — Admin portals**              | 2026-05-16 | Tenant + State admin, designer, desk, reporting, bookings MVP seed                                                                                                                  |
| **Phase UX (6.14–6.20)**           | 2026-05-19 | **Tricolor Calm** cross-portal revamp — [`phase-ux-revamp-plan.md`](./docs/runbooks/phase-ux-revamp-plan.md)                                                                        |
| **Grievance taxonomy (6.21–6.24)** | 2026-05-20 | Configurable categories, state library — [`grievance-taxonomy-programme.md`](./docs/runbooks/grievance-taxonomy-programme.md)                                                       |
| **Upload programme (6.25–6.30)**   | 2026-05-21 | MinIO presign, `application_documents`, virus scan, grievance evidence                                                                                                              |
| **7 — Sahayak AI**                 | 2026-06-03 | RAG indexer, `ILLMProvider`, chatbot API + citizen UI — [`phase-7-exit.md`](./docs/runbooks/phase-7-exit.md) · Jira [EN-14](https://ghochangfu.atlassian.net/browse/EN-14) **Done** |

### Deferred / blocked

- **Sprint 3.1B** — real payment-gateway adapter + webhooks (PSP sandbox credentials)
- **Hub H5.1** — Keycloak Option A on staging/prod + staff bootstrap (repo slice done; realm deploy pending)
- **Phase 7 production** — DPA with OpenAI/Google; Prometheus cost dashboard

---

_Made for the citizens of West Bengal. Open-source, sovereign, free forever._
