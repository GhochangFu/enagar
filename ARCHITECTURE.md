# West Bengal Municipal Services App — Technical Architecture

A multi-tenant, mobile-first integrated services platform serving all West Bengal Municipalities through a single application. Each municipality operates as an isolated tenant with its own services, fee structure, SLAs, workflows, and branding.

---

## 1. Open-Source Stack Rationale

Every component is permissively licensed (MIT / Apache 2.0 / BSD) and self-hostable on government infrastructure. No SaaS dependencies, no per-seat licensing, no data leaving Indian soil.

| Layer                   | Technology                                                                                                                                                                                                                                        | License                                     | Why this choice                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile Frontend         | React Native + Expo                                                                                                                                                                                                                               | MIT                                         | Single codebase for Android + iOS, hot reload, large ecosystem, easier to hire for than Flutter in the WB talent pool                                                                                                        |
| Backend Framework       | NestJS (Node.js)                                                                                                                                                                                                                                  | MIT                                         | Modular architecture maps cleanly to per-municipality tenancy; TypeScript end-to-end with the frontend                                                                                                                       |
| Primary Database        | PostgreSQL 16                                                                                                                                                                                                                                     | PostgreSQL License (BSD-style)              | Row-Level Security (RLS) provides ironclad tenant isolation at the database layer, not just application layer                                                                                                                |
| Vector Database         | Qdrant                                                                                                                                                                                                                                            | Apache 2.0                                  | Self-hosted, fast HNSW index, supports per-tenant collections for chatbot RAG                                                                                                                                                |
| LLM Inference           | **`ILLMProvider` adapter** (per [ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md)) — OpenAI (`gpt-4o-mini` / `gpt-4o`) or Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`) in production; Ollama (`llama3.1:8b` / Mistral) optional fallback | Provider TOS / Apache 2.0 / Llama Community | Higher quality multilingual responses, no GPU procurement on critical path. **PII is redacted before any prompt leaves the platform**, per ADR-0008. Per-tenant override allows sensitivity-conscious ULBs to pin to Ollama. |
| Embeddings              | sentence-transformers/all-MiniLM-L6-v2                                                                                                                                                                                                            | Apache 2.0                                  | 384-dim vectors, runs on CPU, supports Bengali via multilingual variants                                                                                                                                                     |
| Identity & Auth         | Keycloak                                                                                                                                                                                                                                          | Apache 2.0                                  | Built-in OIDC, supports Aadhaar via DigiLocker integration, MFA, social login                                                                                                                                                |
| Object Storage          | MinIO                                                                                                                                                                                                                                             | AGPL v3                                     | S3-compatible API, on-premise, encrypted at rest — for documents, photos, certificates                                                                                                                                       |
| Cache & Queue           | Redis + BullMQ                                                                                                                                                                                                                                    | BSD-3 / MIT                                 | OTP rate limiting, background job processing (PDF generation, SMS dispatch)                                                                                                                                                  |
| Search                  | Meilisearch                                                                                                                                                                                                                                       | MIT                                         | Typo-tolerant search across services and FAQs in English and Bengali                                                                                                                                                         |
| Monitoring              | Grafana + Prometheus + Loki                                                                                                                                                                                                                       | AGPL / Apache 2.0                           | Per-tenant dashboards, SLA tracking                                                                                                                                                                                          |
| Reverse Proxy           | Nginx / Caddy                                                                                                                                                                                                                                     | BSD / Apache 2.0                            | TLS termination, rate limiting                                                                                                                                                                                               |
| Container Orchestration | Docker Compose (small deployments) → Kubernetes (state-wide rollout)                                                                                                                                                                              | Apache 2.0                                  | Standard cloud-native stack                                                                                                                                                                                                  |

**Total recurring software license cost: ₹0** for self-hosted components. Hosted-LLM inference (OpenAI / Gemini) is the deliberate exception per ADR-0008 — usage-priced, not licensed; per-tenant cost telemetry tracks it.

---

## 2. System Architecture

```
                            ┌──────────────────────┐
                            │   Citizens (Mobile)  │
                            │  React Native + Expo │
                            └──────────┬───────────┘
                                       │ HTTPS
                                       ▼
                            ┌──────────────────────┐
                            │  Nginx / Caddy       │
                            │  (TLS, rate limit)   │
                            └──────────┬───────────┘
                                       │
                            ┌──────────▼───────────┐
                            │   NestJS API Gateway │
                            │   (JWT verification) │
                            └──────────┬───────────┘
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
       ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
       │ Citizen Service │    │ Workflow Engine │    │  Chatbot RAG    │
       │   (NestJS)      │    │   (NestJS)      │    │   Service       │
       └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                │                      │                      │
        ┌───────┼──────────────────────┼──────────────────────┼───────┐
        │       │                      │                      │       │
   ┌────▼───┐ ┌─▼─────┐ ┌──────────┐ ┌─▼─────┐ ┌────────┐ ┌───▼────┐ ┌─▼──────────┐
   │Postgres│ │ Redis │ │ MinIO    │ │BullMQ │ │Keycloak│ │ Qdrant │ │ILLMProvider│
   │ + RLS  │ │ Cache │ │ (files)  │ │Queue  │ │ (auth) │ │(vector)│ │  Adapter   │
   └────────┘ └───────┘ └──────────┘ └───────┘ └────────┘ └────────┘ └─────┬──────┘
                                       │                                   │  PII-redacted
                                ┌──────▼──────┐                            │  prompts only
                                │  External   │              ┌─────────────▼──────────────┐
                                │  Gateways   │              │  OpenAI │ Gemini │ Ollama  │
                                │  (SMS, UPI, │              │  (per env / per tenant)    │
                                │   DigiLocker│              └────────────────────────────┘
                                │   Aadhaar)  │
                                └─────────────┘
