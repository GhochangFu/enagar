# AGENT.md — eNagarSeba Multi-Tenant Municipal Services Platform

> **Operating manual for any AI coding agent (or human contributor) working on this repository.**
> Read this file before touching anything else. It is the single source of truth for _how_ we build, _what_ the boundaries are, and _which decisions are settled vs. open_.

---

## 1. Project at a Glance

**Product**: A unified, multi-tenant citizen services platform for **all West Bengal Urban Local Bodies (ULBs)** — Municipal Corporations, Municipalities, Notified Area Authorities — delivered as:

| Surface                                           | Purpose                                                                       | Primary Users                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| **Citizen Mobile App** (React Native + Expo)      | Apply, pay, track, complain, chat                                             | Citizens                                     |
| **Citizen PWA**                                   | Same flows on web / kiosks / shared phones                                    | Citizens, CSC operators                      |
| **Tenant Admin Portal** (Next.js)                 | Per-municipality configuration, staff, dashboards                             | Municipal staff & Commissioner               |
| **State Super-Admin Portal** (Next.js)            | Onboard municipalities, curate global service library, cross-tenant analytics | DoUD&MA, State IT                            |
| **Staff / Field Officer App** (Expo, scoped role) | Inspections, challans, status updates from the field                          | Inspectors, Sanitation officers, Enforcement |

**One backend, one database, many tenants.** Each municipality is an isolated tenant in the same Postgres instance, segregated by `tenant_id` + Row-Level Security. Adding a new ULB is an admin action — **never a code change.**

**Branding promise**: `eNagarSeba` as the unifying state-level brand, but every screen renders in the active tenant's logo, theme color, language, and service catalogue.

---

## 2. Pillars (Non-Negotiables)

1. **Multi-tenancy first.** Every tenant-scoped query _must_ be filtered by `tenant_id`. Postgres RLS is the safety net, not the only line of defence — application code must also pass the JWT-derived `tenant_id` explicitly.
2. **Plug-and-play configuration.** Onboarding a new municipality, enabling a service, changing a fee, or rewriting a workflow is a **data change**, not a code change. If we ever find ourselves writing a `switch (tenant)` we have already failed.
3. **Data sovereignty for storage; pragmatic adapter for AI inference.** Citizen PII (Postgres + RLS), files (MinIO), identity (Keycloak), and the vector knowledge base (Qdrant) all stay on government infrastructure inside India — non-negotiable. **AI inference (chatbot) is the deliberate exception** per [ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md): a provider-adapter (`ILLMProvider`) routes to OpenAI / Gemini in production, with on-prem Ollama as a fallback option (per-tenant override or full migration). PII is **redacted before any prompt leaves the platform boundary**, and every call is audited.
4. **Open-source only.** MIT / Apache 2.0 / BSD / PostgreSQL / Llama Community licence. Total recurring software licence cost: **₹0**.
5. **Mobile-first, accessible.** Designed for a Tier-3 ward citizen on a 2-year-old Android with patchy 4G — not a designer on a Macbook. WCAG 2.1 AA, three languages (English, Bengali, Hindi), large tap targets, offline-capable forms.
6. **Citizen experience > internal politics.** Wherever a municipality wants a different fee or workflow, we configure it; we do not fragment the codebase to accommodate it.
7. **Auditable always.** Every state change is logged — who, when, what, why — and is queryable for years.

---

## 3. Repository Layout (Target)

This repo is a PNPM + Turborepo monorepo. Phase 0 established the workspace, and Phase 1 added the tenant and identity core:

```
enagarseba/
├── apps/
│   ├── mobile/                # React Native + Expo (citizen)
│   ├── citizen-pwa/           # Next.js (citizen web/kiosk) — derived from current prototype
│   ├── admin-state/           # Next.js — State super-admin portal
│   ├── admin-tenant/          # Next.js — Per-municipality admin portal
│   ├── staff-mobile/          # Expo — Field officer / inspector app (scoped roles)
│   └── api/                   # NestJS API + worker entry points
│
├── services/
│   ├── rag-indexer/           # Python — KB chunking, embeddings, Qdrant upsert
│   ├── workflow-engine/       # NestJS micro-service or Camunda (TBR Phase 0)
│   ├── notification-worker/   # BullMQ consumers — push / SMS / email / WhatsApp
│   └── reporting-worker/      # PDF / CSV / receipt generation
│
├── packages/
│   ├── ui/                    # Shared design-system components (web)
│   ├── ui-native/             # Mirrored RN components (NativeWind)
│   ├── forms/                 # JSON-Schema-based form *builder* + *renderer*
│   ├── workflow/              # Stage / state-machine schema + visualiser
│   ├── i18n/                  # en / bn / hi message catalogues + helpers
│   ├── sdk/                   # Typed API client auto-generated from OpenAPI
│   ├── types/                 # Shared domain types (Tenant, Service, Application…)
│   ├── config/                # Eslint / Prettier / TS / Tailwind presets
│   └── tenant-theme/          # Runtime theming utility (CSS vars from tenant.theme_color)
│
├── infrastructure/
│   ├── docker-compose.yml     # Local dev: postgres, redis, qdrant, ollama, minio, keycloak, mailhog
│   ├── helm/                  # K8s charts for state-wide rollout
│   ├── terraform/             # Cloud-agnostic IaC (state cloud / on-prem / Azure)
│   └── seed/                  # Seed data: 8 sample tenants + global service library
│
└── docs/
    ├── AGENT.md               # ← this file
    ├── ARCHITECTURE.md        # technical design (already exists)
    ├── ROADMAP.md             # phase-wise delivery plan
    ├── API.md                 # OpenAPI spec
    ├── ADRs/                  # Architecture Decision Records
    └── playbooks/             # On-call, DR, tenant-onboarding runbooks
```

---

## 4. Technology Stack (Settled by ARCHITECTURE.md, summarised here)

| Layer                     | Choice                                                                                                                                                     | Why                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Mobile                    | React Native + Expo                                                                                                                                        | Single codebase, OTA updates, mature in WB talent pool                        |
| Citizen PWA               | Next.js 14 App Router                                                                                                                                      | SEO, kiosk mode, shareable deep links                                         |
| Admin portals             | Next.js 14 + shadcn/ui                                                                                                                                     | Same component library, fast iteration                                        |
| Backend API               | NestJS (Node 20, TypeScript)                                                                                                                               | Modular, OpenAPI-friendly, RBAC guards                                        |
| ORM                       | Prisma                                                                                                                                                     | Type-safe, migrations, plays well with RLS                                    |
| DB                        | PostgreSQL 16                                                                                                                                              | RLS, JSONB, GiST exclusion for bookings, full-text                            |
| Cache / Queue             | Redis + BullMQ                                                                                                                                             | OTP throttling, jobs                                                          |
| Search                    | Meilisearch                                                                                                                                                | Typo-tolerant Bengali + English                                               |
| Vector DB                 | Qdrant                                                                                                                                                     | Per-tenant collections, HNSW                                                  |
| LLM (chatbot)             | **`ILLMProvider` adapter** → OpenAI (`gpt-4o-mini` / `gpt-4o`) or Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`); Ollama (`llama3.1:8b`) optional fallback | Per-env / per-tenant; PII redacted before egress (ADR-0008)                   |
| Embeddings                | `paraphrase-multilingual-MiniLM-L12-v2` (on-prem, CPU)                                                                                                     | Bengali + Hindi + English; runs locally — embeddings never leave the platform |
| Identity                  | Keycloak                                                                                                                                                   | OIDC, MFA, DigiLocker integration                                             |
| Object Store              | MinIO                                                                                                                                                      | S3-compatible on-prem                                                         |
| Reverse Proxy             | Caddy / Nginx                                                                                                                                              | TLS, rate-limit                                                               |
| Observability             | Grafana + Prometheus + Loki                                                                                                                                | Per-tenant dashboards                                                         |
| Container / Orchestration | Docker Compose (dev) → K8s (prod)                                                                                                                          | Standard cloud-native                                                         |
| CI/CD                     | GitHub Actions                                                                                                                                             | Trivy scan, Renovate bot, semantic-release                                    |

**State management (clients)**: Zustand for ephemeral UI state; **TanStack Query** for server state.
**Forms (clients)**: `react-hook-form` + **Zod** schemas generated from the JSON-Schema dictated by the tenant config.
**Validation (server)**: NestJS `class-validator` + Zod parity for `form_schema` payloads.
**Styling**: Tailwind CSS on web; **NativeWind** on RN — same utility class names everywhere.
**Icons**: Lucide (already used in the prototype).

---

## 5. The Plug-and-Play Tenant Configuration Model

This is the system's defining capability. It must be designed correctly _before_ any service-specific code is written.

### 5.1 Layered service catalogue

```
┌──────────────────────────────────────────┐
│   Global Service Library (state-curated) │   ← read-only for tenants
│   76 services × 14 categories baseline   │
└────────────────────┬─────────────────────┘
                     │ inherit + override
