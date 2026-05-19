# eNagar Database Reference — System Administrator Guide

**Database name (local dev):** `enagarseba`  
**Engine:** PostgreSQL 16  
**ORM / migrations:** Prisma (`apps/api/prisma/schema.prisma`)  
**Connection (typical dev):** `postgresql://enagar:***@localhost:5432/enagarseba?schema=public`  
**Source of truth:** Prisma schema + SQL migrations under `apps/api/prisma/migrations/`

This document is for **system administrators** who operate, monitor, back up, and troubleshoot the platform database. It describes all application tables, how they relate, and how multi-tenant isolation is enforced.

---

## 1. Platform overview

eNagar is a **multi-tenant municipal services platform**. Each **tenant** is a Urban Local Body (ULB), e.g. KMC or HMC. Almost all operational data is scoped by `tenant_id`.

| Layer                    | Responsibility                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| **PostgreSQL**           | Persistent data, constraints, Row-Level Security (RLS)                        |
| **@enagar/api (NestJS)** | Business logic; sets `app.tenant_id` session variable per request             |
| **Keycloak**             | Authentication; staff/citizen identities (UUID subjects)                      |
| **State Admin**          | Cross-tenant governance: global service library, integrations metadata, audit |
| **Tenant Admin**         | Per-ULB configuration: services, workflows, staff, tariffs, content           |

### 1.1 Data scope classes

| Scope                          | Tables                                                                        | RLS pattern                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Global catalogue**           | `revenue_heads`, `service_categories`, `global_services`, `service_documents` | `public_read` — any session can `SELECT`                                                          |
| **State platform**             | `state_audit_logs`, `impersonation_tokens`, `state_integrations`              | **No RLS** — access only via State Admin API / elevated DB role                                   |
| **Tenant registry (read-all)** | `tenants`, `roles`                                                            | `public_read` on `SELECT` only                                                                    |
| **Tenant-isolated**            | All other tables with `tenant_id`                                             | `tenant_isolation` — row visible only when `tenant_id` matches `current_setting('app.tenant_id')` |

The API sets `SET app.tenant_id = '<uuid>'` from the JWT before running tenant-scoped queries. Cross-tenant access is blocked at the database layer when RLS is enabled.

### 1.2 High-level domain map

```mermaid
flowchart TB
  subgraph Global["Global / State scope"]
    RH[revenue_heads]
    SC[service_categories]
    GS[global_services]
    SD[service_documents]
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
  GS --> SVC
  SVC --> APP
  APP --> PAY
  PAY --> RCP
  RCP --> GL
```

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

### 2.6 Grievances, SLA, and routing

```mermaid
erDiagram
  tenants ||--o{ sla_policies : defines
  tenants ||--o{ grievance_routing_rules : routes
  citizens ||--o{ grievances : files
  users ||--o{ grievances : assigned
  wards ||--o{ grievance_routing_rules : matches
  grievances ||--o{ grievance_timeline : events
  grievances ||--o{ grievance_attachments : files

  grievances {
    uuid id PK
    varchar grievance_no UK
    timestamptz sla_due_at
    varchar status
  }
```

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

**Purpose:** Citizen profile per ULB. One person may have rows in multiple tenants.  
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

Uploaded files: `object_key` (object storage), `upload_status`, `scan_status`, virus-scan provider fields.

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

### 3.9 Grievances

#### `sla_policies`

Tenant rules: match `category_match` / `grievance_priority_match`, `hours_to_resolve`, `sort_order`.

#### `grievance_routing_rules`

Auto-route new grievances to `target_role_code` and optional `assign_user_id` / `ward_id`.

#### `grievances`

Citizen complaints: `grievance_no`, `category`, `location` JSONB, `photo_keys`, priority, SLA timestamps, rating/feedback.

#### `grievance_timeline`

Event stream (`event_type`, `actor_subject`, `body`, `metadata`).

#### `grievance_attachments`

Object storage keys for photos/files.

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
| All tables listed in §3 with `tenant_id`                                      | `tenant_isolation`   | `USING` / `WITH CHECK`: `tenant_id = current_setting('app.tenant_id')::uuid` |
| `state_audit_logs`, `impersonation_tokens`, `state_integrations`              | _(none)_             | Application-layer authorization only                                         |

**System admin implication:** Direct SQL access must either set `SET app.tenant_id = '...'` for tenant-scoped tables or use a superuser role that bypasses RLS (not used by the application).

---

## 5. Key relationships quick reference

