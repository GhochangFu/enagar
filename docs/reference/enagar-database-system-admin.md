# eNagar Database Reference — System Administrator Guide

**Database name (local dev):** `enagarseba`  
**Engine:** PostgreSQL 16  
**ORM / migrations:** Prisma (`apps/api/prisma/schema.prisma`)  
**Connection (typical dev):** `postgresql://enagar:***@localhost:5432/enagarseba?schema=public`  
**Source of truth:** Prisma schema + SQL migrations under `apps/api/prisma/migrations/`  
**Last aligned with schema:** Master Sprints **6.21–6.24** (grievance taxonomy programme, commit `f93b713`)

This document is for **system administrators** who operate, monitor, back up, and troubleshoot the platform database. It describes all application tables, how they relate, and how multi-tenant isolation is enforced.

---

## 1. Platform overview

eNagar is a **multi-tenant municipal services platform**. Each **tenant** is a Urban Local Body (ULB), e.g. KMC or HMC. Almost all operational data is scoped by `tenant_id`.

| Layer                    | Responsibility                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **PostgreSQL**           | Persistent data, constraints, Row-Level Security (RLS)                                                                   |
| **@enagar/api (NestJS)** | Business logic; sets `app.tenant_id` session variable per request                                                        |
| **Keycloak**             | Authentication; staff/citizen identities (UUID subjects)                                                                 |
| **State Admin**          | Cross-tenant governance: global **service** and **grievance** libraries, tenant adopt oversight, integrations, audit     |
| **Tenant Admin**         | Per-ULB configuration: services, **grievance catalogue** (adopt/fork/deactivate), SLA/routing, workflows, staff, content |
| **Citizen (hub)**        | One Keycloak `sub` across ULBs; **WBPORTAL** JWT; per-ULB `citizens` rows created lazily on first filing                 |

### 1.1 Data scope classes

| Scope                          | Tables                                                                                   | RLS pattern                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Global service catalogue**   | `revenue_heads`, `service_categories`, `global_services`, `service_documents`            | `public_read` — any session can `SELECT`                                                          |
| **Global grievance library**   | `global_grievance_categories`, `global_grievance_subtypes`                               | **No RLS** — State Admin API / seed only; not exposed on citizen `SELECT`                         |
| **State platform**             | `state_audit_logs`, `impersonation_tokens`, `state_integrations`                         | **No RLS** — access only via State Admin API / elevated DB role                                   |
| **Tenant registry (read-all)** | `tenants`, `roles`                                                                       | `public_read` on `SELECT` only                                                                    |
| **Tenant-isolated**            | All other tables with `tenant_id` (incl. `tenant_grievance_*`, `services`, `grievances`) | `tenant_isolation` — row visible only when `tenant_id` matches `current_setting('app.tenant_id')` |

The API sets `SET app.tenant_id = '<uuid>'` from the JWT before running tenant-scoped queries. Cross-tenant access is blocked at the database layer when RLS is enabled.

**Citizen public reads:** Active grievance pickers use `GET /api/public/grievances/catalogue?tenant_code={ULB}` (no JWT), which queries **`tenant_grievance_categories`** / **`tenant_grievance_subtypes`** (`is_active = true`) — not the global library tables directly.

**Portal tenant `WBPORTAL`:** Seeded in `tenants` for Option A hub JWTs. It is **not** an operational ULB: no grievance SLA/routing seed, not listed on `GET /api/tenants`, and filings must target a municipality code (KMC, HMC, …).

### 1.2 High-level domain map

```mermaid
flowchart TB
  subgraph Global["Global / State scope"]
    RH[revenue_heads]
    SC[service_categories]
    GS[global_services]
    SD[service_documents]
    GGC[global_grievance_categories]
    GGS[global_grievance_subtypes]
    SI[state_integrations]
    SAL[state_audit_logs]
    IT[impersonation_tokens]
  end

  subgraph TenantCore["Tenant core"]
    T[tenants]
    TC[tenant_config]
    TB[tenant_banners]
    BR[boroughs]
    WD[wards]
    LO[localities]
  end

  subgraph Identity["Identity & access"]
    CZ[citizens]
    US[users]
    RL[roles]
    UR[user_roles]
    SI2[staff_invites]
  end

  subgraph Services["Service delivery"]
    SVC[services]
    SFV[service_form_versions]
    WF[workflows]
    APP[applications]
  end

  subgraph Money["Payments & revenue"]
    PAY[payments]
    RCP[receipts]
    GL[gl_postings]
    DEP[deposits]
    CH[challans]
  end

  T --> TenantCore
  T --> Identity
  T --> Services
  T --> GrievTax[tenant_grievance_*]
  GS --> SVC
  GGC --> GrievTax
  SVC --> APP
  GrievTax --> GRV[grievances]
  APP --> PAY
  PAY --> RCP
  RCP --> GL
```

### 1.3 Runtime data flow (admin mental model)

| Citizen-facing capability | Primary DB tables                                                                                 | Configured by                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Service applications**  | `services`, `service_form_versions`, `workflows`, `applications`                                  | Tenant Admin (+ global `global_services` adopt)    |
| **Grievance filing**      | `tenant_grievance_categories`, `tenant_grievance_subtypes`, `grievances`, `grievance_attachments` | State library adopt + Tenant Admin fork/deactivate |
| **Desk triage**           | `grievances`, `grievance_timeline`, `sla_policies`, `grievance_routing_rules`                     | Tenant Admin Operations                            |

Both catalogues are **per-tenant in Postgres** after seed/adopt — not hardcoded in mobile/PWA builds.

---

## 2. Entity-relationship diagrams (by domain)

### 2.1 Tenant, geography, and configuration