```

---

## 3. Multi-Tenant Database Design

The single most important architectural decision: every tenant-scoped table carries a `tenant_id` column, and PostgreSQL Row-Level Security policies enforce isolation. Application code cannot accidentally leak one municipality's data to another.

### Core Schema

```sql
-- Tenants (municipalities)
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) UNIQUE NOT NULL,        -- 'KMC', 'HMC'
    name            VARCHAR(255) NOT NULL,
    district        VARCHAR(100),
    ward_count      INTEGER,
    theme_color     VARCHAR(7),
    logo_url        TEXT,
    config          JSONB,                              -- per-tenant feature flags
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Citizens
CREATE TABLE citizens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    mobile          VARCHAR(15) NOT NULL,
    aadhaar_hash    VARCHAR(64),                        -- hashed, never raw
    name            VARCHAR(255),
    address         JSONB,
    ward            VARCHAR(20),
    holding_number  VARCHAR(50),
    language_pref   VARCHAR(5) DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, mobile)
);

-- Service catalogue (varies per tenant)
CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            VARCHAR(50),                        -- 'BIRTH_CERT'
    category        VARCHAR(50),
    name_en         VARCHAR(255),
    name_bn         VARCHAR(255),
    name_hi         VARCHAR(255),
    description     JSONB,                              -- {en, bn, hi}
    fee_amount      NUMERIC(10,2),
    sla_days        INTEGER,
    form_schema     JSONB,                              -- dynamic form definition
    workflow_id     UUID,                               -- which approval chain
    required_docs   JSONB,
    is_active       BOOLEAN DEFAULT true
);

-- Applications (dockets)
CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    citizen_id      UUID NOT NULL REFERENCES citizens(id),
    service_id      UUID NOT NULL REFERENCES services(id),
    docket_no       VARCHAR(50) UNIQUE NOT NULL,        -- 'KMC-2026-BC-00123'
    form_data       JSONB,
    current_status  VARCHAR(50),
    current_stage   VARCHAR(100),
    payment_status  VARCHAR(20),
    payment_ref     VARCHAR(100),
    submitted_at    TIMESTAMPTZ,
    sla_due_at      TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ
);

CREATE TABLE application_timeline (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id),
    tenant_id       UUID NOT NULL,
    stage           VARCHAR(100),
    status          VARCHAR(50),
    actor_role      VARCHAR(50),
    actor_id        UUID,
    remarks         TEXT,
    occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Grievances
CREATE TABLE grievances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    citizen_id      UUID NOT NULL REFERENCES citizens(id),
    grievance_no    VARCHAR(50) UNIQUE NOT NULL,
    category        VARCHAR(50),
    description     TEXT,
    location        JSONB,                              -- {lat, lng, address, ward}
    photos          JSONB,                              -- array of MinIO keys
    priority        VARCHAR(10),
    status          VARCHAR(30),
    assigned_to     UUID,
    sla_hours       INTEGER,
    rating          INTEGER,
    feedback        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

