# Citizen Unified Hub operations (portal Option A)

**Audience:** Frontend/API engineers, QA, DevOps touching the **citizen PWA hub**.  
**Related:** [`ROADMAP.md`](../ROADMAP.md) (Hub **H4.x** → **H6.1**), [ADR-0009](../ADRs/ADR-0009-identity-keycloak.md) / [`docs/runbooks/keycloak.md`](./keycloak.md), [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md).

## 1. What the hub is

- Citizens authenticate with the **portal** JWT (**`WBPORTAL`**, Option A claim shape per Keycloak/runbook).
- **Hub mode** aggregates data **across** pinned municipalities: list reads usually **omit** **`X-Enagar-Tenant-Code`**.
- **Workspace mode** (after picking one ULB) scopes mutations and many lists with **`X-Enagar-Tenant-Code: {ULB code}`**.

## 2. Header contract (`X-Enagar-Tenant-Code`)

| Surface       | Header on aggregate **GET** (`/applications`, `/payments`, `/grievances`, `/citizen/dashboard`) | Header on **writes** (draft create, payment initiate, grievance POST, …)                                   |
| ------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Hub**       | **Omit** for cross-ULB aggregate (portal JWT).                                                  | **Required** when the API needs a target ULB (e.g. new application draft, new grievance from hub pickers). |
| **Workspace** | Send **active ULB** (matches tile you opened).                                                  | Same — must match the municipality you are acting under.                                                   |

**Symptom:** `400 Bad Request` mentioning scope / municipality / tenant — you likely **forgot the header** on a portal write. Open DevTools → compare a working workspace call with the failing hub call.

### Common API messages with **portal JWT** (**WBPORTAL**)

Verbatim snippets from **`resolveCitizenMunicipalityForWrite`** / **`assertActiveMunicipalityTenantCode`** ([`citizen-scope.ts`](../../apps/api/src/common/auth/citizen-scope.ts)):

| Browser / client symptom                              | Typical HTTP body (message)                                                                              | Fix                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Hub **File grievance** / draft create returns **400** | `Active municipality is required. Send X-Enagar-Tenant-Code when filing with a portal (WBPORTAL) login.` | Add **`X-Enagar-Tenant-Code: {ULB}`** (must be an operational municipality from `GET /tenants`). |
| Picker sends **`WBPORTAL`** as ULB code               | `Filings must target a municipality`                                                                     | Choose a municipal code (KMC, BMC, …); never the portal pseudo-tenant code.                      |
| Typo / inactive ULB code in header                    | `Tenant not found`                                                                                       | Match code spelling and active catalogue (`GET /tenants`).                                       |

**Reference headers constant:** `CITIZEN_MUNICIPALITY_SCOPE_HEADER` / `X-Enagar-Tenant-Code` in [`apps/api/src/common/auth/citizen-scope.ts`](../../apps/api/src/common/auth/citizen-scope.ts) and PWA [`authHeaders`](../../apps/citizen-pwa/lib/workspace-http.ts).

## 3. `GET /citizen/dashboard` performance (no N+1 per ULB)

Implementation: [`CitizenHubDashboardService`](../../apps/api/src/modules/citizen/citizen-hub-dashboard.service.ts).

- **Three parallel list calls:** `ApplicationsService.list`, `PaymentsService.list`, `GrievancesService.list` (same read scope as the tab APIs).
- **Single pass bucketing:** counts per `tenant_id` use **`Map`** aggregation — **O(U + R)** for catalogue size **U** and total rows **R**, not **O(U × R)** nested filters.
- Each underlying `list` is still bounded by store/Prisma behaviour; if dashboard latency grows, profile those three queries — not the per-ULB loop.

**Structured log** (every successful dashboard build): search for **`citizen_hub_dashboard`** in API logs — fields include `jwt_tenant_code`, `municipality_scope`, row counts per domain, **`distinct_active_service_codes`** (numeric count — same semantics as JSON field on `GET /citizen/dashboard`), `duration_ms`, `ulb_catalogue_rows`.

## 4. Grievances hub vs workspace (recap)

- **Hub list `GET /grievances`:** omit scope header (aggregate).
- **Hub detail / comment / feedback / reopen:** send **`X-Enagar-Tenant-Code`** for the **row’s** ULB (PWA resolves from `tenant_id` + `GET /tenants`).
- **Workspace:** always send scope for the opened municipality.

Manual checks: [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md) § **Manual smoke — Sprint 4.2**.

## 5. Keycloak / identity

Portal + operator behaviour: **[`docs/runbooks/keycloak.md`](./keycloak.md)**.  
JWT **`tenant_id` / `tenant_code`** vs camelCase synonyms: [`apps/api` README](../../apps/api/README.md) + ADR-0009.

## 6. Backlog pointers (triaged under H6.1)

Record deferred hub polish as **tracked issues** (label e.g. `hub`, `citizen-pwa`), not tacit debt:

| Theme            | Examples                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| E2E / Playwright | Authenticated hub smoke in CI                                                 |
| Perf             | `k6` or scripted “100× `GET /citizen/dashboard`” if sponsor requests evidence |
| Product          | Shortcut editor UX edge cases not covered by manual smoke §4.16               |

Formal **exit** for Hub programme slice: **`docs/runbooks/hub-h6-exit-checklist.md`**.