```mermaid
erDiagram
  tenants ||--o| tenant_config : has
  tenants ||--o{ tenant_banners : displays
  tenants ||--o{ boroughs : contains
  tenants ||--o{ wards : contains
  tenants ||--o{ localities : contains
  tenants ||--o{ tenant_tariffs : prices
  boroughs ||--o{ wards : groups
  wards ||--o{ localities : contains

  tenants {
    uuid id PK
    varchar code UK
    varchar name
    jsonb config
    boolean is_active
  }
  tenant_config {
    uuid id PK
    uuid tenant_id FK UK
    jsonb feature_flags
  }
  wards {
    uuid id PK
    uuid tenant_id FK
    varchar number
  }
```

### 2.2 Identity: citizens, staff, roles, invites

```mermaid
erDiagram
  tenants ||--o{ citizens : registers
  tenants ||--o{ users : employs
  tenants ||--o{ staff_invites : pending
  roles ||--o{ user_roles : grants
  users ||--o{ user_roles : has
  wards ||--o{ user_roles : scopes
  wards ||--o{ citizens : resides

  citizens {
    uuid id PK
    uuid tenant_id FK
    varchar mobile UK
    varchar keycloak_subject UK
    char aadhaar_hash
  }
  users {
    uuid id PK
    uuid tenant_id FK
    uuid keycloak_user_id UK
    varchar username
  }
  staff_invites {
    uuid id PK
    uuid tenant_id FK
    varchar status
    varchar provisioning_mode
  }
```

**Note:** Keycloak holds passwords and MFA. The database stores **links** (`keycloak_subject`, `keycloak_user_id`) and municipal profile fields only.

### 2.3 Global service library vs tenant services

```mermaid
erDiagram
  service_categories ||--o{ global_services : categorizes
  revenue_heads ||--o{ global_services : funds
  global_services ||--o{ service_documents : requires
  global_services ||--o{ services : clones_to
  service_categories ||--o{ services : categorizes
  tenants ||--o{ services : offers
  services ||--o{ service_form_versions : versions
  services ||--o{ workflows : processes

  global_services {
    uuid id PK
    varchar code UK
    varchar lifecycle_status
    int library_version
    jsonb form_schema
  }
  services {
    uuid id PK
    uuid tenant_id FK
    uuid global_service_id FK
    varchar code
    jsonb override_config
  }
```

Physical table name for tenant services is **`services`** (Prisma model `TenantService`).

### 2.4 Workflows and applications

```mermaid
erDiagram
  services ||--o{ workflows : defines
  workflows ||--o{ workflow_stages : has
  workflow_stages ||--o{ workflow_transitions : from_to
  workflow_stages ||--o{ role_stage_map : permits
  citizens ||--o{ applications : submits
  services ||--o{ applications : for
  applications ||--o{ application_timeline : history
  applications ||--o{ application_comments : notes
  applications ||--o{ application_documents : uploads

  applications {
    uuid id PK
    varchar docket_no UK
    varchar status
    jsonb form_data
    varchar payment_status
  }
```

### 2.5 Payments, receipts, GL, deposits, challans

```mermaid
erDiagram
  applications ||--o{ payments : pays
  payments ||--o| receipts : generates
  payments ||--o| gl_postings : posts
  payments ||--o| deposits : captures
  citizens ||--o{ deposits : holds
  deposits ||--o{ refund_dispatches : refunds
  citizens ||--o{ challans : cited
  users ||--o{ challans : issued_by
  payments ||--o| challans : settles

  payments {
    uuid id PK
    int amount_paise
    varchar gateway
    varchar status
  }
  receipts {
    uuid id PK
    varchar receipt_number UK
    uuid verification_token UK
  }
```

Amounts are stored in **paise** (integer) to avoid floating-point errors.

### 2.6 Grievance taxonomy, SLA, routing, and cases

```mermaid
erDiagram
  global_grievance_categories ||--o{ global_grievance_subtypes : has
  global_grievance_categories ||--o{ tenant_grievance_categories : adopted_as
  tenants ||--o{ tenant_grievance_categories : configures
  tenant_grievance_categories ||--o{ tenant_grievance_subtypes : has
  tenants ||--o{ sla_policies : defines
  tenants ||--o{ grievance_routing_rules : routes
  citizens ||--o{ grievances : files
  users ||--o{ grievances : assigned
  wards ||--o{ grievance_routing_rules : matches
  grievances ||--o{ grievance_timeline : events
  grievances ||--o{ grievance_attachments : evidence

  global_grievance_categories {
    varchar code PK
    jsonb name
    varchar docket_code
    boolean is_active
  }
  tenant_grievance_categories {
    uuid id PK
    uuid tenant_id FK
    varchar code
    varchar global_category_code FK
    varchar source
    boolean is_active
  }
  grievances {
    uuid id PK
    varchar grievance_no UK
    varchar category
    varchar subtype_code
    jsonb location
    jsonb photo_keys
    timestamptz sla_due_at
    varchar status
  }
```

**Filing validation:** When a tenant has rows in `tenant_grievance_categories`, `POST /api/grievances` requires `category` (and `subtype_code` when subtypes exist) to match active catalogue codes. Legacy slugs may still exist on old `grievances.category` rows after taxonomy migration.

### 2.7 Bookings, knowledge base, notifications, holdings

```mermaid
erDiagram
  tenants ||--o{ bookable_assets : owns
  bookable_assets ||--o{ bookable_asset_availability : windows
  bookable_assets ||--o{ booking_reservations : reserves
  applications ||--o{ booking_reservations : links
  tenants ||--o{ kb_articles : publishes
  kb_articles ||--o{ kb_index_jobs : indexes
  tenants ||--o{ notification_templates : defines
  citizens ||--o{ notifications : receives
  tenants ||--o{ holding_records : mirrors
  holding_records ||--o{ holding_lookup_audit : audited
```