-- Payments
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    citizen_id      UUID NOT NULL REFERENCES citizens(id),
    application_id  UUID REFERENCES applications(id),
    amount          NUMERIC(10,2) NOT NULL,
    method          VARCHAR(20),                        -- UPI, CARD, NB
    gateway         VARCHAR(20),                        -- razorpay, payu, etc.
    gateway_ref     VARCHAR(100),
    status          VARCHAR(20),
    receipt_url     TEXT,
    paid_at         TIMESTAMPTZ
);

-- Notifications
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    citizen_id      UUID,
    type            VARCHAR(30),
    title           VARCHAR(255),
    body            TEXT,
    deep_link       TEXT,
    is_read         BOOLEAN DEFAULT false,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Row-Level Security Policies

```sql
-- Enable RLS on every tenant-scoped table
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Application sets app.tenant_id from JWT before any query
CREATE POLICY tenant_isolation ON citizens
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON applications
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON grievances
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON services
    USING (tenant_id = current_setting('app.tenant_id')::uuid OR is_global = true);
```

Adding a new municipality requires zero code changes — only an `INSERT INTO tenants`.

---

## 4. RAG-Based Chatbot Pipeline

The chatbot answers citizen queries grounded in each municipality's actual rules, fees, processes, and the citizen's own application history. Indexing, embedding, and retrieval all happen **on-prem**. Only the final inference call is delegated to a configurable provider per [ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md), with **mandatory PII redaction** before egress.

### Indexing Pipeline (offline, runs nightly + on-demand)

```
Source documents per tenant:
  • Service catalogue (from DB)
  • FAQ articles (markdown files maintained by municipality staff)
  • Notifications & circulars (PDFs)
  • Schemes & welfare programs
  • Tax slabs, license fees
                │
                ▼
        ┌───────────────┐
        │  Document     │  PDF parsing (pdfplumber),
        │  Loaders      │  markdown, HTML scraping
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  Chunking     │  ~500 tokens with 50-token overlap,
        │               │  preserves semantic boundaries
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  Embedding    │  sentence-transformers/
        │               │  paraphrase-multilingual-MiniLM-L12-v2
        └───────┬───────┘  (handles English + Bengali + Hindi)
                ▼
        ┌───────────────┐
        │  Qdrant       │  Collection per tenant: kb_kmc, kb_hmc, ...
        │  Upsert       │  Payload: {text, source, lang, last_updated}
        └───────────────┘
```

### Query Pipeline (online, per request)

```
User query: "আমি কীভাবে জন্ম সার্টিফিকেট পাবো?"
            │
            ▼
    ┌──────────────────┐
    │ Detect language  │  → bn  (on-prem)
    │ Embed query      │  → 384-dim vector  (on-prem)
    └─────────┬────────┘
              ▼
    ┌──────────────────┐
    │ Qdrant search    │  Filter: tenant_id == kmc  (on-prem)
    │ top_k = 5        │  Hybrid: dense + BM25 rerank
    └─────────┬────────┘
              ▼
    ┌──────────────────┐
    │ Augment context  │  + citizen's applications (PII-tagged)
    │                  │  + current service catalogue snippet
    └─────────┬────────┘
              ▼
    ┌──────────────────┐
    │ PII Redaction    │  ← Mandatory boundary (ADR-0008)
    │ (mobile, holding,│  Replaces with [CITIZEN_PHONE], [HOLDING],
    │  Aadhaar, name…) │  [DOCKET], [CITIZEN_NAME] …
    └─────────┬────────┘  Reverse-map kept server-side only
              ▼
    ┌──────────────────────────────────────┐
    │  ILLMProvider.stream()               │  Resolved provider:
    │   ├── OpenAIProvider                 │   • from tenants.config.chatbot.provider
    │   ├── GeminiProvider                 │   • else from LLM_PROVIDER env
    │   └── OllamaProvider (optional)      │   • else default openai
    └─────────┬────────────────────────────┘  System prompt enforces:
              ▼                                 • cite sources, no fabrication
    ┌──────────────────┐                        • refuse out-of-scope
    │ De-redact tokens │                        • reply in user's language
    │ (placeholder →   │
    │  original PII)   │  Substitution happens server-side
    └─────────┬────────┘
              ▼
    ┌──────────────────┐
    │ Stream tokens    │  Server-Sent Events to client
    │ to client        │  Audit: provider, model, token counts,
    │                  │         latency, redaction count, query hash
    └──────────────────┘  (raw query text never logged)
```

### System Prompt Template

