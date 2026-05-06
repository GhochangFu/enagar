Three excellent questions — they're exactly the integration scenarios v1 has to solve cleanly. Walking through each in three layers: **(a) what the user sees, (b) what happens server-side, (c) the data shape that gets created/changed**.

---

## 1. How a new Municipality (ULB) gets onboarded

> **Actor:** State Super-Admin (`apps/admin-state`).  
> **When:** On request from DoUD&MA (e.g. _"Onboard Siliguri Municipal Corporation"_).  
> **Effort:** ~30 min of admin clicks. **Zero code, zero deploys** — that's the plug-and-play promise.

### a. What the State Super-Admin sees

```
admin-state portal
└── Tenants → [+ Onboard new ULB]
    │
    ├── Step 1 · Basics
    │     • Tenant code      [SMC]                ← unique, immutable
    │     • Full name        [Siliguri Municipal Corporation]
    │     • Type             [ Municipal Corporation ▾ ]
    │     • District         [ Darjeeling ▾ ]
    │     • Ward count       [47]
    │     • Default language [ Bengali ▾ ]
    │     • Languages enabled [✓ en] [✓ bn] [ ] hi
    │
    ├── Step 2 · Branding & subdomain
    │     • Brand colour     [#2E7D32]            ← AA-contrast guard runs live
    │     • Logo (SVG)       [📎 upload]
    │     • Empty-state art  [📎 upload]   (optional)
    │     • Subdomain        [siliguri.enagar.gov.in]
    │
    ├── Step 3 · Service catalogue
    │     ☑ Adopt all 76 state templates with default values
    │     ☐ Customise — pick categories / per-service overrides
    │
    ├── Step 4 · Initial Tenant Admin
    │     • Name             [Mr. A. Roy]
    │     • Email            [admin@smc.gov.in]
    │     • Mobile           [+91 9876543210]
    │     • Role             [tenant_admin]
    │     • MFA              [ Required ✓ ]      ← cannot be unchecked
    │
    ├── Step 5 · Compliance & legal
    │     ☑ DigiLocker integration approval signed
    │     ☑ DPDP-Act privacy notice acknowledged
    │     ☑ Data Processing Agreement template received
    │
    └── Step 6 · Review → [ Onboard SMC ]
```

The wizard is one click per step. Most fields are picked, not typed.

### b. What the platform does on click of _Onboard SMC_

A single transactional `tenant.onboard` job (BullMQ) runs through this list:

| #   | Action                                                                                                                                                                         | Where                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | `INSERT INTO tenants` row with the wizard data                                                                                                                                 | Postgres `tenants`      |
| 2   | Create Keycloak **groups** for the tenant (`smc-citizens`, `smc-officers`, `smc-admin`) and a tenant-scoped **role** mapper that injects `tenant_id` + `tenant_code` into JWTs | Keycloak realm `enagar` |
| 3   | Create the initial **Tenant Admin** user; mark MFA as required; send a one-time enrolment link by email                                                                        | Keycloak + email worker |
| 4   | Create per-tenant **MinIO buckets**: `tenant-smc-uploads`, `tenant-smc-certificates`, `tenant-smc-grievance-photos` (object-lock enabled)                                      | MinIO                   |
| 5   | Create the per-tenant **Qdrant collection** `kb-smc` for the chatbot KB                                                                                                        | Qdrant                  |
| 6   | Clone the 76 **state service templates** into `services` table with `tenant_id = SMC` and default values from `docs/service-catalogue.md` §9                                   | Postgres                |
| 7   | Register **per-tenant BullMQ queues** for workflow + notification + reporting (queue names are `tenant-smc-*`)                                                                 | Redis                   |
| 8   | Provision **DNS + ingress**: route `siliguri.enagar.gov.in` to the platform; certificate issued by the cluster cert-manager                                                    | K8s ingress + DNS       |
| 9   | Bootstrap the **i18n entry**: tenant-specific translation overrides start empty; the catalogue uses platform defaults                                                          | `@enagar/i18n` runtime  |
| 10  | Write an **audit log** row with the actor (state-admin) + onboarding payload                                                                                                   | Postgres `audit_log`    |
| 11  | Send **welcome email** to the Tenant Admin with the subdomain, MFA QR, and onboarding checklist link                                                                           | Notification worker     |