### 2.8 State administration (no tenant RLS)

```mermaid
erDiagram
  tenants ||--o{ state_audit_logs : target_optional
  tenants ||--o{ impersonation_tokens : target
  state_integrations {
    uuid id PK
    varchar provider_key UK
    varchar environment
    varchar status
    jsonb readiness
  }
```

**Secrets are never stored** in `state_integrations.readiness` — only non-sensitive metadata and checklist fields.

---

## 3. Complete table catalogue

Below: **physical table name** (PostgreSQL), primary purpose, key columns, constraints, and admin notes.

### 3.1 Tenant registry and geography

#### `tenants`

| Column                     | Type           | Description                                                                       |
| -------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `id`                       | UUID PK        | Stable tenant identifier (used in JWT and RLS)                                    |
| `code`                     | VARCHAR(20) UK | Short code, e.g. `kmc`, `hmc`                                                     |
| `name`                     | VARCHAR(255)   | Display name of the ULB                                                           |
| `district`                 | VARCHAR(100)   | Optional district label                                                           |
| `ward_count`               | INT            | Declared ward count (informational)                                               |
| `theme_color`              | VARCHAR(7)     | Hex brand colour for citizen apps                                                 |
| `logo_url`                 | TEXT           | Logo URL                                                                          |
| `languages_enabled`        | TEXT[]         | Enabled locale codes (default `en`, `bn`, `hi`)                                   |
| `config`                   | JSONB          | Extensible ULB config; onboarding flags (`wizard_completed`, `onboarding_source`) |
| `is_active`                | BOOLEAN        | Soft disable for the whole ULB                                                    |
| `created_at`, `updated_at` | TIMESTAMPTZ    | Audit timestamps                                                                  |

**Purpose:** Root of multi-tenancy. Every ULB row drives theming, feature flags in `config`, and foreign keys across the schema.  
**RLS:** `tenant_public_read` — all tenants visible on `SELECT` (needed for tenant picker / hub).  
**Admin notes:** Deactivating a tenant does not delete child rows; apps should respect `is_active`.  
**Special row `WBPORTAL`:** Citizen portal (not a municipality). Seeded with fixed UUID `99999999-9999-4999-8999-999999999999`; excluded from `GET /api/tenants` and from grievance SLA/routing seed. Operational ULBs in dev seed: **KMC, HMC, CMC, BMC, SMC, AMC, DMC, SDDM**.

#### `tenant_config`

| Column                           | Type        | Description                            |
| -------------------------------- | ----------- | -------------------------------------- |
| `tenant_id`                      | UUID FK UK  | 1:1 with `tenants`                     |
| `default_language`               | VARCHAR(5)  | Default UI locale                      |
| `timezone`                       | VARCHAR(64) | IANA timezone (default `Asia/Kolkata`) |
| `contact_phone`, `contact_email` | VARCHAR     | Public contact                         |
| `branding`                       | JSONB       | Extended branding tokens               |
| `feature_flags`                  | JSONB       | Per-ULB feature toggles                |

**Purpose:** Normalized operational settings separate from bulky `tenants.config`.  
**RLS:** `tenant_isolation`.

#### `tenant_banners`

Scheduled in-app banners (severity, multilingual `title`/`body` JSON, optional `link_url`, `starts_at`/`ends_at`).  
**Unique:** `(tenant_id, code)`. **RLS:** tenant isolation.

#### `boroughs`

Administrative subdivisions within a ULB (`code`, `name`). Parent of optional ward grouping.  
**Unique:** `(tenant_id, code)`.

#### `wards`

Electoral / service wards: `number`, optional `name`, `councillor`, `boundary` JSONB.  
**Unique:** `(tenant_id, number)`. Linked from citizens and ward-scoped `user_roles`.

#### `localities`

Named local areas with optional `ward_id`, `mouza`, `pincode`.  
**Unique:** `(tenant_id, name, pincode)`.

#### `tenant_tariffs`

ULB-specific fee schedules: `code`, `category`, multilingual `name`, `rate_config` JSONB.  
**Unique:** `(tenant_id, code)`.

---

### 3.2 Identity and access control

#### `citizens`

| Column                                   | Type         | Description                                |
| ---------------------------------------- | ------------ | ------------------------------------------ |
| `keycloak_subject`                       | VARCHAR(255) | OIDC `sub` after citizen login             |
| `mobile`                                 | VARCHAR(15)  | Primary identifier per tenant              |
| `aadhaar_hash`                           | CHAR(64)     | SHA-256 of Aadhaar (never store plaintext) |
| `address`                                | JSONB        | Structured address                         |
| `ward_id`                                | UUID FK      | Optional ward link                         |
| `holding_number`                         | VARCHAR(50)  | Property holding reference                 |
| `language_pref`                          | VARCHAR(5)   | UI language                                |
| `selected_tenant_code`                   | VARCHAR(20)  | Hub: last selected ULB                     |
| `pinned_tenant_codes`, `pinned_services` | JSONB        | Citizen personalization                    |

**Purpose:** Citizen profile per ULB. Under **hub Option A**, one Keycloak `sub` may have **multiple** `citizens` rows (one per ULB after first filing); portal profile often lives on `WBPORTAL` tenant row.  
**Unique:** `(tenant_id, mobile)`, `(tenant_id, keycloak_subject)`.

#### `users`

Municipal **staff** mirrored from Keycloak: `keycloak_user_id` (UUID UK globally), `username`, `display_name`, `status` (`active`/`disabled`/`invited`).  
**Unique:** `(tenant_id, username)`.

#### `roles`