| From              | To                     | Cardinality | On delete |
| ----------------- | ---------------------- | ----------- | --------- |
| `tenants`         | Most child tables      | 1:N         | CASCADE   |
| `global_services` | `services`             | 1:N         | SET NULL  |
| `services`        | `applications`         | 1:N         | RESTRICT  |
| `citizens`        | `applications`         | 1:N         | CASCADE   |
| `applications`    | `payments`             | 1:N         | CASCADE   |
| `payments`        | `receipts`             | 1:1         | CASCADE   |
| `payments`        | `gl_postings`          | 1:1         | CASCADE   |
| `workflows`       | `workflow_stages`      | 1:N         | CASCADE   |
| `workflow_stages` | `workflow_transitions` | 1:N         | CASCADE   |

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

| Data            | Storage                                       | Notes                       |
| --------------- | --------------------------------------------- | --------------------------- |
| Passwords / MFA | Keycloak                                      | Not in Postgres             |
| Aadhaar         | `citizens.aadhaar_hash` only                  | SHA-256                     |
| Payment secrets | PSP / env vars                                | Not in `state_integrations` |
| Uploaded files  | Object storage (`object_key`, `storage_key`)  | DB holds metadata only      |
| PII             | `citizens`, `users`, `grievances`, `challans` | Subject to retention policy |

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

---

## 7. Table index (alphabetical)

| #   | Table                         | Scope    |
| --- | ----------------------------- | -------- |
| 1   | `application_comments`        | Tenant   |
| 2   | `application_documents`       | Tenant   |
| 3   | `application_timeline`        | Tenant   |
| 4   | `applications`                | Tenant   |
| 5   | `bookable_asset_availability` | Tenant   |
| 6   | `bookable_assets`             | Tenant   |
| 7   | `booking_reservations`        | Tenant   |
| 8   | `boroughs`                    | Tenant   |
| 9   | `challans`                    | Tenant   |
| 10  | `citizen_push_devices`        | Tenant   |
| 11  | `citizens`                    | Tenant   |
| 12  | `deposits`                    | Tenant   |
| 13  | `gl_postings`                 | Tenant   |
| 14  | `global_services`             | Global   |
| 15  | `grievance_attachments`       | Tenant   |
| 16  | `grievance_routing_rules`     | Tenant   |
| 17  | `grievance_timeline`          | Tenant   |
| 18  | `grievances`                  | Tenant   |
| 19  | `holding_lookup_audit`        | Tenant   |
| 20  | `holding_records`             | Tenant   |
| 21  | `impersonation_tokens`        | State    |
| 22  | `kb_articles`                 | Tenant   |
| 23  | `kb_index_jobs`               | Tenant   |
| 24  | `localities`                  | Tenant   |
| 25  | `notification_templates`      | Tenant   |
| 26  | `notifications`               | Tenant   |
| 27  | `payment_idempotency_keys`    | Tenant   |
| 28  | `payments`                    | Tenant   |
| 29  | `receipts`                    | Tenant   |
| 30  | `refund_dispatches`           | Tenant   |
| 31  | `revenue_heads`               | Global   |
| 32  | `role_stage_map`              | Tenant   |
| 33  | `roles`                       | Global   |
| 34  | `service_categories`          | Global   |
| 35  | `service_documents`           | Global   |
| 36  | `service_form_versions`       | Tenant   |
| 37  | `services`                    | Tenant   |
| 38  | `sla_policies`                | Tenant   |
| 39  | `staff_invites`               | Tenant   |
| 40  | `state_audit_logs`            | State    |
| 41  | `state_integrations`          | State    |
| 42  | `tenant_banners`              | Tenant   |
| 43  | `tenant_branding_assets`      | Tenant   |
| 44  | `tenant_config`               | Tenant   |
| 45  | `tenant_tariffs`              | Tenant   |
| 46  | `tenants`                     | Registry |
| 47  | `user_roles`                  | Tenant   |
| 48  | `users`                       | Tenant   |
| 49  | `wards`                       | Tenant   |
| 50  | `workflow_stages`             | Tenant   |
| 51  | `workflow_transitions`        | Tenant   |
| 52  | `workflows`                   | Tenant   |

**Total: 52 tables** (as of Master Sprint 6.12 / commit with Phase 6 P5 schema).

---

## 8. Related documentation

- [ADR-0001 — PostgreSQL 16](../ADRs/ADR-0001-database-postgresql.md) — RLS, JSONB, exclusion constraints
- [Form schema guide](../form-schema.md) — JSON Schema in `form_schema` columns
- [Start the app step-by-step](../help/start-the-app-step-by-step.md) — local `enagarseba` setup
- Prisma schema: `apps/api/prisma/schema.prisma`

_Generated from repository schema. Re-verify after migrations if this document drifts._
