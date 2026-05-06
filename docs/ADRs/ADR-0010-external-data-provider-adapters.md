# ADR-0010 — External-data provider adapters (per-tenant, per-service)

| Field               | Value                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | Proposed (revisit at Phase 3 kickoff)                                                                                                   |
| **Date**            | 2026-05-06                                                                                                                              |
| **Decision-makers** | Project Technical Lead                                                                                                                  |
| **Supersedes**      | _none_                                                                                                                                  |
| **Superseded by**   | _none_                                                                                                                                  |
| **Related**         | ADR-0001 (Postgres), ADR-0002 (NestJS), ADR-0005 (On-prem), ADR-0006 (Payment gateway — open), ADR-0008 (LLM adapter — reference shape) |

## Context

Most ULBs that will adopt eNagarSeba already operate **legacy systems of record** for parts of the catalogue. Examples we have already heard about during the Phase-0 charter discussions:

- **KMC** runs a SAP-based property-tax assessment / billing system. The authoritative _holding → owner / dues / receipts_ mapping lives there, not in eNagarSeba.
- **HMC**'s water-billing system exposes a SOAP/WSDL endpoint over a private VPN.
- **Smaller ULBs** have **no live API at all** — they produce a nightly CSV dump of holdings, dues, and receipts, copied into a shared folder.
- **DigiLocker** is itself a per-citizen, per-document external-data provider — Aadhaar, driving licence, marksheets are fetched on demand, not stored.
- **MSG91** (SMS / OTP), **payment-gateway lookups** (transaction status), **vehicle-RC verification (VAHAN)**, **GST verification (GSTN)**, **ECR / land-records**, **electoral roll**, **MeitY UIDAI offline KYC** — every one of these is a third-party read.

A growing set of services needs to **read** authoritative data at form-fill time:

| Service code(s)                                  | What gets read from where                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `prop-tax`, `mutation`, `self-assess`            | Holding → owner, built-up, ward, current-year tax, outstanding, late fee |
| `water-bill`, `water-tax`, `sewerage-bill`       | Connection no. → meter reading, last paid, dues                          |
| `birth-cert`, `death-cert` (renewal / duplicate) | Old record search by approximate DOB + parents                           |
| `trade-license` (renewal)                        | Existing licence no. → expiry, fee, history                              |
| `building-plan` (revision / completion)          | Plan no. → original plan, NOC bundle, sanctioned area                    |
| `ad-hoarding` (renewal)                          | Permission no. → location, size, current rate                            |
| `digilocker-fetch` (any service)                 | DigiLocker URI → verified document                                       |
| `vehicle-rc` (Mobile Ad service)                 | VAHAN — RC number → owner, model, expiry                                 |
| `pension` (annual-life-cert)                     | Bank IFSC + account → name match                                         |

We therefore need a way to:

1. **Plug a legacy system into the platform without changing platform code** — same plug-and-play philosophy as tenant onboarding (§ROADMAP Phase-0) and service templates (§docs/service-catalogue.md).
2. **Vary the integration per tenant** — KMC's `prop-tax` lookup hits SAP; HMC's hits SOAP; SMC's hits a CSV mirror; AMC has none and falls back to manual entry.
3. **Stay safe** — reads must time out, must not leak PII to upstream that is not explicitly trusted, must be audited, must not block the citizen if the upstream is down.
4. **Stay simple** — the citizen-PWA / mobile / staff app must not know which adapter is in use; they call **one** internal endpoint and render the result.
5. **Stay testable** — a stub adapter must let us run the entire stack offline (it already exists implicitly today: every prop-tax form in the prototype works with manual entry).

ADR-0008 already proved the shape that fits all these requirements — a **per-tenant, per-purpose adapter interface** living in `@enagar/types`, with concrete implementations selected at request time from `tenants.config`. This ADR codifies the same pattern for a different concern: **read-only lookups against legacy and third-party systems**.

> **Why we are deciding before Phase 3 starts.** Phase 2 designs the `services` table and the form-rendering pipeline. If we wait, we'll either (a) add an `external_lookup` block later as a migration with risk, or (b) build property-tax with hard-wired endpoints we'll regret. Drafting this ADR **now** with revisit-at-Phase-3-kickoff lets Phase 2 land the schema fields and the form-side hooks in their first cut.

## Decision

**We adopt a typed, per-tenant, per-service `IExternalDataProvider<TInput, TOutput>` adapter pattern, with a small set of reference implementations and a single internal lookup endpoint that the citizen and operator surfaces consume.**

The decision has three parts.

### 1. The contract