> **What does _not_ happen:** no application binary changes, no CI run, no manual SQL, no helm deploy. Everything is data and config.

### c. Data shape created

```ts
// One Postgres row in the tenants table — this is the source of truth.

tenants.row = {
  id: 'tnt_01HXY8…', // ULID
  code: 'SMC',
  full_name: 'Siliguri Municipal Corporation',
  type: 'municipal_corporation',
  district: 'Darjeeling',
  ward_count: 47,
  default_language: 'bn',
  languages_enabled: ['en', 'bn'],
  brand_color: '#2E7D32',
  logo_url: 'minio://tenant-smc-assets/logo.svg',
  subdomain: 'siliguri.enagar.gov.in',
  config: {
    // JSONB — the per-tenant feature switches
    chatbot: { provider: 'openai', model: 'gpt-4o-mini' }, // ADR-0008
    digilocker: { enabled: true },
    sla_auto_approve: false,
    disabled_categories: [],
    payment_gateway: 'stub', // until ADR-0006 lands
    external_data_providers: {}, // ← the §3 hook, populated later
  },
  active: true,
  onboarded_at: '2026-05-06T12:00:00Z',
  onboarded_by: 'state_admin_uuid',
};
```

After onboarding, the Tenant Admin receives an email, signs in, and lands in `apps/admin-tenant` to do the _first-run wizard_: ward import, officer roster, branding tweaks, language overrides, advanced overrides on the 76 services.

> **Living code references** (Phase 6 implements all of this): `apps/admin-state/src/onboard-tenant/*`, `apps/api/src/modules/tenant/onboard.service.ts`, `services/notification-worker/src/jobs/welcome-tenant-admin.ts`.

---

## 2. How a Tenant Admin adds a new Service

> **Actor:** Tenant Admin (`apps/admin-tenant`).  
> **Three flavours**, in order of effort:

| Flavour                                    | When                                                                       | Effort    |
| ------------------------------------------ | -------------------------------------------------------------------------- | --------- |
| **A. Adopt a State Template as-is**        | Most common (e.g. "we want Birth Cert")                                    | 1 click   |
| **B. Adopt + Override**                    | When fees / SLA / form differ from state defaults                          | 5–15 min  |
| **C. Create a Tenant-Only Custom Service** | Statutorily-tenant-specific (e.g. _Darjeeling Hilly-Area Building Permit_) | 30–60 min |

### A. Adopt a State Template as-is

#### a. What the Tenant Admin sees

```
admin-tenant → Catalogue → [+ Add service from State Templates]

  Filter by category:  [All ▾]
  Search:              [hoarding________________]

  ┌── Hoarding Permission & Tax (ad-hoarding) ──────────┐
  │ Category: Advertising                                │
  │ Fee: ₹5 000   SLA: 15 days   Pattern: cert-issuance  │
  │ [ Preview ]                       [   Activate   ]   │
  └─────────────────────────────────────────────────────┘
```

One **Activate** click.

#### b. What the platform does

```sql
-- Idempotent INSERT — if the tenant already adopted, the row exists.
INSERT INTO services (
  id, tenant_id, code, source, parent_template_code,
  category_code, title, description,
  fees, late_fee, sla_days, eligibility,
  required_documents, form_schema, workflow_pattern,
  active, version, created_at, updated_at
)
SELECT
  ulid(), '<smc>', 'ad-hoarding', 'state-template-clone', 'ad-hoarding',
  category_code, title, description,
  fees, late_fee, sla_days, eligibility,
  required_documents, form_schema, workflow_pattern,
  TRUE, 1, now(), now()
FROM service_templates
WHERE code = 'ad-hoarding';
```

Then:

- The catalogue cache key for SMC is invalidated → citizens see the new service on next load.
- An audit-log row records the adoption + the actor.
- Mat-view `mv_tenant_service_summary` is refreshed for SMC.

### B. Adopt + Override