**Global** role catalogue (`code` UK): e.g. clerk, approver. `is_system` marks platform-defined roles.  
**RLS:** `roles_public_read`.

#### `user_roles`

Assigns a `role` to a `user` within a `tenant`, optionally scoped to a `ward`.  
**Unique:** `(tenant_id, user_id, role_id, ward_id)`.

#### `staff_invites`

Guided staff onboarding (Sprint 6.12): invite before Keycloak user exists.  
| Column | Description |
| --- | --- |
| `status` | e.g. `draft`, `pending_keycloak`, `provisioned`, `disabled` |
| `provisioning_mode` | `dry_run` (no Keycloak) or `local_keycloak` |
| `role_codes` | TEXT[] of role codes to assign |
| `ward_number` | Optional ward scope |
| `invited_by_subject` | Keycloak subject of inviter |
| `metadata` | JSONB audit / dry-run details |

**Unique:** `(tenant_id, username)`. **RLS:** tenant isolation.

#### `citizen_push_devices`

FCM/APNs tokens per citizen (`platform`, `token`). **Unique:** `(citizen_id, token)`.

---

### 3.3 Notifications and knowledge base

#### `notifications`

In-app notification inbox: `type`, `title`, `body`, optional `deep_link`, read state (`is_read`, `read_at`). Optional `citizen_id`.

#### `notification_templates`

Per-tenant templates keyed by `(code, channel, locale)` with `trigger`, `subject`, `body`, `variables` JSONB.

#### `kb_articles`

Knowledge base articles: `slug`, multilingual `title`/`body`, `tags[]`, `status`, `published_at`.

#### `kb_index_jobs`

Async search-index jobs per article (`status`, `trigger`, `error`, `completed_at`).

#### `tenant_branding_assets`

Uploaded branding files: `storage_key`, `public_url`, `mime_type`, `size_bytes`, dimensions.

---

### 3.4 Global service catalogue (State-curated)

#### `revenue_heads`

State-wide revenue accounting heads: `code` UK, multilingual `name`, `accounting_code`, `is_active`.  
Funds linkage for services and GL.

#### `service_categories`

Hierarchical grouping for citizen service browse: `code` UK, `sort_order`, multilingual `name`/`description`.

#### `global_services`

**Master service definitions** published by State Admin.

| Column                           | Description                             |
| -------------------------------- | --------------------------------------- |
| `workflow_pattern`               | Template for tenant workflow generation |
| `fee_type`, `fee_config`         | Default fee structure                   |
| `form_schema`, `workflow_config` | JSON definitions                        |
| `required_documents`             | JSON array of document specs            |
| `lifecycle_status`               | `published`, `deprecated`, etc.         |
| `library_version`                | Incremented on publish                  |
| `curator_notes`                  | Internal curation notes                 |
| `pushes_to_digilocker`           | Integration flag                        |

**Unique:** `code`. **RLS:** public read.

#### `service_documents`

Document requirements per global service (`accept` MIME types, `max_size_mb`, `is_statutory`).

#### `state_integrations`

**State-only** integration cockpit metadata (no secrets).

| Column            | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `provider_key`    | e.g. `digilocker`, `payment_gateway`                          |
| `environment`     | `sandbox`, `pilot`, `production`                              |
| `status`          | `not_configured`, `manual_check_required`, `ready`, `blocked` |
| `readiness`       | JSONB checklist (non-secret)                                  |
| `last_checked_at` | Last health/readiness check                                   |

**No `tenant_id`. No RLS** — State Admin API only.

---

### 3.4.1 Global grievance library (State-curated, Sprint 6.21–6.24)

Mirrors the **service catalogue** pattern: State publishes reference types; municipalities **adopt** into `tenant_grievance_*` (or add **tenant-only** / **forked** rows via Tenant Admin).

#### `global_grievance_categories`

| Column        | Type           | Description                                      |
| ------------- | -------------- | ------------------------------------------------ |
| `code`        | VARCHAR(50) PK | Stable slug, e.g. `roads`, `drainage`            |
| `name`        | JSONB          | Multilingual labels (`en`, `bn`, `hi`)           |
| `icon`        | VARCHAR(80)    | UI icon key                                      |
| `docket_code` | VARCHAR(10)    | Optional token for future docket segment feature |
| `sort_order`  | INT            | Display order in State library                   |
| `is_active`   | BOOLEAN        | Publish flag                                     |

**Purpose:** Statewide reference taxonomy. **RLS:** none (State Admin writes).

#### `global_grievance_subtypes`

| Column                 | Type        | Description                  |
| ---------------------- | ----------- | ---------------------------- |
| `id`                   | UUID PK     | Surrogate key                |
| `global_category_code` | VARCHAR FK  | Parent category              |
| `code`                 | VARCHAR(50) | Subtype slug within category |
| `name`                 | JSONB       | Multilingual labels          |
| `sort_order`           | INT         | Picker order                 |
| `is_active`            | BOOLEAN     | Publish flag                 |

**Unique:** `(global_category_code, code)`.

**Admin notes:** Adopting into a tenant copies/links category + optional subtypes into `tenant_grievance_*` with `source = global_adopted`.

---

### 3.5 Tenant services, forms, and workflows

#### `services` (tenant services)

ULB-enabled service instance, optionally cloned from `global_service_id`.

| Column                                        | Description                         |
| --------------------------------------------- | ----------------------------------- |
| `override_config`                             | Tenant overrides to global defaults |
| `effective_fee_config`, `effective_sla_days`  | Resolved runtime config             |
| `form_schema_additions`, `workflow_overrides` | Tenant extensions                   |
| `version`                                     | Tenant service version counter      |

**Unique:** `(tenant_id, code)`.

#### `service_form_versions`