```ts
// packages/types/src/external-data.ts

/**
 * One adapter implementation per *upstream-system shape*, NOT per tenant.
 * KMC and another SAP-using ULB share `KMCSAPAdapter` (config differs).
 * A REST-speaking ULB uses `GenericRestAdapter` with its own URL/auth.
 *
 * Adapters are pure read paths. Side-effecting operations
 * (book a slot, post a payment, write back a result) are NOT modelled here —
 * those go through their own interfaces (IPaymentGateway, IBookingProvider).
 */
export interface IExternalDataProvider<TInput, TOutput> {
  readonly id: string; // 'kmc-sap-tax' | 'generic-rest' | 'soap-1.1' | 'csv-mirror' | 'stub'
  readonly serviceCode: string; // 'prop-tax' | 'water-bill' | 'birth-search' | …
  readonly capabilities: ReadonlyArray<'lookup' | 'list' | 'search'>;

  /** Single authoritative read. MUST be idempotent and side-effect-free. */
  lookup(input: TInput, ctx: TenantContext): Promise<TOutput>;
}

/**
 * Shared shape every TOutput follows so the API/UX is provider-agnostic.
 */
export interface ExternalDataResult<T> {
  found: boolean;
  data?: T;
  source: 'live' | 'mirror' | 'cache' | 'stub';
  fetched_at: string; // ISO-8601
  staleness_seconds?: number; // for mirror/cache hits
  upstream_request_id?: string; // useful for support escalation
}
```

The first concrete pair we ship (Phase 3 Sprint 3.1):

```ts
export interface AssesseeLookupInput {
  holding_no: string;
}

export interface AssesseeLookupOutput extends ExternalDataResult<{
  owner_name: string;
  built_up_sqft: number | null;
  ward_id: string | null;
  current_year_tax_paise: number;
  outstanding_paise: number;
  late_fee_paise: number;
  last_paid_on: string | null;
  legacy_assessee_id: string;
}> {}
```

Future pairs (`MeterLookupInput/Output`, `OldRecordSearchInput/Output`, `LicenceRenewalInput/Output`, `DigiLockerFetchInput/Output`, `VAHANRCInput/Output`) follow the exact same shape.

### 2. The reference implementations (Phase 3 Sprint 3.2)

| Adapter ID         | When to use                                                          | Notes                                                                                      |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `stub`             | Dev, tests, demos, ULBs with no integration at all                   | Returns deterministic fixtures keyed off the input; ships in `@enagar/forms` storybook too |
| `generic-rest`     | Modern legacy systems exposing JSON over HTTPS (KMC SAP, GSTN, etc.) | Config-driven URL / auth (none / basic / oauth2 / bearer-from-vault) / JSONPath mapping    |
| `soap-1.1`         | WSDL-style legacy (HMC water billing)                                | Wraps `strong-soap`; declarative XPath mapping; one helper for envelope + signed headers   |
| `csv-mirror`       | ULBs that drop nightly CSVs to MinIO                                 | Reads from `mirrors/<tenant>/<service>/latest.csv`; daily refresh job; staleness badge     |
| `digilocker-oidc`  | DigiLocker OAuth2 flow                                               | Reuses Keycloak's IdP-broker tokens (ADR-0009)                                             |
| `vahan-rest` (P9+) | Vehicle-RC verification                                              | Behind India-Stack ASA approval — drafted now, gated behind a feature flag                 |

Each adapter is **one file** under `apps/api/src/modules/integrations/adapters/`, registered in `IntegrationsModule`. The registry resolves the adapter at request time using `(tenant_id, service_code)`.

### 3. The configuration model

Tenants opt in **per-service** through their `config.external_data_providers` block:

```ts
// tenants.config (JSONB)
{
  external_data_providers: {
    'prop-tax': {
      enabled: true,
      adapter_id: 'kmc-sap-tax',
      config: {
        base_url: 'https://tax-api.kmcgov.in/v2',
        auth: { kind: 'oauth2_client_credentials',
                secret_ref: 'vault://kmc/tax/client' },
        timeout_ms: 5000,
        cache_ttl_sec: 300,
        fail_open: false,            // hard-fail (citizen retries) vs soft-fail (manual entry)
        field_map: {                 // upstream → AssesseeLookupOutput
          'owner_name': '$.assessee.name',
          'built_up_sqft': '$.property.builtUpSqft',
          // …
        },
      },
    },
    'water-bill': {
      enabled: true,
      adapter_id: 'soap-1.1',
      config: { wsdl_url: '…', timeout_ms: 4000, cache_ttl_sec: 60, fail_open: true },
    },
  }
}
```

Service templates **declare that a lookup point exists** (`external_lookup.enabled`, `trigger_field`, `prefill_fields`); tenants **plug an implementation behind it**. Templates stay vendor-agnostic.

### 4. Cross-cutting platform support (built once, reused for every adapter)

Lives in `apps/api/src/modules/integrations/`:

| Capability                                      | Owner                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Adapter registry** (resolves by tenant+code)  | `IntegrationsModule`                                                                      |
| **Egress allow-list** (only whitelisted hosts)  | NetworkPolicy + outbound proxy (Phase 5 hardens)                                          |
| **Per-tenant secret resolution** (Vault-backed) | `SecretResolver`                                                                          |
| **Circuit breaker + retry + jitter**            | `opossum`-based wrapper                                                                   |
| **Redis cache** keyed `(tenant, service, key)`  | `LookupCache`                                                                             |
| **Audit row per call** (status, latency, path)  | `audit_log` (`actor`, `tenant`, `adapter_id`, `ms`)                                       |
| **PII redaction in logs**                       | Pino redact-list extended for upstream payloads                                           |
| **Per-tenant SLO dashboard**                    | Grafana dashboards templated per tenant (Phase 8)                                         |
| **Mock adapter for tests**                      | `StubAssesseeAdapter` returning seeded fixtures                                           |
| **Form-side trigger**                           | `@enagar/forms` consumes `external_lookup` from JSON-Schema and calls the lookup endpoint |

### 5. The single citizen-facing surface

All citizen / operator clients call **one** endpoint per service:

```
POST /v1/services/{service_code}/lookup
  Authorization: Bearer <jwt>
  X-Tenant-Resolved: <from JWT, never from header>
  body: { holding_no: "64/PARK-ST/12B" }     // schema = service.external_lookup.input

  → 200 { found: true, data: { … }, source: 'live', fetched_at: '…' }
  → 200 { found: false }                     // not an error; UX shows "submit anyway"
  → 429 { error: 'rate_limited' }
  → 503 { error: 'upstream_unavailable', retry_after: 30 }
```

Citizens never learn which adapter ran. Adapters can be swapped with no client change.

## Alternatives considered