#### a. What the Tenant Admin sees

After Activate (or anytime later), they click **Customise** and step through a **diff editor** — only the fields they change get persisted as overrides.

```
admin-tenant → Catalogue → ad-hoarding → [ Customise ]

┌── Override editor ──────────────────────────────────────┐
│ Identity (locked)         code: ad-hoarding              │
│                           category: adv                  │
│                                                          │
│ Display                   ☐ Override title?              │
│                           ☐ Override description?        │
│                                                          │
│ Money                     ☑ Override fees                │
│                                                          │
│   ┌── Fees editor ─────────────────────────────────┐    │
│   │ State default:  fixed   ₹ 5 000                │    │
│   │ SMC override:   slab    by ward × sq.ft.       │    │
│   │   ┌─ Slab ─────────────────────────────────┐  │    │
│   │   │ ≤ 100 sq.ft.       ₹ 3 000              │  │    │
│   │   │ 101–250 sq.ft.     ₹ 7 000              │  │    │
│   │   │ > 250 sq.ft.       ₹15 000              │  │    │
│   │   └────────────────────────────────────────┘  │    │
│   └────────────────────────────────────────────────┘    │
│                                                          │
│ SLA                       ☑ Override SLA  [ 10 days ]    │
│ Required documents        ☐ Override                     │
│ Form fields               ☑ Add fields                   │
│   + ward_number            (number, required)            │
│   + size_sqft              (number, required)            │
│ Workflow                  ☐ Override                     │
│ Eligibility               ☐ Override                     │
│                                                          │
│         [ Preview as citizen ]   [ Save & publish ]      │
└──────────────────────────────────────────────────────────┘
```

The editor enforces the rules from `docs/service-catalogue.md` §11:

- A statutory required-document **cannot** be removed (the State Template flags it).
- A workflow stage marked statutory **cannot** be skipped (only insertions allowed).
- Fields can only be **added**, never removed (otherwise existing citizen drafts break).
- A contrast / completeness check runs server-side before publish.

#### b. What the platform does

The override is stored as a **partial JSONB diff**, not a copy of the whole template:

```sql
UPDATE services
SET overrides = jsonb_build_object(
      'fees', '{ "kind":"slab", "based_on":"sqft",
                 "slabs":[{"upto":100,"amount_paise":300000},…] }'::jsonb,
      'sla_days', 10,
      'form_schema_extensions', '[…]'::jsonb
    ),
    version = version + 1,
    updated_at = now()
WHERE tenant_id = '<smc>' AND code = 'ad-hoarding';
```

At runtime the API computes the **effective service definition** by merging:

```
state_template (the global default)
  + tenant_service_row.overrides
  + (later, optional) ward-level surcharges
  = effective ServiceTemplate that the citizen sees
```

This merge logic is the job of `ServiceResolverService` in `apps/api/src/modules/service/`. Citizens always hit the same `GET /services/:code` endpoint — they never know overrides exist.

### C. Create a Tenant-Only Custom Service

When no state template fits (e.g. _Hilly-Area Building Permit_), the Tenant Admin uses the full builder. Same shape as the override editor, but starting from blank:

```
admin-tenant → Catalogue → [+ Create custom service]

  Step 1 · Identity     code · category · title-en/bn/hi · icon · pattern
  Step 2 · Fees         (kind picker drives the rest)
  Step 3 · Eligibility  age / citizen-only / requires-holding / custom rule
  Step 4 · Required docs Check from a shared library + add bespoke
  Step 5 · Form fields  Drag-drop JSON-Schema builder ←── @enagar/forms editor
  Step 6 · Workflow     Pick a pattern, optionally insert/append stages
  Step 7 · SLA          per-stage sliders + escalation rules
  Step 8 · Preview & publish
```

Stored with `source = 'tenant-custom'` and `parent_template_code = NULL`. Otherwise structurally identical to an adopted+overridden template.

> **Phase mapping.** Tenant-Admin "Adopt + Override" lands in **Phase 6 Sprint 6.1**; the drag-drop **Form-Schema Builder** in Phase 6 Sprint 6.2; the visual **Workflow Editor** in Phase 6 Sprint 6.3. Until then the same operations are doable via the API but not a click-UI. (See `ROADMAP.md` Phase 6.)