Versioned JSON Schema + UI schema per service. `status` (`draft`/`published`), `published_at`.  
Applications snapshot `form_version` integer at submission.

#### `workflows`

Per-service approval graph: `code`, `version`, `status`, `published_at`.

#### `workflow_stages`

Stages: `code`, multilingual `label`, `owner_role`, `sla_hours`, `is_initial`, `is_terminal`, `sort_order`.

#### `workflow_transitions`

Directed edges: `from_stage_id` → `to_stage_id`, `verb`, `actor_role`, `requires_comment`, `side_effects` JSONB.

#### `role_stage_map`

RBAC matrix: which `role_code` can `can_view` / `can_act` on a stage.

> **Planned (ADR-0011 / ADR-0012, not yet migrated):** `tenant_departments`, `tenant_designations` (`is_department_head`, `can_reject_municipal`), `user_designations`, `tenant_service_categories`, `designation_stage_map`, **`work_orders`** (Option A — one row per `application_id` in v1); workflow columns `owner_designation`, `actor_designation`, `stage_kind`, `guard`; application `pending_designation`. Legacy `*_role` columns remain until per-service migration. See [`docs/workflow-designations.md`](../workflow-designations.md) §9.1.

---

### 3.6 Applications and documents

#### `applications`

Citizen service requests (core transactional entity).

| Column                             | Description                            |
| ---------------------------------- | -------------------------------------- |
| `docket_no`                        | Public tracking number (UK)            |
| `service_code`                     | Denormalized for reporting             |
| `form_version`, `workflow_version` | Snapshotted versions                   |
| `status`, `status_label`           | Workflow state + i18n labels           |
| `pending_role`                     | Role that must act next                |
| `form_data`                        | Submitted answers (JSONB)              |
| `runtime_snapshot`                 | Fees, SLA, computed fields             |
| `payment_status`                   | e.g. `not_required`, `pending`, `paid` |
| `current_stage_id`                 | FK to `workflow_stages`                |

**Indexes:** by citizen, by service/status.

#### `application_timeline`

Immutable audit of stage transitions: `verb`, `from_stage`, `to_stage`, actor subject/role, `metadata`.

#### `application_comments`

Staff/citizen comments on an application.

#### `application_documents`

Citizen-uploaded service attachments (birth certificate scans, etc.). **Bytes live in MinIO/S3**; Postgres holds metadata and scan state only.

| Column                                                 | Description                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `tenant_id`, `application_id`                          | RLS-scoped ownership                                                                |
| `document_code`                                        | Form field code (e.g. `hospital_discharge`)                                         |
| `original_name`, `mime_type`, `size_mb`                | Client-declared metadata (validated at upload-intent)                               |
| `object_key`                                           | Unique S3 key under `tenants/{tenantCode}/applications/{applicationId}/documents/…` |
| `upload_status`                                        | `intent_created` → `uploaded` (after PUT + `confirm-upload`) or `rejected`          |
| `scan_status`                                          | `pending` → `processing` → `clean` / `infected` / `failed` (BullMQ worker **6.27**) |
| `scan_provider`, `scan_signature`, `scan_completed_at` | Worker audit fields                                                                 |

**Runtime flow:** `POST /api/documents/upload-intent` → browser PUT to presigned URL → `POST …/confirm-upload` (enqueues `document-scan` job) → submit gate requires `scan_status = clean`. Desk operators read rows via `GET /admin/tenant/desk/applications/:docket` and stream bytes with `GET …/documents/:id/blob` when clean. Programme: [`object-storage-upload-programme.md`](../runbooks/object-storage-upload-programme.md).

---

### 3.7 Payments and accounting

#### `payments`

Payment intents and gateway state per application.

| Column               | Description               |
| -------------------- | ------------------------- |
| `amount_paise`       | Integer amount            |
| `method`, `gateway`  | Payment rail              |
| `gateway_order_id`   | Idempotency with gateway  |
| `gateway_payment_id` | Set when captured         |
| `status`             | Gateway lifecycle         |
| `citizen_subject`    | Keycloak subject of payer |

**Unique:** `(tenant_id, gateway, gateway_order_id)`.

#### `payment_idempotency_keys`

Prevents duplicate charge creation for same client idempotency key (TTL via `expires_at`).

#### `receipts`

Official receipt after successful payment: `receipt_number`, `verification_token` (QR), revenue head codes, gateway refs.  
**1:1** with `payments`.

#### `gl_postings`

General-ledger settlement line: debit/credit account codes, `settlement_reference`, links payment + receipt.  
**Purpose:** Finance reconciliation and export to ULB accounting systems.

#### `deposits`

Refundable deposits (e.g. hall booking): `deposit_type`, `status` (`held`, `released`, `forfeited`), optional link to `application_id` and capture `payment_id`.

#### `refund_dispatches`

Deposit refund workflow with reviewer subjects and PSP completion notes.

#### `challans`

Municipal fines: `challan_no`, `violation_code`, `amount_paise`, optional citizen, issuing `user`, `paid_payment_id` when settled.

---

### 3.8 Bookings

#### `bookable_assets`

Halls, equipment, etc.: multilingual `name`, `location` JSONB, `capacity`, `metadata`.

#### `bookable_asset_availability`

Time windows (`starts_at`, `ends_at`) marked `available` or blocked.

#### `booking_reservations`

Reservations with `status` (`hold`, `confirmed`, …), optional `application_id` / `docket_no` link.

**Admin note:** Anti-overlap may use GiST exclusion constraints per ADR-0001 (verify migration for production hardening).

---

### 3.9 Grievances (configurable taxonomy + cases)

#### `tenant_grievance_categories`

Per-ULB grievance **types** shown in citizen pickers and Desk labels.