```
You are an assistant for {tenant_name} Municipality. Answer ONLY using the
context below. If the answer isn't in the context, say so and suggest calling
{tenant_helpline}. Reply in {user_language}. Be concise.

CITIZEN CONTEXT:
- Name: {citizen_name}
- Ward: {citizen_ward}
- Active applications: {applications_summary}

KNOWLEDGE BASE CONTEXT:
{retrieved_chunks}

USER QUESTION: {query}
```

In the demo artifact (`MunicipalApp.jsx` / `index.html`), this pipeline is simulated by calling the Anthropic API directly from the client with an embedded KB — that is **prototype-only** and must never reach production. In production, the React Native / PWA chatbot UI calls `POST /api/v1/chatbot/query` on our NestJS API, which performs language detection → embedding → Qdrant retrieval → context augmentation → **PII redaction** → `ILLMProvider.stream()` → de-redaction → SSE stream back to the client. Per ADR-0008, only the final inference hop ever leaves the platform, and only after redaction.

---

## 5. API Endpoints

All endpoints are versioned under `/api/v1`. JWT bearer token required except for auth endpoints. Tenant context derived from JWT claim `tenant_id`.

### Authentication

- `POST /auth/send-otp` — `{ mobile }` → triggers OTP via SMS gateway
- `POST /auth/verify-otp` — `{ mobile, otp }` → returns JWT + refresh token
- `POST /auth/refresh` — refresh JWT
- `POST /auth/logout` — invalidates refresh token
- `POST /auth/aadhaar-link` — DigiLocker OIDC flow

### Citizen

- `POST /citizen/register` — onboarding with KYC
- `GET  /citizen/profile`
- `PATCH /citizen/profile`
- `PATCH /citizen/language` — `{ lang: 'en'|'bn'|'hi' }`
- `POST /citizen/select-tenant` — switch municipality

### Tenants

- `GET /tenants` — list all (public)
- `GET /tenants/:id/config` — branding, services summary

### Services

- `GET /services` — list current tenant's services (filter by category, search)
- `GET /services/:id` — full detail with form schema
- `GET /services/categories`

### Applications (Dockets)

- `POST /applications` — `{ service_id, form_data, attachments }` → returns docket_no
- `GET  /applications` — citizen's own apps
- `GET  /applications/:docket_no` — full timeline
- `POST /applications/:id/upload` — additional documents
- `POST /applications/:id/cancel`

### Payments

- `POST /payments/initiate` — `{ application_id, amount_paise, method }` → stub redirect (`Idempotency-Key` required).
- `POST /payments/stub/complete` — deterministic PSP capture surrogate for Sprint 3.2; disabled in production unless `ALLOW_STUB_PAYMENT_SETTLEMENT=true`.
- `GET /payments` — citizen's payment history
- `GET /payments/:id` — scoped payment snapshot
- `GET /payments/:paymentId/receipt` — issuance metadata incl. QR contract + verifier path (`enagar_receipt_verify_v1`)
- `GET /payments/reconciliation/export` — RBAC CSV of `gl_postings` (+ receipt/service join) keyed by IST `business_date`
- `GET /public/receipts/verify/:token` — public QR verification payload (`@Public` route)
- `POST /payments/webhook` — gateway callback (signature verified) arrives with Sprint 3.1B

### Finance (deposits, refund queue, challans — Sprint 3.3A)

Staff JWT + roles `tenant_admin` / `municipality_admin` / `state_admin`. No live PSP refund disbursement — `complete-internal` records completion only until Sprint 3.1B.

- `POST /finance/deposits`, `GET /finance/deposits/:id`
- `POST /finance/deposits/:id/mark-eligible-for-release`, `POST /finance/deposits/:id/forfeit`
- `POST /finance/deposits/:depositId/refund-dispatch`
- `GET /finance/refund-dispatches/:id`
- `POST /finance/refund-dispatches/:id/approve`, `POST /finance/refund-dispatches/:id/reject`, `POST /finance/refund-dispatches/:id/complete-internal`
- `POST /finance/challans`, `GET /finance/challans/:id`
- `POST /finance/challans/:id/mark-paid-internal`, `POST /finance/challans/:id/waive`, `POST /finance/challans/:id/reopen-after-dispute`

Phase 3 Sprint 3.1A introduced ADR-0006's `IPaymentGateway` adapter. Until gateway sandbox credentials exist, only the `stub` gateway is used for initiations. **Sprints 3.2, 3.4A, and 3.3A are closed (2026-05-11)** — receipts/GL, citizen stub payments UX, and **`/api/finance/*`** deposits, refund dispatches, and challans (no live PSP refund RPC until **Sprint 3.1B**). Citizen data uses `PostgresCitizenStore`; applications and payments use Postgres stores behind `APPLICATION_STORE_PROVIDER` / `PAYMENT_STORE_PROVIDER`. `RUN_DB_TESTS=1` gates DB integration tests, including finance.