---

## 3. External-system integration — Property-Tax Assessee Search

This is the most architecturally interesting question, because **most ULBs already have legacy systems** that own assessee data, dues, water-meter readings, building-plan registries, etc. eNagarSeba **does not own that data**; it queries it on demand.

The pattern is the same one we used for LLMs (ADR-0008): **per-service, per-tenant adapter**.

### 3.1 The conceptual picture

```
┌──────────────── eNagarSeba citizen-PWA ────────────────┐
│                                                          │
│   Property-Tax form                                       │
│   ┌────────────────────────────────────────────────┐    │
│   │ Holding number  [64 / PARK-ST / 12B  ] 🔍 Lookup │ ◀── 1
│   └────────────────────────────────────────────────┘    │
│                                                          │
│   ❮ on-blur or Lookup-click ❯                            │
└────────────────┬─────────────────────────────────────────┘
                 │ POST /api/v1/services/prop-tax/lookup
                 │   body: { holding_no: "64/PARK-ST/12B" }
                 ▼
┌──────────── apps/api  (NestJS) ─────────────────────────┐
│                                                          │
│   Controller → LookupService                              │
│     resolves which adapter for this tenant               │
│     ↓                                                     │
│   ExternalDataAdapterRegistry.get('prop-tax', 'KMC')      │
│     ↓ returns one of:                                     │
│       • KMCSAPAdapter            (tenant-specific)        │
│       • GenericRestAdapter       (re-usable HTTP)         │
│       • SOAPAdapter              (legacy WSDL)            │
│       • CSVNightlyMirrorAdapter  (no live API → batched)  │
│       • StubAdapter              (dev / tenant has no IT) │
│     ↓                                                     │
│   adapter.lookup({ holding_no, tenant }) → AssesseeDTO    │
└────────────────┬─────────────────────────────────────────┘
                 │  (over the egress allow-list, mTLS, audited)
                 ▼
       ╔═══════════════════════════════════════╗
       ║  KMC's existing Property-Tax SAP system║
       ║  (or HMC's legacy SOAP, or AMC's nightly║
       ║   CSV dump in MinIO, or our stub)     ║
       ╚═══════════════════════════════════════╝
```

### 3.2 The adapter contract

A tiny, opinionated TypeScript interface — analogous to `ILLMProvider`:

```ts
// packages/types/src/external-data.ts

export interface IExternalDataProvider<TInput, TOutput> {
  readonly id: string; // 'kmc-sap-tax' | 'generic-rest' | …
  readonly serviceCode: string; // 'prop-tax', 'water-bill', 'mutation', …

  /**
   * Returns normalised data, regardless of upstream wire format.
   * MUST timeout in ≤ 5 s (configurable per tenant).
   * MUST be idempotent and side-effect-free.
   */
  lookup(input: TInput, ctx: TenantContext): Promise<TOutput>;
}

export interface AssesseeLookupInput {
  holding_no: string;
}
export interface AssesseeLookupOutput {
  found: boolean;
  owner_name?: string;
  built_up_sqft?: number;
  ward_id?: string;
  current_year_tax_paise: number;
  outstanding_paise: number;
  late_fee_paise: number;
  last_paid_on?: string;
  legacy_assessee_id?: string; // for the eventual payment call
  source: 'live' | 'mirror' | 'cache';
  fetched_at: string;
}
```

### 3.3 The service template declares the lookup

The catalogue row for `prop-tax` carries an `external_lookup` block — this is the new piece we add to the `ServiceTemplate` shape from `docs/service-catalogue.md` §3:

```ts
// State template default (zero-config — falls back to manual entry)
prop-tax.external_lookup = {
  enabled: false,
  endpoint: '/services/prop-tax/lookup',
  trigger_field: 'holding_number',
  trigger_event: 'blur',           // or 'click' or 'on-load'
  prefill_fields: [                // form fields to auto-populate
    { from: 'owner_name',          to: 'owner_name'         },
    { from: 'built_up_sqft',       to: 'built_up_sqft'      },
    { from: 'current_year_tax_paise+outstanding_paise+late_fee_paise',
      to:   'total_payable_paise'                            },
  ],
  show_summary_card: true,         // citizen sees the dues breakdown
};

// Tenant override (KMC plugs in a real adapter)
tenants[KMC].config.external_data_providers['prop-tax'] = {
  enabled: true,
  adapter_id: 'kmc-sap-tax',
  config: {
    base_url: 'https://tax-api.kmcgov.in/v2',
    auth: { kind: 'oauth2_client_credentials', client_id_secret_ref: 'vault://kmc/tax/client' },
    timeout_ms: 5000,
    cache_ttl_sec: 300,
    fail_open: false,              // hard-fail (citizen sees an error, not blank)
  },
};
```

The State Template stays **agnostic** to any specific ULB's backend. Each tenant overrides the `external_data_providers.<service_code>` block on their own row.

### 3.4 What the citizen sees

```
Property Tax → page 1
┌─────────────────────────────────────────────────┐
│  Holding number *                                │
│  [64 / PARK-ST / 12B               ]  🔍 Lookup  │
└─────────────────────────────────────────────────┘
                     │
                     │  on blur (or Lookup click)
                     ▼
┌─── Looking up dues from KMC tax records… ──────┐
│ ⏳ This usually takes 1–2 seconds.              │
└────────────────────────────────────────────────┘
                     │ (success)
                     ▼
┌─── Holding 64 / PARK-ST / 12B  ✅ found ───────┐
│  Owner       Bappa Sengupta                     │
│  Built-up    1 200 sq.ft.                       │
│  Ward        64 — Borough VIII                  │
│                                                 │
│  Annual tax            ₹ 4 200                  │
│  Outstanding (3 mo)    ₹    252                 │
│  ─────────────────────────────                  │
│  Total payable         ₹ 4 452                  │
│                                                 │
│  Source: KMC tax records   ·   Refresh ⟳        │
└────────────────────────────────────────────────┘
```

### 3.5 Failure modes & UX rules (this is where the design earns its keep)

| Failure                                                   | What we show                                                                             | What the platform does                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Holding number not found upstream**                     | "We couldn't find that holding. Check the number, or [submit anyway with manual entry]." | Audit row; counter increments per-tenant (high counts → admin alert)                                                           |
| **Upstream timeout (>5 s)**                               | "KMC tax records are slow today. Want to enter dues manually and pay?" + retry button    | Fall through to `fail_open` policy: if `false` → citizen MUST retry; if `true` → manual entry path opens                       |
| **Upstream returns 5xx**                                  | Same as timeout — never expose the upstream error message                                | Circuit-breaker opens after 3 consecutive failures in 60 s; subsequent calls served from Redis cache (or rejected with banner) |
| **Tenant has no live API (e.g. small ULB on a CSV dump)** | Lookup uses last-night's mirror; UI shows _"as of yesterday 11 PM"_ badge                | `CSVNightlyMirrorAdapter` reads from MinIO `nightly-mirror/SMC/holdings.csv`                                                   |
| **Citizen offline / poor signal**                         | Form still works without lookup; manual entry path                                       | The form is functional regardless of upstream                                                                                  |
| **Tenant has no IT integration at all**                   | Manual entry only; no lookup button shown                                                | `external_lookup.enabled = false` in tenant config                                                                             |

### 3.6 Cross-cutting platform support (built once, reused for every external integration)

These live in `apps/api/src/modules/integrations/` and serve all external-data lookups, not just property tax:

| Capability                                                          | Where                                     |
| ------------------------------------------------------------------- | ----------------------------------------- |
| **Adapter registry** (resolves provider by `tenant + service_code`) | `IntegrationsModule.adapterRegistry`      |
| **Egress allow-list** (only whitelisted hostnames can be called)    | NetworkPolicy + outbound proxy            |
| **Per-tenant secret resolution** (Vault / sealed-secret)            | `SecretResolver`                          |
| **Circuit breaker + retry + jitter**                                | `opossum` library wrapper                 |
| **Redis-backed cache** keyed by `(tenant, service, lookup_key)`     | `LookupCache`                             |
| **Audit row per call** (status, latency, fail_open path taken)      | `audit_log`                               |
| **Per-tenant SLO dashboard** (Grafana)                              | success-rate, p95 latency, cache hit-rate |
| **Mock adapter for tests**                                          | `StubAssesseeAdapter` returns fixtures    |