| Column                 | Type        | Description                                                                   |
| ---------------------- | ----------- | ----------------------------------------------------------------------------- |
| `tenant_id`            | UUID FK     | Owning ULB                                                                    |
| `code`                 | VARCHAR(50) | Tenant-scoped slug (may differ after **fork**, e.g. `*-local`)                |
| `global_category_code` | VARCHAR FK  | Link to `global_grievance_categories.code` when adopted; NULL for tenant-only |
| `name`                 | JSONB       | Display labels (overrides global on fork)                                     |
| `icon`                 | VARCHAR(80) | UI icon                                                                       |
| `sort_order`           | INT         | Picker order                                                                  |
| `is_active`            | BOOLEAN     | `false` hides from public catalogue; historical grievances retain `category`  |
| `source`               | VARCHAR(30) | `global_adopted`, `forked`, `tenant_only` (governance semantics in API)       |

**Unique:** `(tenant_id, code)`. **RLS:** `tenant_isolation`.  
**Public API:** `GET /api/public/grievances/catalogue?tenant_code=` returns only `is_active = true` rows.

#### `tenant_grievance_subtypes`

Optional second step in citizen filing (e.g. _Blocked drain_ under _Drainage_).

| Column          | Type        | Description                                       |
| --------------- | ----------- | ------------------------------------------------- |
| `tenant_id`     | UUID FK     | Owning ULB                                        |
| `category_code` | VARCHAR(50) | FK with `tenant_grievance_categories` (composite) |
| `code`          | VARCHAR(50) | Subtype slug                                      |
| `name`          | JSONB       | Labels                                            |
| `is_active`     | BOOLEAN     | Inactive subtypes hidden from pickers             |
| `source`        | VARCHAR(30) | Same lineage semantics as categories              |

**Unique:** `(tenant_id, category_code, code)`. **RLS:** `tenant_isolation`.

#### `sla_policies`

Tenant rules: match `category_match` / `grievance_priority_match`, `hours_to_resolve`, `sort_order`. Applied at grievance create to set `sla_due_at`.

#### `grievance_routing_rules`

Auto-route new grievances to `target_role_code` and optional `assign_user_id` / `ward_id`. Evaluated at create alongside SLA.

#### `grievances`

Citizen complaints (transactional).

| Column                | Type        | Description                                                  |
| --------------------- | ----------- | ------------------------------------------------------------ |
| `grievance_no`        | VARCHAR UK  | Public id, e.g. `GRV-KMC-2026-000021` (per-tenant sequence)  |
| `category`            | VARCHAR(50) | **Code** from catalogue at filing time (not a display label) |
| `subtype_code`        | VARCHAR(50) | Optional; required when active subtypes exist for category   |
| `description`         | TEXT        | Free-text narrative                                          |
| `location`            | JSONB       | Ward hints, `latitude`/`longitude` (WGS-84), etc.            |
| `photo_keys`          | JSONB       | Legacy array of storage keys; prefer `grievance_attachments` |
| `grievance_priority`  | VARCHAR(20) | e.g. `low`, `medium`, `high`                                 |
| `status`              | VARCHAR(30) | Lifecycle: `submitted`, `under_review`, `in_progress`, …     |
| `routed_role_code`    | VARCHAR     | From routing rules                                           |
| `assigned_to_user_id` | UUID FK     | Optional staff assignee                                      |
| `sla_due_at`          | TIMESTAMPTZ | Computed deadline                                            |
| `sla_breached_at`     | TIMESTAMPTZ | Set when overdue                                             |
| `rating`, `feedback`  |             | Post-resolution citizen feedback                             |

**Unique:** `(tenant_id, grievance_no)`. **FK:** `citizen_id` → `citizens` (per-ULB row; hub creates municipal citizen lazily).

#### `grievance_timeline`

Event stream on table `grievance_timeline` (`event_type`, `actor_subject`, `body`, `metadata`, `occurred_at`).

#### `grievance_attachments`

Structured evidence (Sprint 6.24): photo/video registered after MinIO upload intent.

| Column         | Description                                    |
| -------------- | ---------------------------------------------- |
| `storage_key`  | Object key under tenant prefix (max 500 chars) |
| `content_type` | MIME, e.g. `image/jpeg`, `video/mp4`           |

**Index:** `(tenant_id, grievance_id)`. Metadata only — bytes live in object storage.

---

### 3.10 Property holdings (mirror)

#### `holding_records`

Local mirror of property tax holdings: `holding_number`, owner, ward, locality, `outstanding_amount`, `source`, `source_updated_at`.

#### `holding_lookup_audit`

Every lookup attempt: `holding_number`, `actor_subject`, `outcome` (found/not found/denied), optional `holding_id` FK.

**Purpose:** Compliance audit for sensitive property data access.

---

### 3.11 State audit and impersonation

#### `state_audit_logs`

Cross-tenant audit trail for State and Tenant Admin mutations.

| Column             | Description                        |
| ------------------ | ---------------------------------- |
| `actor_subject`    | Keycloak `sub`                     |
| `actor_role`       | e.g. `state_admin`, `tenant_admin` |
| `action`           | Namespaced action code             |
| `target_tenant_id` | Optional ULB affected              |
| `target_code`      | Optional entity code               |
| `metadata`         | JSONB context (no secrets)         |

**No RLS.** Retention and PII policies are operational concerns.

#### `impersonation_tokens`

Short-lived tokens for State Admin support impersonation into a tenant context: `token_id` UK, `reason`, `expires_at`, `revoked_at`.

---

## 4. Row-Level Security (RLS) summary