┌────────────────────▼─────────────────────┐
│   Tenant Service Catalogue                │
│   • toggle on/off                         │
│   • override fee, SLA, docs, form schema  │
│   • override workflow, GL account         │
│   • bind to tenant-specific revenue head  │
└────────────────────┬─────────────────────┘
                     │ extend
┌────────────────────▼─────────────────────┐
│   Tenant-Specific Services                │
│   (services unique to this ULB)           │
└──────────────────────────────────────────┘
```

### 5.2 First-class config domains

Every one of these is a **CRUD module** in the Tenant Admin Portal, backed by a tenant-scoped table. None is hard-coded.

| Domain                        | What admin can do                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant profile**            | Name, code, district, ward count, languages enabled, helpline, theme colour, logo, hero imagery, time zone, address master               |
| **Service catalogue**         | Inherit from global, override fee/SLA/docs/form/workflow/revenue-head, add new                                                           |
| **Form-schema builder**       | Drag-drop fields (text, number, date, radio, select, multiselect, file, section, conditional logic), preview on phone frame              |
| **Workflow / stage designer** | Stages, transitions, role assignments per stage, SLA per stage, escalation rules                                                         |
| **Fee-rule engine**           | Flat / slab / zone / time-of-day / vehicle-type / built-up-area; e.g. property tax slabs, smart parking by zone, hoarding by ward × size |
| **Document checklist**        | Per service: required docs, accepted MIME types, max size, OCR hints                                                                     |
| **Bookable assets**           | Halls, auditoria, parks, grounds, equipment — base rate, deposit, blackout dates, booking rules                                          |
| **Tax / tariff master**       | Property tax slabs, water tariff, conservancy, sewerage charges, ARV table                                                               |
| **Address master**            | Wards → boroughs → mouzas → localities (used for grievance routing & self-assessment)                                                    |
| **Revenue head & GL mapping** | Bind services to revenue head codes; bind heads to GL accounts; GST flag                                                                 |
| **Notification templates**    | Push / SMS / email / WhatsApp message templates per status change, with i18n + variable substitution                                     |
| **Knowledge-Base CMS**        | Markdown / PDF articles per tenant; auto-fed to RAG indexer nightly                                                                      |
| **Staff & roles**             | Invite staff, assign roles, map roles to workflow stages                                                                                 |
| **Branding**                  | Theme colour → CSS vars, logo, splash imagery, languages enabled                                                                         |
| **Feature flags**             | `tenants.config` JSONB toggles (e.g. `chatbot.enabled`, `bookings.enabled`, `smart_city.parking.enabled`)                                |
| **Maintenance / banners**     | Schedule downtime per service, broadcast banners                                                                                         |
| **Integrations**              | Payment gateway creds (per-tenant Razorpay/PayU sub-merchant), SMS sender ID, DigiLocker config                                          |

### 5.3 What State Super-Admin owns (and tenants don't)

- Onboarding / off-boarding municipalities
- Curating the **Global Service Library**
- State-level integrations (master Aadhaar / DigiLocker / Bharat Connect / SMS DLT)
- Cross-tenant analytics, leaderboard, SLA performance benchmarking
- KB content review / approval workflow (optional)
- Audit log search across tenants
- Emergency tenant impersonation (with audit trail) for support

---

## 6. Coding Standards

### 6.1 General

- **TypeScript strict mode** everywhere (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- **No `any`.** Use `unknown` and narrow.
- **Prettier + ESLint** enforced in CI; `--max-warnings 0`.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- **Trunk-based dev.** Short-lived branches → squash-merge to `main` after PR review + green CI.
- **Every PR** must include: (a) a rationale, (b) test coverage for new logic, (c) updated docs / OpenAPI / ADR if applicable.

### 6.2 File and module limits

- **Max 600 lines per source file.** The current 2,200-line `MunicipalApp.jsx` is the cautionary tale.
- **Single responsibility** per module. Screens → components → hooks → services.
- **Domain logic NEVER lives inside React components.** Pure functions in `packages/sdk` or NestJS services.

### 6.3 Naming

- TypeScript / TSX: `camelCase` for variables, `PascalCase` for components and types, `SCREAMING_SNAKE_CASE` only for env vars.
- React component files: `PascalCase.tsx`. Hooks: `useThing.ts`.
- DB: `snake_case` tables and columns (matches the SQL in `ARCHITECTURE.md`).
- API routes: `kebab-case`.

### 6.4 Database rules

- Always use `INT IDENTITY` / `BIGINT IDENTITY` style sequential PKs **only for performance-critical hot paths**; otherwise `UUID v7` (sortable) is acceptable. ARCHITECTURE.md uses UUID v4 — we will **upgrade to UUID v7** in implementation.
- **Every tenant-scoped table has `tenant_id UUID NOT NULL`.**
- **RLS policy must exist on every tenant-scoped table** before any data is inserted. CI fails the build if a new tenant table lacks RLS.
- **No `SELECT *` in application code.** Always project columns.
- **Indexes**: every FK + every column used in `WHERE` / `ORDER BY` / `JOIN`. Use `INCLUDE` for covering indexes when payload is small.
- **Migrations are one-way**: forward-only (Prisma migrate). Down-migrations are documented in the ADR but not auto-executed.
- **Dual-write windows** are explicitly designed (e.g. when changing `services.fee` while applications are mid-flight — snapshot the fee on the application).

### 6.5 API rules

- All endpoints under `/api/v1`. Versioned forever.
- **OpenAPI spec is the contract**, generated by NestJS decorators. The TypeScript SDK in `packages/sdk` is auto-regenerated on every build.
- **JWT bearer everywhere except auth endpoints.** `tenant_id` is derived from the JWT, never from a header or query parameter.
- **Idempotency keys** required on all `POST` that create money or applications (`Idempotency-Key` header).
- **Pagination**: cursor-based (`?cursor=…&limit=…`). No `OFFSET` for large datasets.
- **Errors**: `application/problem+json` with `type`, `title`, `status`, `detail`, `tenant_id`, `request_id`.
- **Rate limit**: per-citizen via Redis sliding window. OTP: 5/hour/mobile.

### 6.6 Security

- **MASVS L2** for the mobile app — secure store for tokens, certificate pinning, no logs of PII.
- **OWASP ASVS L2** for the backend.
- **PII minimisation**: Aadhaar stored as **SHA-256 hash + last 4 digits only** for display. _Raw Aadhaar number never persists, never logs, never leaves the entry point._
- **MFA** mandatory for all staff portals.
- **CSP** strict on web portals. No inline scripts (the prototype's Babel-in-browser is dev-only and **not** the production approach).
- **Audit log** is append-only; the `application_timeline` table is fed by triggers, not application code (defence in depth).
- **Secrets** in environment variables only — never in code, never in docker-compose.yml committed to git. Use `.env.example` placeholders.

### 6.7 Tests

- **Unit**: pure functions ≥ 80 % branch coverage.
- **Integration**: every API endpoint has at least one happy-path + one auth-fail + one tenant-leak test.
- **E2E**: Playwright for PWA, Detox for RN, against `docker-compose up`.
- **Contract**: Pact between API and SDK consumers.
- **Load**: k6 — 1,000 RPS sustained on `/api/v1/services` and `/api/v1/applications`.

### 6.8 Observability

- Every log line carries `{ request_id, tenant_id, citizen_id?, route, status, duration_ms }`.
- Metrics: RED (Rate, Errors, Duration) per route + per tenant.
- Traces: OpenTelemetry → Loki / Tempo.
- Per-tenant Grafana dashboards: SLA compliance, revenue, top services, grievance heatmap.

---

## 7. ADR Status

Ratified ADRs (Phase 0 kick-off, 2026-05-06) are in `docs/ADRs/`. The agent **must not** override these without superseding them via a new ADR.

| ID       | Decision                   | Status                                    | Document                                                                                                           |
| -------- | -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ADR-0001 | Database engine            | ✅ **PostgreSQL 16**                      | [`docs/ADRs/ADR-0001-database-postgresql.md`](./docs/ADRs/ADR-0001-database-postgresql.md)                         |
| ADR-0002 | Backend framework          | ✅ **NestJS / Node 20**                   | [`docs/ADRs/ADR-0002-backend-nestjs.md`](./docs/ADRs/ADR-0002-backend-nestjs.md)                                   |
| ADR-0003 | Citizen surface sequencing | ✅ **PWA + RN in parallel**               | [`docs/ADRs/ADR-0003-mobile-pwa-parallel.md`](./docs/ADRs/ADR-0003-mobile-pwa-parallel.md)                         |
| ADR-0004 | Workflow engine            | ✅ **Postgres state machine + BullMQ**    | [`docs/ADRs/ADR-0004-workflow-engine.md`](./docs/ADRs/ADR-0004-workflow-engine.md)                                 |
| ADR-0005 | Hosting target             | ✅ **On-prem WB SDC, cloud-portable**     | [`docs/ADRs/ADR-0005-hosting-onprem.md`](./docs/ADRs/ADR-0005-hosting-onprem.md)                                   |
| ADR-0006 | Payment gateway            | ✅ **Adapter + stub-first Sprint 3.1A**   | [`docs/ADRs/ADR-0006-payment-gateway-adapter.md`](./docs/ADRs/ADR-0006-payment-gateway-adapter.md)                 |
| ADR-0007 | KB authoring format        | 🟡 Open (decide in Phase 6/7)             | _pending_                                                                                                          |
| ADR-0008 | LLM provider strategy      | ✅ **Adapter (OpenAI / Gemini / Ollama)** | [`docs/ADRs/ADR-0008-llm-provider-adapter.md`](./docs/ADRs/ADR-0008-llm-provider-adapter.md)                       |
| ADR-0009 | Identity provider          | ✅ **Keycloak (self-hosted)**             | [`docs/ADRs/ADR-0009-identity-keycloak.md`](./docs/ADRs/ADR-0009-identity-keycloak.md)                             |
| ADR-0010 | External-data adapters     | 🟦 Proposed (revisit at Phase 3 kickoff)  | [`docs/ADRs/ADR-0010-external-data-provider-adapters.md`](./docs/ADRs/ADR-0010-external-data-provider-adapters.md) |

When the agent must proceed before an open decision is ratified, do so behind an interface that allows the alternative to be plugged in (e.g. `IPaymentGateway`). The `ILLMProvider` interface from ADR-0008 — and the `IExternalDataProvider` interface from ADR-0010 — are the reference examples of this pattern.

---

## 8. How the Agent Should Work in This Repo

1. **Read first.** Always read `AGENT.md`, `ARCHITECTURE.md`, and the relevant `ROADMAP.md` phase before writing code. Read every file it intends to modify.
2. **Plan in the open.** Before non-trivial changes (3+ files or new modules), post a bullet plan: what, why, what changes, what is out of scope.
3. **Ask only when blocked.** Never guess at: tenant configuration semantics, fee calculations, who-approves-what, or which payment gateway is contracted. Ask. Never ask about: code style, file location, naming — those are settled here.
4. **Follow the layering.** Domain logic belongs in NestJS services; UI is dumb; SDK is generated. No exceptions because "it's faster".
5. **Tenant-safety check on every PR.** "Have I added a query that lacks `tenant_id`?" If yes, fix or justify in ADR.
6. **Don't ship the demo as production.** Anything from `MunicipalApp.jsx` is **prototype-quality data**, not production-quality logic. Treat it as a specification of UX, not a source for paste-and-modify.
7. **Schema before UI.** A new service / form / workflow is born as JSON-Schema in the admin portal and **flows through to mobile / PWA / staff app automatically**. If you find yourself hand-coding a service-specific React component, stop — that's a missing builder feature.
8. **One file, one PR (mostly).** Avoid mega-PRs. Split a phase into the suggested sprints (see `ROADMAP.md`). Keep diffs reviewable.
9. **Migrations are sacred.** Never edit a committed migration. Add a new one.
10. **Localisation is built-in, not bolted on.** Every user-facing string has en / bn / hi keys from day one. CI fails on missing translations.

---

## 9. Definition of Done (per feature)

A feature is **done** only when:

- [ ] OpenAPI spec updated; SDK regenerates cleanly
- [ ] Backend: unit + integration + contract tests pass
- [ ] Frontend: unit + E2E happy path + tenant-isolation test pass
- [ ] All three languages (en / bn / hi) translated; lint passes for missing keys
- [ ] Accessibility: keyboard nav, screen reader labels, contrast checked (axe-core)
- [ ] Tenant-config-driven (no service-specific code in clients)
- [ ] Audit log entries for every state change
- [ ] Observability: logs structured, metric exported, dashboard tile updated
- [ ] Docs: API.md / ADR / playbook entries updated
- [ ] Performance: P95 < 300 ms for read endpoints, < 1 s for write endpoints (under realistic load)
- [ ] Security: input validated server-side; PII not logged; RLS confirmed
- [ ] Demo / preview environment seed data updated

---

## 10. Glossary

> **Canonical vocabulary lives in [`docs/glossary.md`](./docs/glossary.md)** (Sprint 0.2 deliverable). Five terms repeated below for quick reference; everything else is in the canonical file. Conflicts are resolved by `docs/glossary.md`.

- **ULB** — Urban Local Body (the formal term for a municipality / corporation in Indian governance).
- **Tenant** — One ULB. Each tenant has its own data, services, workflows, fees, KB, branding, staff.
- **Docket** — A citizen's grievance reference number (e.g. `GRV/KMC/2026/SAN/4421`).
- **Holding number** — Property's municipal identifier; the primary key for property tax / water / conservancy.
- **Sahayak AI** — The product name of the citizen chatbot. _eNagarSeba_ is the product name of the platform.

---

## 11. Quick Links

- Charter (vision, KPIs, scope): [`docs/charter.md`](./docs/charter.md)
- Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Roadmap: [`ROADMAP.md`](./ROADMAP.md)
- Glossary: [`docs/glossary.md`](./docs/glossary.md)
- Threat model + Phase-1 security tests: [`docs/security/threat-model.md`](./docs/security/threat-model.md)
- Service catalogue (76 services, ID formats, seed plan): [`docs/service-catalogue.md`](./docs/service-catalogue.md)
- Design system (tokens, theming, wireframes): [`docs/design-system.md`](./docs/design-system.md)
- ADRs: [`docs/ADRs/`](./docs/ADRs/)
- API spec: Swagger/OpenAPI is served by `apps/api` at `/docs` and `/docs-json`; SDK generation automation continues in Phase 2.
- Prototype reference (UX only): [`index.html`](./index.html), [`MunicipalApp.jsx`](./MunicipalApp.jsx)

---

_If anything in this file conflicts with a future ADR, the ADR wins and this file gets updated in the same PR._