**Programme note (2026-05-14 refresh):** PSP credentials are still unavailable — **Sprint 3.1B** remains the deferred **interrupt lane**. **Phase 4 — Grievances & SLA**: **Sprints 4.1–4.2** closed (**2026-05-11**); **Sprint 4.3 core slice closed 2026-05-13**; **Master Phase 4 backlog slice (locked queue #3)** closed in-repo **2026-05-14** — in-app SLA breach inbox (`notifications` rows + `GET /api/citizen/notifications`), **public anonymised KPIs**, structured **attachments** API, validated **GPS** on `location`, and **200-scenario routing bake-off**. Native FCM/APNs breach push stays future (`notification-worker`).

### Grievances

Sprint 4.1 implements tenant-scoped grievance persistence under the global **`/api`** prefix:

- `POST /api/grievances` — `{ category, description, location? { address?, ward_hint?, latitude?, longitude? }, photos?, grievance_priority? }` — **citizen**
- `GET /api/grievances` — citizen: own; staff: whole tenant (RBAC)
- `GET /api/grievances/:id` — detail (`attachments[]` when registered) + `timeline[]` — owner or staff
- `POST /api/grievances/:id/attachments/register` — `{ storage_key, content_type? }` — citizen, ownership via same scope as **`getById`**
- `POST /api/grievances/:id/comment` — `{ body }` — owner or staff
- `POST /api/grievances/:id/reopen` — `{ reason? }` — **citizen**, while `status = resolved`, within **7 days** of `resolved_at`; returns grievance to **`under_review`** and refreshes SLA clock (Sprint **4.3**)
- `POST /api/grievances/:id/feedback` — `{ rating, comment? }` — **citizen**, when `status = resolved` (**portal JWT reads use the same `getById` ownership path as hub/workspace detail**, optional **`X-Enagar-Tenant-Code`** parity with **GET** — Sprint **4.3** hardened)
- `POST /api/grievances/:id/assign` — `{ user_id }` — **staff** (`municipality_clerk` | `municipality_admin` | `tenant_admin` | `state_admin`)
- `PATCH /api/grievances/:id/status` — `{ status, note? }` — **staff**, lifecycle-guarded
- `POST /api/grievances/staff/sweep-sla` — marks breaches for overdue non-terminal cases — **staff** — also applies **MVP queue escalation** (`routed_role_code` bump + clears `assigned_to_user_id`, timeline **`sla_escalation`**), persists **`sla_breach` notifications** for the filing citizen _(Phase 4 backlog slice)_ — native push fan-out still `notification-worker` future\*

- `GET /api/public/grievances/aggregate-metrics?tenant_code?&window_days?` — **no JWT** — anonymised `{ totals_by_status, totals_by_category, breached_open_count }` for dashboards / Phase-12-style open data previews

SLA hours resolve from per-tenant **`sla_policies`**. Routing hints resolve from **`grievance_routing_rules`** (validated by **`grievance-routing-bake-off`** unit tests — 200 permutations).

**Citizen PWA (`apps/citizen-pwa`) — Sprint 4.2 + 4.3 + Phase 4 backlog:** authenticated **Grievances** tab calls the routes above (list, create with optional GPS pin fields, detail shows map pin / attachment keys, SLA banner, comment, **Re-open dispute** while `resolved`, feedback when resolved). List view surfaces unread **`sla_breach`** inbox notices when `GET /citizen/notifications` returns unread rows.

### Notifications

- `GET /api/citizen/notifications`, `PATCH /api/citizen/notifications/:id/read` — authenticated **citizen JWT** inbox (persisted SLA breach pings today; **`POST /notifications/register-token`** FCM plumbing remains future scaffold)

### Chatbot

- `POST /chatbot/query` — `{ message, session_id }` → SSE stream
- `GET  /chatbot/history/:session_id`
- `POST /chatbot/feedback` — thumbs up/down per response

### Documents

- `GET /documents/certificates` — issued certificates with signed download URLs
- `GET /documents/:id/download` — pre-signed MinIO URL (5-minute expiry)

### Admin (RBAC: municipality_admin role)

- `POST /admin/services` — create/update service
- `POST /admin/workflows` — define approval chains
- `GET  /admin/dashboard` — metrics, SLA breaches, revenue
- `GET  /admin/reports/:type` — CSV/PDF export

---

## 6. Security

| Concern                | Control                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication         | OTP + JWT (15 min access, 7 day refresh), optional Aadhaar OIDC via DigiLocker                                                                                                                                |
| Authorization          | RBAC via Keycloak roles on JWT `role` — **`citizen`**; grievance staff: **`municipality_clerk`**, **`municipality_admin`**, **`tenant_clerk`** (realm alias, Hub H5.1), **`tenant_admin`**, **`state_admin`** |
| Tenant Isolation       | Postgres RLS — defence in depth even if app code has a bug                                                                                                                                                    |
| Data at Rest           | Postgres TDE, MinIO server-side encryption (SSE-S3)                                                                                                                                                           |
| Data in Transit        | TLS 1.3 only, HSTS, certificate pinning in mobile app                                                                                                                                                         |
| Sensitive Fields       | Aadhaar stored as SHA-256 hash + last 4 digits (for display only); never logged                                                                                                                               |
| Mobile Storage         | Encrypted secure store (Expo SecureStore / Keychain / Keystore) for tokens                                                                                                                                    |
| Rate Limiting          | Redis-backed: 5 OTP/hour/mobile, 100 req/min/citizen                                                                                                                                                          |
| File Uploads           | MIME sniffing, ClamAV scan via BullMQ, max 10 MB per file                                                                                                                                                     |
| Audit                  | Every state change in `application_timeline` + immutable Loki logs                                                                                                                                            |
| OWASP MASVS            | Following Mobile App Security Verification Standard L2                                                                                                                                                        |
| Vulnerability Scanning | Trivy in CI, Dependabot, manual quarterly pen-test                                                                                                                                                            |
| GDPR / DPDP Act        | Data export, account deletion endpoints; explicit consent ledger                                                                                                                                              |

---

## 7. Project Structure

```
wb-municipal/
├── apps/
│   ├── mobile/                  # React Native + Expo
│   │   ├── src/
│   │   │   ├── screens/         # Home, Services, Grievance, Chat, Profile
│   │   │   ├── components/
│   │   │   ├── i18n/            # en.json, bn.json, hi.json
│   │   │   ├── api/             # API client, interceptors
│   │   │   ├── store/           # Zustand state
│   │   │   └── navigation/
│   │   └── app.config.ts
│   │
│   ├── api/                     # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── citizen/
│   │   │   │   ├── tenant/
│   │   │   │   ├── service/
│   │   │   │   ├── application/
│   │   │   │   ├── grievance/
│   │   │   │   ├── payment/
│   │   │   │   ├── chatbot/
│   │   │   │   └── notification/
│   │   │   ├── common/          # guards, interceptors, filters
│   │   │   └── main.ts
│   │   └── prisma/schema.prisma
│   │
│   └── admin-portal/            # Next.js admin dashboard
│       └── ...
│
├── services/
│   ├── rag-indexer/             # Python: scheduled indexing into Qdrant
│   └── workflow-engine/         # Camunda or custom state machine
│
├── infrastructure/
│   ├── docker-compose.yml       # local dev
│   ├── k8s/                     # Helm charts for state-wide deployment
│   └── terraform/
│
└── docs/
    ├── ARCHITECTURE.md          # this file
    ├── API.md                   # OpenAPI spec
    └── DEPLOYMENT.md
```

---

## 8. Local Setup

```bash
# Clone
git clone <repo> && cd wb-municipal

# Spin up infrastructure
cd infrastructure
docker-compose up -d   # postgres, redis, qdrant, ollama, minio, keycloak

# Pull LLM
docker exec ollama ollama pull llama3.1:8b

# Backend
cd ../apps/api
pnpm install
pnpm prisma migrate dev
pnpm seed                # creates 8 sample municipalities and demo services
pnpm dev                 # http://localhost:3000

# Mobile
cd ../mobile
pnpm install
pnpm start               # press 'a' for Android, 'i' for iOS

# Admin
cd ../admin-portal
pnpm dev                 # http://localhost:3001
```

Default seeded login: any 10-digit mobile, OTP is always `123456` in dev mode.

---

## 9. Adding a New Municipality

The whole point of multi-tenancy: zero code changes.

1. Admin logs into state portal
2. Fills onboarding form (name, district, wards, theme color, logo)
3. Imports default service catalogue (or customises per local rules)
4. Uploads knowledge base documents — RAG indexer picks them up overnight
5. Configures payment gateway credentials and SMS sender ID
6. Tenant is live; citizens see it in the municipality picker on next app launch

---

## 10. Revenue Model & Service Catalogue

The platform handles all major municipal revenue heads. Every service maps to one of these revenue categories on the backend, which in turn drives the chart of accounts and finance ledger.

### Revenue Head Taxonomy

| #   | Revenue Head                      | App Category                   | Sample Services                                                                                          |
| --- | --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1.1 | **Tax Revenue — Advertisement**   | Advertisement & Media          | Hoarding tax, Digital billboard fees, Mobile ad fees, LED slots, WiFi splash, Bus shelter ads            |
| 1.2 | **Tax Revenue — Property Linked** | Taxes & Property               | Property tax, Water tax, Conservancy tax (solid waste), Self-assessment                                  |
| 2.1 | **Non-Tax — User Charges**        | Water & Sanitation             | Water supply, Sewerage charges, Solid Waste Mgmt fee, Public toilet pass, Septic cleaning                |
| 2.2 | **Non-Tax — Fees & Licenses**     | Certificates, Building, Health | Birth/Death/Marriage cert, Trade license, Health license, Occupancy cert, Building plan, Completion cert |
| 2.3 | **Non-Tax — Rent & Lease**        | Bookings & Rentals             | Market shop rent, Stall booking, Community hall, Auditorium, Park lawn, Sports ground, Parking lease     |
| 2.4 | **Non-Tax — Sale & Hire**         | Tenders & Deposits / Health    | Tender forms, Scrap sale, Equipment hiring, Hearse van, Ambulance                                        |
| 3   | **Fines & Penalties**             | Fines & Penalties              | Late payment, Encroachment, Illegal construction, Sanitation/trade/dump violations, Noise pollution      |
| 4   | **Assigned / Shared Revenue**     | (Backend only — state inflow)  | Stamp duty share, Motor vehicle tax share, Entertainment tax, Electricity duty share                     |
| 5   | **Deposits & EMD**                | Tenders & Deposits             | Security deposits, EMD, Refundable deposits, Vendor registration                                         |
| 6.1 | **Smart City Revenue**            | Smart City Services            | Smart parking, EV charging, IoT water meter, Smart waste subscription                                    |
| 6.2 | **Ad & Data Monetization**        | Smart City / Advertisement     | LED ads, Public WiFi ads, GIS data licensing                                                             |
| 6.3 | **Asset Monetization**            | Smart City Services            | Land leasing, Rooftop solar, Telecom tower permissions                                                   |
| 9   | **Miscellaneous Income**          | Info & RTI                     | RTI fees, Document search, Birth/death record search, Certified copies                                   |

### Revenue Recognition Schema

Each service in the catalogue carries a `revenue_head_code` and `gl_account_code`. When a payment settles, the finance module auto-posts to the correct ledger.

```sql
-- Revenue heads master (state-wide, not tenant-specific)
CREATE TABLE revenue_heads (
    code            VARCHAR(20) PRIMARY KEY,    -- 'TAX_AD_HOARDING', 'NTAX_RENT_HALL'
    name            VARCHAR(255),
    head_group      VARCHAR(50),                -- 'TAX', 'NON_TAX', 'FINES', 'DEPOSITS', 'ASSIGNED', 'MISC'
    sub_group       VARCHAR(50),                -- 'ADVERTISEMENT', 'USER_CHARGES', 'RENT_LEASE'
    is_refundable   BOOLEAN DEFAULT false,      -- true for deposits/EMD
    gst_applicable  BOOLEAN DEFAULT false,      -- service-level GST handling
    gl_account      VARCHAR(20)                 -- maps to chart of accounts
);

-- Link services to revenue heads
ALTER TABLE services ADD COLUMN revenue_head_code VARCHAR(20)
    REFERENCES revenue_heads(code);

-- Payment table already exists; add head linkage
ALTER TABLE payments ADD COLUMN revenue_head_code VARCHAR(20);
ALTER TABLE payments ADD COLUMN is_refunded BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN refund_due_date DATE;     -- for EMD auto-tracking
```

### Refundable Deposits — Lifecycle

EMDs and security deposits are first-class entities, not just payments:

```sql
CREATE TABLE deposits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    citizen_id      UUID NOT NULL,
    deposit_type    VARCHAR(20),                -- 'EMD', 'SECURITY', 'RENT_DEPOSIT'
    reference       VARCHAR(100),               -- tender no, contract no, hall booking id
    amount          NUMERIC(12,2),
    paid_at         TIMESTAMPTZ,
    expected_release_at  TIMESTAMPTZ,           -- derived from rules
    status          VARCHAR(20),                -- 'HELD', 'RELEASE_INITIATED', 'REFUNDED', 'FORFEITED'
    refund_payment_id  UUID,                    -- link when refunded
    forfeiture_reason  TEXT
);

-- Background job runs daily: finds deposits past expected_release_at
-- in HELD status and creates a refund task for finance dept.
```

### Fines & Challans — Issued vs Paid

Fines aren't applications — they're issued first by enforcement officers, then paid by the citizen. The data model reflects this:

```sql
CREATE TABLE challans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    challan_no      VARCHAR(50) UNIQUE,
    issued_to       VARCHAR(255),               -- name (citizen may or may not be registered)
    citizen_id      UUID,                       -- linked once paid via app
    violation_code  VARCHAR(50),                -- maps to revenue head
    location        JSONB,
    issued_by       UUID,                       -- enforcement officer
    issued_at       TIMESTAMPTZ,
    amount          NUMERIC(10,2),
    photo_evidence  JSONB,
    status          VARCHAR(20),                -- 'ISSUED', 'PAID', 'DISPUTED', 'WAIVED'
    paid_at         TIMESTAMPTZ
);
```

A citizen can search by challan number in the app and pay — no application flow needed for that path.

### Bookings — Calendar-Based Inventory

Hall bookings, auditorium, sports grounds, equipment hire all share the same model:

```sql
CREATE TABLE bookable_assets (
    id              UUID PRIMARY KEY,
    tenant_id       UUID,
    asset_type      VARCHAR(50),                -- 'HALL', 'AUDITORIUM', 'GROUND', 'EQUIPMENT'
    name            VARCHAR(255),
    location        JSONB,
    capacity        INTEGER,
    base_rate       NUMERIC(10,2),              -- per day or per hour
    rate_unit       VARCHAR(10),                -- 'DAY', 'HOUR'
    security_deposit  NUMERIC(10,2),
    rules           JSONB                       -- per-asset booking rules
);

CREATE TABLE bookings (
    id              UUID PRIMARY KEY,
    tenant_id       UUID,
    asset_id        UUID REFERENCES bookable_assets(id),
    citizen_id      UUID,
    booking_no      VARCHAR(50),
    start_at        TIMESTAMPTZ,
    end_at          TIMESTAMPTZ,
    purpose         VARCHAR(255),
    rate_charged    NUMERIC(10,2),
    deposit_id      UUID REFERENCES deposits(id),
    status          VARCHAR(20),                -- 'CONFIRMED', 'CANCELLED', 'COMPLETED'
    cancel_reason   TEXT
);

-- Anti-double-booking via exclusion constraint
ALTER TABLE bookings ADD CONSTRAINT no_overlap
    EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (status = 'CONFIRMED');
```

### Smart City — Real-Time Pricing Hooks

Smart parking, EV charging, and IoT water meters need real-time pricing and metering, integrated through dedicated micro-services:

```
Mobile app → /api/v1/smart-parking/reserve
              ↓
        Pricing service (rules engine: zone, time-of-day, vehicle type)
              ↓
        Sensor service (Modbus/MQTT bridge to on-street IoT)
              ↓
        Payment + ledger entry (revenue head: NTAX_SMART_PARKING)
```

The mobile artifact already has placeholder screens; the production system swaps in real telemetry sources.

---

## 11. Service Catalogue Volume

The shipped catalogue covers **76 services across 14 categories**, designed to be the union of services across all West Bengal municipalities. Each tenant can:

- Toggle services on/off via admin (most rural municipalities won't offer EV charging or digital billboards yet)
- Override fees, SLAs, required documents, and form schemas per tenant
- Add tenant-specific services not in the global catalogue

This is the practical realisation of the multi-tenant promise: a small ULB and Kolkata Municipal Corporation share the same code, but see only what they configured.

---

## 12. Roadmap Beyond MVP

- Voice input for chatbot (Whisper.cpp self-hosted, Bengali fine-tune)
- Offline-first form filling with background sync (essential for low-connectivity wards)
- WhatsApp Business API channel for chatbot (same RAG backend)
- Open Data API for researchers — anonymised, aggregated grievance trends
- IoT integration: real-time water tanker tracking, garbage truck GPS
- Predictive SLA-breach alerts using historical data (your existing predictive-maintenance experience applies cleanly here)

---

_Built for the citizens of West Bengal. Open-source, sovereign, and free forever._