| Table                                                                         | Policy name          | Rule                                                                         |
| ----------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `tenants`                                                                     | `tenant_public_read` | `SELECT` allowed for all rows                                                |
| `roles`                                                                       | `roles_public_read`  | `SELECT` allowed for all rows                                                |
| `revenue_heads`, `service_categories`, `global_services`, `service_documents` | `*_public_read`      | `SELECT` allowed for all rows                                                |
| `tenant_grievance_categories`, `tenant_grievance_subtypes`                    | `tenant_isolation`   | Same as other tenant tables (migration `20260519120000_grievance_taxonomy`)  |
| All other tables listed in §3 with `tenant_id`                                | `tenant_isolation`   | `USING` / `WITH CHECK`: `tenant_id = current_setting('app.tenant_id')::uuid` |
| `global_grievance_categories`, `global_grievance_subtypes`                    | _(none)_             | State Admin / seed; no citizen RLS read policy                               |
| `state_audit_logs`, `impersonation_tokens`, `state_integrations`              | _(none)_             | Application-layer authorization only                                         |

**System admin implication:** Direct SQL access must either set `SET app.tenant_id = '...'` for tenant-scoped tables or use a superuser role that bypasses RLS (not used by the application).

---

## 5. Key relationships quick reference

| From                          | To                            | Cardinality | On delete                                             |
| ----------------------------- | ----------------------------- | ----------- | ----------------------------------------------------- |
| `tenants`                     | Most child tables             | 1:N         | CASCADE                                               |
| `global_services`             | `services`                    | 1:N         | SET NULL                                              |
| `services`                    | `applications`                | 1:N         | RESTRICT                                              |
| `citizens`                    | `applications`                | 1:N         | CASCADE                                               |
| `applications`                | `payments`                    | 1:N         | CASCADE                                               |
| `payments`                    | `receipts`                    | 1:1         | CASCADE                                               |
| `payments`                    | `gl_postings`                 | 1:1         | CASCADE                                               |
| `workflows`                   | `workflow_stages`             | 1:N         | CASCADE                                               |
| `workflow_stages`             | `workflow_transitions`        | 1:N         | CASCADE                                               |
| `global_grievance_categories` | `global_grievance_subtypes`   | 1:N         | CASCADE                                               |
| `global_grievance_categories` | `tenant_grievance_categories` | 1:N         | SET NULL                                              |
| `tenant_grievance_categories` | `tenant_grievance_subtypes`   | 1:N         | CASCADE                                               |
| `tenant_grievance_categories` | `grievances.category`         | logical     | codes must match active row when catalogue configured |
| `citizens`                    | `grievances`                  | 1:N         | RESTRICT                                              |

---

## 6. Operational guidance for system administrators

### 6.1 Backup and restore

- Use **logical backups** (`pg_dump`) or `pgBackRest` / `wal-g` for point-in-time recovery (see ADR-0001).
- Restore to the same major PostgreSQL version (16).
- After restore, run `pnpm --filter @enagar/api prisma:migrate:deploy` only if migration history is behind.

### 6.2 Migrations

```powershell
$env:DATABASE_URL = "postgresql://enagar:<password>@localhost:5432/enagarseba?schema=public"
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed   # optional dev seed from repo root
```

### 6.3 Health checks

- API logs Postgres target on startup: `[api] Postgres target: host=… db=enagarseba`
- Verify RLS: security pack `tests/security/tenant-isolation.spec.ts` and sprint specs under `tests/security/`.

### 6.4 Sensitive data inventory

| Data            | Storage                                       | Notes                                         |
| --------------- | --------------------------------------------- | --------------------------------------------- |
| Passwords / MFA | Keycloak                                      | Not in Postgres                               |
| Aadhaar         | `citizens.aadhaar_hash` only                  | SHA-256                                       |
| Payment secrets | PSP / env vars                                | Not in `state_integrations`                   |
| Uploaded files  | MinIO/S3 (`object_key`, `storage_key`)        | DB holds metadata only; bytes not in Postgres |
| PII             | `citizens`, `users`, `grievances`, `challans` | Subject to retention policy                   |

**Object storage runtime (programme 6.25–6.30, closed 2026-05-21):**

- **API:** `ObjectStorageService` — env `OBJECT_STORAGE_*`, `OBJECT_STORAGE_PUBLIC_BASE` (see `infrastructure/.env.example`).
- **Tables:** `application_documents`, `grievance_attachments`, `tenant_branding_assets`.
- **Scan queue:** Redis `REDIS_URL` + `services/document-scan-worker` (BullMQ `document-scan`); dev stub via `DOCUMENT_SCAN_STUB` / `ALLOW_CLIENT_SCAN_SIMULATION`.
- **Local:** bucket `enagar-local`, `pnpm infra:minio-cors`, set `OBJECT_STORAGE_DISABLED=false`.
- **Smoke:** `node scripts/smoke-sprint-630-programme.mjs` from repo root.
- **Docs:** [`object-storage-upload-programme.md`](../runbooks/object-storage-upload-programme.md), [`master-sprint-630-exit.md`](../runbooks/master-sprint-630-exit.md).

### 6.5 Common admin queries

**List active tenants:**

```sql
SELECT id, code, name, is_active, ward_count
FROM tenants
WHERE is_active = TRUE
ORDER BY code;
```

**Table sizes (monitoring):**

```sql
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 25;
```

**Recent state audit (requires DB role that can read table):**

```sql
SELECT created_at, actor_role, action, target_code, target_tenant_id
FROM state_audit_logs
ORDER BY created_at DESC
LIMIT 50;
```

**Set tenant context for RLS-scoped inspection:**

```sql
SET app.tenant_id = '<tenant-uuid-from-tenants.id>';
SELECT COUNT(*) FROM applications;
RESET app.tenant_id;
```

**Active grievance catalogue for one ULB (no RLS context needed for read-only public rows):**