| Option                                                                                                                | Pros                                                 | Cons                                                                                                                                                                                                                                                  | Rejected because                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Hard-code per-ULB integrations in the API** (`apps/api/src/modules/kmc-tax/`, `apps/api/src/modules/hmc-water/`, …) | Simplest to build initially; full IDE assistance     | Every new tenant or every service that adds a lookup is a code change → CI run → deploy → review; explodes O(tenants × services); state-template ↔ tenant-config split breaks                                                                         | Violates the plug-and-play pillar; we already rejected this style for LLMs (ADR-0008)                           |
| **Generic ETL into our own database** (nightly mirror of every ULB's data into our Postgres)                          | Fast lookups; no upstream dependency at request time | (a) Stale data — citizens see yesterday's dues even when the legacy is live; (b) explodes our storage with data we don't own; (c) **DPDP risk** — we become the controller of data we have no business storing; (d) write-back becomes a hard problem | Stale dues are a customer-experience disaster for property tax / fines; sovereignty argument runs the wrong way |
| **API gateway / Kong-style transformations** (no code, all config)                                                    | Minimal code; declarative                            | Real legacy systems need branching logic, retries, schema fix-ups, vault auth, partial fallbacks — all of which become ad-hoc Lua / OPA scripts that are themselves code, just less typed                                                             | We end up writing code anyway, in a less testable form                                                          |
| **Federated GraphQL** (each ULB exposes a sub-graph)                                                                  | Elegant in theory                                    | Requires every ULB IT to operate a graph endpoint; most can barely keep their SAP up                                                                                                                                                                  | Doesn't match the maturity of the partner ULBs in v1                                                            |
| **Synchronous calls without an adapter (just `axios.get` per controller)**                                            | Tiny code                                            | No retry, no breaker, no audit, no secret rotation, no cache, no testability                                                                                                                                                                          | Loses every cross-cutting we need                                                                               |
| **Push-only model** (legacy posts changes to us via webhooks)                                                         | Real-time; we own the consistency model              | Requires every ULB to implement outbound webhooks — most can't; needs HMAC signing, replay protection, idempotency keys                                                                                                                               | Useful as a future complement to pull, not a replacement; revisit when one ULB is ready                         |

## Consequences

### Positive

- **Plug a new legacy system once, plug into many tenants.** A second SAP-using ULB needs only a new tenant-config block.
- **Citizen-facing form code never changes.** Lookup behaviour is declared in the service template (`external_lookup.trigger_field`, `prefill_fields`); the renderer is generic.
- **Failures degrade gracefully.** Citizen-PWA always has the manual-entry path; the lookup is a _progressive enhancement_, not a hard dependency.
- **Testability.** A stub adapter is the default in dev / CI / preview environments; Phase-1 security tests are unaffected by the absence of upstream systems.
- **Auditable.** Every external call is one row in `audit_log` (`adapter_id`, `tenant_id`, `service_code`, `latency_ms`, `outcome`, `cache_hit`).
- **Compositional with payment-gateway adapter (ADR-0006).** Lookup is a separate adapter from collect-payment; ULBs can plug one without the other.

### Negative / costs

- **One more abstraction to learn.** Solo dev needs to internalise `IExternalDataProvider` + `IntegrationsModule` + `LookupCache` before Phase 3. Mitigation: the LLM adapter (ADR-0008) is the working example — same pattern.
- **Per-tenant config sprawl.** `tenants.config.external_data_providers` will accumulate dozens of entries over time. Mitigation: schema-validated JSON; admin-portal editor with built-in form (Phase 6); weekly drift report.
- **Upstream operational pain stays upstream's problem.** When KMC's SAP is down, our SLO is unaffected (we degrade), but the citizen sees an error and the support team must triage who is responsible. Mitigation: every error response includes `upstream_request_id` and a tenant-specific support-link.
- **Schema drift risk.** Field-mapping in JSON is a contract that can rot silently. Mitigation: per-adapter contract test (Pact-style) run nightly against a known fixture or a sandbox upstream.

### Neutral / follow-ups required

- **Phase 2 Sprint 2.1**: extend `ServiceTemplate` shape with `external_lookup` block (already documented in `docs/service-catalogue.md` §3 — to be made formal). Ensure the seed catalogue marks `external_lookup.enabled = false` for everything except a single exemplar (`prop-tax`).
- **Phase 2 Sprint 2.4**: `@enagar/forms` honours `external_lookup` in JSON-Schema (`x-enagar/external-lookup`) and renders the trigger UX (loading, success, fail-open) per `docs/design-system.md` §5.4.
- **Phase 3 Sprint 3.1**: Land `IExternalDataProvider`, `ExternalDataResult`, and `AssesseeLookup{Input,Output}` in `packages/types`. Write contract tests.
- **Phase 3 Sprint 3.2**: Land reference adapters: `stub`, `generic-rest`, `csv-mirror`. Land cross-cutting modules: `IntegrationsModule`, `LookupCache`, `AdapterRegistry`, `SecretResolver`.
- **Phase 3 Sprint 3.3**: Wire `POST /v1/services/{service_code}/lookup`. Add Phase-1 security-test extensions (TI-9..TI-12 for tenant isolation across adapter calls).
- **Phase 3 Sprint 3.4**: KMC SAP-tax adapter as the **first reference integration**. Write the per-tenant onboarding playbook (`docs/runbooks/external-integrations.md`).
- **Phase 5**: Egress allow-list moves from list-in-config to a NetworkPolicy + outbound proxy.
- **Phase 6**: Admin portal exposes a config UI for `external_data_providers`, including a "Test connection" button.
- **Phase 9**: External vendors (`vahan-rest`, `gstn-rest`, additional DigiLocker doc-types) added behind feature flags.

## Compliance / verification

- **CI gate**: every adapter exports an OpenAPI fragment + JSON-Schema for input / output; CI fails on missing or invalid contract.
- **Contract tests** (`tests/integrations/contracts/`): nightly run against per-adapter fixtures; failure pages on-call.
- **Tenant-isolation tests** (extension of `tests/security/tenant-isolation.spec.ts`): a Tenant-A JWT cannot trigger a Tenant-B adapter call.
- **PII redaction tests**: log scraping in `tests/security/pii-redaction.spec.ts` validates that no upstream PII appears in unredacted form in stdout, audit, or trace export.
- **Code-review checklist** (extension of `AGENT.md` §6): every new adapter ships with (a) OpenAPI fragment, (b) JSON-Schema input/output, (c) `field_map` documented, (d) timeout + cache TTL + fail-open default justified, (e) at least one happy-path + one timeout + one not-found contract test.
- **Audit query**: `SELECT … FROM audit_log WHERE entity_type='external_lookup'` is the canonical view for support escalation.

## References

- `ARCHITECTURE.md` §3 — Open-source stack rationale.
- `ARCHITECTURE.md` §5 — API endpoints (the lookup endpoint joins the catalogue here).
- `docs/ADRs/ADR-0008-llm-provider-adapter.md` — Reference shape for per-tenant adapter pattern.
- `docs/ADRs/ADR-0009-identity-keycloak.md` — Identity context propagation; DigiLocker IdP-broker is the first lookup-class adapter we already have.
- `docs/service-catalogue.md` §3 — `external_lookup` block on `ServiceTemplate`.
- `docs/security/threat-model.md` §4.2 (A-T2 SSRF) and §5 (cross-cutting): adapter calls live behind the egress allow-list.
- `docs/glossary.md` §9 — _External Data Provider_, _Adapter_, _Egress allow-list_ (to be added in the same PR as Phase-3 Sprint 3.1).
- `Phase2Revisit.md` (this repository) — original walk-through for the property-tax integration that drove this ADR.