### 3.7 What about _paying_ through the legacy system?

Lookup is read-only and easy. **Payment** to a legacy system is the same pattern with one extra concern: **idempotency + reconciliation**. The paid amount has to land in _our_ `payments` ledger AND the legacy system's books. Two strategies, picked per tenant:

| Strategy                                         | When                                                      | How                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platform-collects, legacy reconciles nightly** | Most ULBs without a live payment-back-channel             | We collect via our payment gateway (ADR-0006); a nightly job pushes a settlement file to the legacy system; legacy posts it the next morning                             |
| **Legacy-collects, we hand off**                 | ULBs whose legacy system **must** be the system of record | We open a `pending_payment` and redirect the citizen to the legacy gateway; on callback, we mark `paid` in our ledger; reconciliation is the same nightly job for safety |

Both go through the same `IPaymentGateway` interface (ADR-0006, _open_). The lookup adapter and the payment-back adapter are **separate** plug-ins — a tenant can plug one without the other.

### 3.8 What's needed to make this real

This is now a known unknown — let me promote it to a tracked decision so it doesn't drift:

| #   | Action                                                                                       | Owner                    | When               |
| --- | -------------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| 1   | Draft **ADR-0010 — External Data Provider Adapters** (sister to ADR-0008)                    | Platform Lead            | Phase 3 kickoff    |
| 2   | Land `IExternalDataProvider` interface in `@enagar/types`                                    | Backend                  | Phase 3 Sprint 3.1 |
| 3   | Land **`StubAssesseeAdapter`** + **`GenericRestAdapter`** + **`CSVNightlyMirrorAdapter`**    | Backend                  | Phase 3 Sprint 3.2 |
| 4   | Land the **lookup endpoint, cache, circuit-breaker, audit**                                  | Backend                  | Phase 3 Sprint 3.2 |
| 5   | Wire the citizen-PWA `lookup` UX into `@enagar/forms` (declarative trigger from JSON-Schema) | Frontend                 | Phase 3 Sprint 3.3 |
| 6   | Per-tenant adapter onboarding playbook (`docs/runbooks/external-integrations.md`)            | Platform Lead            | Phase 3 close      |
| 7   | KMC SAP-tax adapter as the **first reference integration**                                   | Backend + KMC IT liaison | Phase 3 Sprint 3.4 |

> Want me to (a) draft **ADR-0010** now while it's fresh, (b) extend `docs/service-catalogue.md` §3 with the formal `external_lookup` shape, or (c) hold and revisit in Phase 3 kickoff? The decision affects how we model the `services` table in Phase 2, so doing (a)+(b) **before Phase 2 starts** is cheapest.

---

### Summary in one mental model

|                          | New tenant                                | New service                     | External lookup                                               |
| ------------------------ | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| **Who**                  | State Super-Admin                         | Tenant Admin                    | Tenant IT + Platform Lead                                     |
| **Where**                | `apps/admin-state`                        | `apps/admin-tenant`             | tenant `config.external_data_providers`                       |
| **Cost**                 | 30 min, 0 deploys                         | 1 click → 30 min                | One adapter per legacy system, then 1 config block per tenant |
| **What changes in code** | Nothing                                   | Nothing                         | New adapter file (one-time, per legacy system shape)          |
| **What changes in DB**   | One `tenants` row + Keycloak realm config | One `services` row              | One JSON block in `tenants.config`                            |
| **Failure mode**         | Wizard blocked → 0 partial state          | Form rejects with a clear error | Falls back to manual entry; never blocks the citizen          |

Same plug-and-play philosophy applied at three different layers. The **only** code that ever changes is the **adapter** — and that's a one-time write per legacy-system shape, not per tenant.