```sql
SELECT c.code AS category, c.is_active, c.source,
       COUNT(s.code) AS subtype_count
FROM tenant_grievance_categories c
LEFT JOIN tenant_grievance_subtypes s
  ON s.tenant_id = c.tenant_id AND s.category_code = c.code AND s.is_active = TRUE
JOIN tenants t ON t.id = c.tenant_id AND t.code = 'KMC'
WHERE c.is_active = TRUE
GROUP BY c.code, c.is_active, c.source, c.sort_order
ORDER BY c.sort_order;
```

**Grievances filed per category (Desk reporting):**

```sql
SET app.tenant_id = (SELECT id FROM tenants WHERE code = 'KMC');
SELECT category, subtype_code, status, COUNT(*) AS cnt
FROM grievances
GROUP BY category, subtype_code, status
ORDER BY category, subtype_code;
RESET app.tenant_id;
```

---

## 7. Table index (alphabetical)

| #   | Table                         | Scope                      |
| --- | ----------------------------- | -------------------------- |
| 1   | `application_comments`        | Tenant                     |
| 2   | `application_documents`       | Tenant                     |
| 3   | `application_timeline`        | Tenant                     |
| 4   | `applications`                | Tenant                     |
| 5   | `bookable_asset_availability` | Tenant                     |
| 6   | `bookable_assets`             | Tenant                     |
| 7   | `booking_reservations`        | Tenant                     |
| 8   | `boroughs`                    | Tenant                     |
| 9   | `challans`                    | Tenant                     |
| 10  | `citizen_push_devices`        | Tenant                     |
| 11  | `citizens`                    | Tenant                     |
| 12  | `deposits`                    | Tenant                     |
| 13  | `gl_postings`                 | Tenant                     |
| 14  | `global_grievance_categories` | Global (grievance library) |
| 15  | `global_grievance_subtypes`   | Global (grievance library) |
| 16  | `global_services`             | Global                     |
| 17  | `grievance_attachments`       | Tenant                     |
| 18  | `grievance_routing_rules`     | Tenant                     |
| 19  | `grievance_timeline`          | Tenant                     |
| 20  | `grievances`                  | Tenant                     |
| 21  | `holding_lookup_audit`        | Tenant                     |
| 22  | `holding_records`             | Tenant                     |
| 23  | `impersonation_tokens`        | State                      |
| 24  | `kb_articles`                 | Tenant                     |
| 25  | `kb_index_jobs`               | Tenant                     |
| 26  | `localities`                  | Tenant                     |
| 27  | `notification_templates`      | Tenant                     |
| 28  | `notifications`               | Tenant                     |
| 29  | `payment_idempotency_keys`    | Tenant                     |
| 30  | `payments`                    | Tenant                     |
| 31  | `receipts`                    | Tenant                     |
| 32  | `refund_dispatches`           | Tenant                     |
| 33  | `revenue_heads`               | Global                     |
| 34  | `role_stage_map`              | Tenant                     |
| 35  | `roles`                       | Global                     |
| 36  | `service_categories`          | Global                     |
| 37  | `service_documents`           | Global                     |
| 38  | `service_form_versions`       | Tenant                     |
| 39  | `services`                    | Tenant                     |
| 40  | `sla_policies`                | Tenant                     |
| 41  | `staff_invites`               | Tenant                     |
| 42  | `state_audit_logs`            | State                      |
| 43  | `state_integrations`          | State                      |
| 44  | `tenant_banners`              | Tenant                     |
| 45  | `tenant_branding_assets`      | Tenant                     |
| 46  | `tenant_config`               | Tenant                     |
| 47  | `tenant_grievance_categories` | Tenant                     |
| 48  | `tenant_grievance_subtypes`   | Tenant                     |
| 49  | `tenant_tariffs`              | Tenant                     |
| 50  | `tenants`                     | Registry                   |
| 51  | `user_roles`                  | Tenant                     |
| 52  | `users`                       | Tenant                     |
| 53  | `wards`                       | Tenant                     |
| 54  | `workflow_stages`             | Tenant                     |
| 55  | `workflow_transitions`        | Tenant                     |
| 56  | `workflows`                   | Tenant                     |

**Total: 56 tables** (as of Master Sprints **6.21–6.24** grievance taxonomy + Phase 6 P5 schema).

**Seed coverage (dev):** `pnpm db:seed` loads global + **KMC/HMC** grievance catalogues from `grievance-catalogue.seed.ts`; other operational ULBs get **services** but may have **empty** `tenant_grievance_*` until State **adopt** or Tenant Admin **add local** — see [`grievance-taxonomy-programme.md`](../runbooks/grievance-taxonomy-programme.md).

---

## 8. Related documentation

- [ADR-0001 — PostgreSQL 16](../ADRs/ADR-0001-database-postgresql.md) — RLS, JSONB, exclusion constraints
- [Grievance taxonomy programme](../runbooks/grievance-taxonomy-programme.md) — Sprints 6.21–6.24, adopt/fork/deactivate
- [Citizen unified hub](../runbooks/citizen-unified-hub.md) — WBPORTAL JWT and `X-Enagar-Tenant-Code`
- [Form schema guide](../form-schema.md) — JSON Schema in `form_schema` columns
- [Start the app step-by-step](../help/start-the-app-step-by-step.md) — local `enagarseba` setup, operator “add grievance type”
- [Glossary — grievance taxonomy](../glossary.md) — domain terms
- Prisma schema: `apps/api/prisma/schema.prisma`
- Migration: `apps/api/prisma/migrations/20260519120000_grievance_taxonomy/migration.sql`

_Aligned with repository schema at commit `f93b713`. Re-verify after migrations if this document drifts._
