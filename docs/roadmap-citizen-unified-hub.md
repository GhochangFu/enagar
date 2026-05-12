# Roadmap — Unified Citizen Hub & Multi-ULB Access

**Status:** Planned (implementation to follow phased plan below).  
**Audience:** Engineering, architecture, PM, Keycloak/DevOps stakeholders.  
**Related:** Citizen PWA (`apps/citizen-pwa`), API (`apps/api`), identity (`ADR-0009`-aligned Keycloak posture).  
**Keycloak:** **Option A (chosen)** — tokens carry **portal tenant** claims and a **single stable `sub`** per citizen; ULB scope is header/body—not different logins per ULB.

**Pace convention:** Unless noted, assume **two-week sprints**. Shrink or combine sprints if staffing is lighter.

---

## 1. Product and UX commitments

These decisions should be locked before coding.

1. **Two surfaces**
   - **Hub (common dashboard):** Aggregated read view across municipalities the citizen has interacted with—applications, payments, grievances—each row tagged with municipality identity (code, name, **`theme_color` / badge**).
   - **Municipality workspace:** Current behaviour preserved: catalogue, apply flow, and lists scoped to **one chosen ULB** at a time.

2. **Citizen identity**
   - Exactly **one stable principal identity** per person (Keycloak **`sub`**; in dev, a deterministic subject e.g. per mobile)—**not** different subjects per OTP `tenant_code`.
   - JWT may retain a **portal / default tenant** for claims or infrastructure; **citizen-visible data** must **not** be driven only by that claim when listing cross-ULB activity.

3. **Production identity (Keycloak) — Option A (locked)**

   Sponsor selected **Option A.** Target token shape:
   - **`sub`:** Stable per citizen (survives across ULBs; same person = same `sub` after OTP).
   - **`tenant_id` / `tenant_code` (or realm claim names your API verifier already maps):** Always the **portal** ULB (`WBPORTAL` or equivalent), not the municipality **except** where internal staff realms differ—citizen OIDC clients use portal tenant only for these claims.
   - **Roles:** Citizen role preserved; municipality is **never** inferred from JWT alone for data listing.

   Implementation detail for Phase 5: Keycloak realm, **citizen-public** client, OTP/`direct grant` or `password`/broker flow consistent with WB policy—plus **protocol mappers** issuing `tenant_id` / `tenant_code` portal values. Separate document: mapper JSON + env vars for staging.

   Option B (`username = {tenant}:{mobile}` plus API mapping) is **out of scope** for this program unless Sponsor reopens it.

---

## 2. Data model principles

No implementation detail here beyond what informs migrations.

4. **Logical vs physical citizen**
   - **Logical:** One citizen may apply across many ULBs.
   - **Physical (current Prisma):** `Citizen` remains **`@@unique([tenantId, keycloakSubject])`** with FK from `Application` / `Grievance`; a **major “single global Citizen row”** refactor is explicitly **out of initial scope**.

5. **Lazy ULB citizenship**
   - On first filing (application or grievance, or first defined touchpoint) under ULB **X**, **ensure** a `Citizen` row for `(tenantId = X, keycloakSubject)`—seed `mobile` / `name` from portal registration or existing profile.

6. **Optional preference persistence**
   - Remember **last selected municipality** for UX (e.g. reopen workspace): `selected_tenant_code` on a designated profile row, or a small **`citizen_preferences (keycloak_subject → last_tenant_code)`** table.

7. **Portal tenant in catalogue**
   - Register a **portal ULB** (e.g. `WBPORTAL`) in **`tenant.seed.ts` + Prisma `tenants`** + seed pipeline for consistent dev JWT and profile home. **Business transactions** (applications, grievances, ULB-scoped payments) remain under **municipal** `tenant_id`s, not the portal id (unless product later demands otherwise).

---

## 3. API scoping contract

8. **Request header (citizen clients)**
   - **`X-Enagar-Tenant-Code: {ULB}`** when the app is in **municipality workspace**.
   - **Omit** the header for **hub** calls that must aggregate across ULBs.

9. **Writes**
   - **Create application / file grievance / initiate payment** must resolve exactly **one target ULB** from header and/or explicit `tenant_code` in DTO; **reject** if missing or ambiguous when JWT represents the portal.

10. **Staff**

- **Ignore** hub header for authorization; **tenant** remains **JWT-bound** for staff routes. Citizens use subject + optional header rules above.

---

## 4. Backend implementation sequence

Implement in this order to avoid partial broken states.

11. **Shared helpers** (e.g. under `apps/api/src/common/auth/` or domain util)
    - Detect portal tenant from `tenant_code`.
    - Detect citizen-only principal vs staff.
    - Parse and validate `X-Enagar-Tenant-Code`.
    - Resolve target ULB for **writes** (throw on invalid / inactive tenant).

12. **Auth service (dev path first)**
    - Default OTP `tenant_code` to **portal**.
    - Issue dev JWT with portal `tenant_id` / `tenant_code` and **stable `sub`** (e.g. `dev-citizen-{mobile}`).
    - Align `refresh` behaviour with stable identity (today’s dev refresh hard-codes credentials—revisit).

13. **Citizen persistence**
    - **Postgres store:** Resolve profile by **subject** (prefer portal tenant row; fallback to most recently updated municipal row).
    - **select-tenant:** Persist preference per §6 if schema exists.
    - Keep DTOs and API responses consistent with stored preference.

14. **Applications service**
    - **List:** Citizen + no header → all items with `citizen_subject === sub`; citizen + header → filter by resolved `tenant_id`.
    - **Access checks** (`canAccess`, `getOwnedApplication`, `getByDocketNo`): same dual mode.
    - **createDraft / create:** Set `tenant_id` and `tenant_code` from **resolved ULB**, not portal JWT.
    - **submitDraft:** Resolve service/workflow using **application’s stored** `tenant_code`, not `principal.tenantCode`.

15. **Grievances service**
    - **List (citizen):** `where citizen.keycloakSubject = sub` plus optional `tenantId` when header present.
    - **Create:** Resolve ULB → `ensureCitizen(ulb)` → insert under that `tenantId`; allocate numbers per ULB.
    - **Detail / timeline / comments / feedback:** Use the **grievance row’s `tenantId`** for DB writes and scoped reads where `principal.tenantId` is portal.
    - **Staff:** Unchanged JWT tenant scoping.

16. **Payments service and stores**
    - **List / get (citizen):** All rows for `citizen_subject`, optionally filtered by ULB when header set.
    - **initiate:** Use **application’s `tenant_id`** for gateway context, **payment row**, and **idempotency** lookup (portal JWT must not break idempotency uniqueness keyed by tenant).
    - **Stub complete / ownership:** Authorize by **subject** and payment/application relationship; relax strict `payment.tenantId === principal.tenantId` when principal is portal citizen.

17. **Holdings and documents**
    - Apply the same **ULB resolution** as applications (header + tenant catalogue). Audit `documents.service` path prefixes if they assumed single-tenant JWT.

18. **Optional hub bundle endpoint**
    - `GET /citizen/dashboard` assembling applications, payments, grievances without multiple round-trips; enrich with `tenant_code` and `theme_color` (catalogue or Prisma `Tenant` join).

---

## 5. Frontend (Citizen PWA)

19. **OTP**
    - send-otp / verify-otp bodies use **portal** `tenant_code`, not a hardcoded municipal code.

20. **Navigation model**
    - Post-login landing = **Hub** (load dashboard §18 or parallel unscoped GETs).
    - Municipality card → set selected ULB, apply theme, `POST /citizen/select-tenant`, enter **workspace** (existing tabs).
    - **Back to hub** clears ULB scope and reloads aggregates.

21. **HTTP wrapper**
    - Central helper: bearer token plus **`X-Enagar-Tenant-Code`** only when a ULB workspace is active.

22. **Grievances UI**
    - Pass **scope** (`tenant_code` or null) into grievance client so list/create/detail align with backend rules.

---

## 6. Verification, rollout, documentation

23. **Automated tests (minimum)**
    - Portal JWT: create application/grievance in ULB **A** and **B**; list without header returns both; with header **A** returns subset.
    - Payment initiate idempotency works when JWT tenant ≠ application tenant.
    - Staff grievance/application list unchanged (JWT tenant only).

24. **Migrations and seed**
    - Portal tenant row; preference column or table §6; `pnpm db:migrate` + `pnpm db:seed`.

25. **Documentation**
    - `README` or ADR appendix: hub vs workspace, header contract, citizen vs staff semantics, Keycloak Option A checklist (realm, client, mappers).

---

## 7. Suggested execution checklist (reference)

Detailed breakdown is in **§9 Phased delivery plan**. Rough order remains: catalogue + auth parity → hub reads → municipality writes → PWA → Keycloak staging → hardening.

---

## 8. Explicit non-goals (initial slice)

- Merging every municipal `Citizen` row into a single global row without a phased migration strategy.
- Cross-tenant **staff** “super dashboard” without separate RBAC design.
- Changing translation keys unless copy is reviewed with i18n owners.

---

## 9. Phased delivery plan (sprints, tests, deliverables, exit criteria)

Phases are **merge-sequential**: finish exit criteria of Phase _N_ before relying on Phase _N+1_ in production. Within a phase, sprints can overlap only where called out (e.g. docs in parallel).

---

### Phase 1 — Platform identity & data foundation

**Program goal:** Introduce portal ULB in data + code, align **dev** JWT with Option A shape, and add shared scoping utilities so later phases do not fork ad hoc logic.

#### Sprint 1.1 — Catalogue, schema, seed

| Item              | Detail                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Add `WBPORTAL` (or final portal code) to `tenant.seed.ts`; Prisma migration if adding `citizens.selected_tenant_code` (or `citizen_preferences` table per §2.6); `pnpm db:seed` idempotent for portal row; skip or no-op ULB-only artefacts for portal if product wants zero grievance routing noise (document choice). |
| **Tests**         | Migration applies on clean DB; seed upsert test or script smoke; existing API test suite still green.                                                                                                                                                                                                                   |
| **Exit criteria** | CI passes; fresh `migrate + seed` creates portal tenant; no regression on existing tenant rows.                                                                                                                                                                                                                         |

**Status: done (2026-05-11).** Portal `WBPORTAL` in `apps/api/src/modules/tenants/tenant.seed.ts` (`CITIZEN_PORTAL_TENANT_CODE`); migration `apps/api/prisma/migrations/20260514100000_citizen_selected_tenant_code/`; seed skips grievance SLA/routing for portal; `TenantsService.list()` excludes WBPORTAL; `apps/api/README.md` documents behaviour.

#### Sprint 1.2 — Dev auth, helpers, citizen profile resolution

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Dev OTP/verify: default `tenant_code` → portal; JWT `sub` stable per mobile (e.g. `dev-citizen-{mobile}`); claims `tenant_id` / `tenant_code` = portal; fix dev **refresh** to stop hard-coding unrelated mobile/tenant (or document limitation). Add **`citizen-portal` helpers**: `isPortalPrincipal`, `parseTenantScopeHeader`, `resolveTargetUlbForWrite`, `isCitizenOnly`. Postgres `CitizenStore`: `findByPrincipal` prefers portal row by `keycloakSubject`, else fallback row; `save` / `select-tenant` persist `selected_tenant_code` if column exists. |
| **Tests**         | Unit tests for helpers; citizen store spec: same `sub`, two tenant rows—correct read preference; auth integration: two verifies same mobile → same `sub` in decoded dev JWT.                                                                                                                                                                                                                                                                                                                                                                                     |
| **Exit criteria** | Dev login flow issues Option-A-shaped token; profile API returns consistent fields for portal user; staff principals unchanged by helpers.                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Status: done (2026-05-11).** `AuthService`: dev verify/refresh issue **WBPORTAL** claims and `sub` = `dev-citizen-{mobile}`; optional `tenant_code` on OTP DTO; dev refresh token embeds mobile (`dev-refresh-{mobile}-{uuid}`); **`refresh` is async** so legacy `dev-refresh-{uuid-only}` and other parse failures reject as `UnauthorizedException` (stable for controllers/filters). Helpers in `src/common/auth/citizen-scope.ts` (`parseTenantScopeHeader`, `principalIsCitizenPortal`, `isCitizenSelfServicePrincipal`, `assertActiveMunicipalityTenantCode`). `PostgresCitizenStore` prefers portal composite row, then latest by subject; persists `selectedTenantCode`. `InMemoryCitizenStore` keyed by subject. PWA OTP body omits `tenant_code` (API default). Tests: `auth.service.spec`, `citizen-scope.spec`, updated `postgres-citizen.store.spec`.

---

### Phase 2 — Hub read APIs (aggregated citizen view)

**Program goal:** Citizens can list and open **their** data across ULBs when **no** `X-Enagar-Tenant-Code` is sent; with header, lists match **one** ULB. Staff behaviour unchanged.

#### Sprint 2.1 — Applications + holdings/documents read scope

| Item              | Detail                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `ApplicationsController` passes optional header into service; `list`, `getByDocketNo`, `getOwnedApplication`, `canAccess` implement hub vs workspace rules (§4.14). **Holdings** + **documents** routes resolve ULB from header for citizen; staff ignore header. |
| **Tests**         | `applications.service.spec` (or integration): portal principal, apps in KMC + HMC—list all without header; list one with header; staff list still JWT-tenant only. Holdings/documents spot tests if present.                                                      |
| **Exit criteria** | No 404 for legit cross-ULB docket when unscoped; scoped requests hide other ULB apps.                                                                                                                                                                             |

**Status: done (2026-05-11).** `ApplicationReadScope` + `X-Enagar-Tenant-Code` on `applications` and `documents` controllers; `ApplicationsService` applies hub (portal + self-service citizen vs subject match across tenants; optional `municipalityTenantCode` filters one ULB); municipal JWT unchanged (tenant_id + subject). `HoldingsService` injects `TenantsService`; portal citizens must send scope header; `DocumentsService` gates portal document reads via linked application access. Tests: `applications.service.spec` (portal hub), `holdings.service.spec`, `phase2-api.integration.spec` still green.

#### Sprint 2.2 — Payments + grievances read scope + optional dashboard

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Payments `list` / `getById` / receipt read: citizen filtered by `citizen_subject`, optional tenant filter via header; ownership checks allow portal JWT when subject matches. Grievances **citizen list/detail**: query by `keycloakSubject` (+ optional `tenantId`); timeline reads use row’s `tenantId`. Optional **`GET /citizen/dashboard`** returning grouped payloads with `tenant_code` + `theme_color`. |
| **Tests**         | Payment store/service tests: two tenants, same subject—unscoped list length; scoped filters; portal JWT + payment in ULB A—`get` succeeds. Grievances db/spec: list across tenants; detail by `grievance_no` with subject match. Dashboard contract test (smoke) if implemented.                                                                                                                                |
| **Exit criteria** | Hub can be populated from API without client-side merging hacks; staff grievance list still tenant-scoped.                                                                                                                                                                                                                                                                                                      |

**Status: done (2026-05-11).** **Payments:** `list` / `getById` / `…/receipt` honor `X-Enagar-Tenant-Code`; hub access via `citizenHubRowAccessibleByTenant` in payment stores. **Grievances:** portal citizens list/detail by `keycloakSubject` with optional scope; staff list still `tenantId`-only; timeline uses grievance `tenantId`. **`GET /api/citizen/dashboard`** — per-ULB counts + `theme_color`. **CORS:** `x-enagar-tenant-code`. Tests: `citizen-scope.spec`, `payments.service.spec` (portal hub).

---

### Phase 3 — Municipality write APIs (ULB-scoped creates & payment integrity)

**Program goal:** Every create/settlement path binds to an explicit ULB; idempotency and FK rules work when JWT tenant is portal.

#### Sprint 3.1 — Applications write path + ULB citizen ensure

| Item              | Detail                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `createDraft` / `create` / `submitDraft`: resolve target ULB from header and/or DTO `tenant_code`; set `tenant_id` / `tenant_code` on application; `submitDraft` uses **application’s** `tenant_code` for workflow; **ensureCitizen(ulb)** for Prisma path when needed. Documents/holdings writes aligned with resolved ULB. |
| **Tests**         | Integration: portal JWT + header KMC → draft has KMC `tenant_id`; submit uses KMC workflow; without ULB resolution → 400.                                                                                                                                                                                                    |
| **Exit criteria** | No application row left on portal `tenant_id` by mistake; citizen row exists for target ULB when required by schema.                                                                                                                                                                                                         |

**Status: done (2026-05-11).** `createDraft` / `create` / `submitDraft` resolve the target ULB through `resolveCitizenMunicipalityForWrite` and `X-Enagar-Tenant-Code` when the JWT is WBPORTAL; drafts and submissions persist **municipal** `tenant_id` / `tenant_code`; `submitDraft` loads workflow via **`application.tenant_code`**. **`PostgresApplicationStore`:** **`ensureMunicipalCitizenRow`** (same helper as grievances) creates missing `(tenantId, keycloakSubject)` citizen rows before application upsert once a WBPORTAL profile holds a registered mobile number. **`DocumentsService`:** document metadata and storage path prefix use the **owned application’s** municipal ULB instead of JWT `tenant_*`. **Holdings** remain read-only; portal scope follows Phase 2. **Tests:** `applications.service.spec` (portal draft 400 vs KMC tenant); `documents.service.spec`; Phase 2 HTTP integration drafts; **`payment-portal.http.integration.spec`** (portal document uploads).

#### Sprint 3.2 — Payments initiate + stub complete + grievances writes

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deliverables**  | **initiate:** idempotency key scoped to **application’s `tenant_id`**, not portal; gateway `tenantId` = application’s. **Stub complete / settlement:** ownership = subject + payment row, not `principal.tenantId === payment.tenantId` for portal citizens. **Grievances create:** resolve ULB, `ensureCitizen`, insert under municipal `tenantId`; **comments/feedback/timeline** writes use **grievance row’s `tenantId`**. |
| **Tests**         | Idempotency: same key, same app, portal JWT—returns same payment; different key collision behaviour unchanged. Stub complete with portal JWT. Grievance create in two ULBs; numbers distinct; citizen cannot append timeline to another subject’s row.                                                                                                                                                                         |
| **Exit criteria** | Finance/grievance reviewers sign off on demo script (initiate → stub settle → receipt read) with portal token.                                                                                                                                                                                                                                                                                                                 |

**Status: done (2026-05-11) — payments slice.** **`PaymentsService`:** `initiate` resolves `getTenantService` / idempotency / `createPendingPayment` / gateway `tenantId` from the **owned application’s** `tenant_code` / `tenant_id`; `completeStubPayment` resolves the fee config from the application’s ULB; in-memory receipt slugs use the payment row’s tenant. **`findIdempotencyRecord`** accepts optional `idempotencyTenantId`. **Postgres + in-memory** stores implement the composite key against that tenant. Tests: `payments.service.spec` (portal draft KMC → initiate → stub → receipt contains KMC; idempotent replay), `postgres-payment.store.spec` (override tenant in idempotency query). Grievances writes already used `resolveCitizenMunicipalityForWrite` + `ensureCitizenForTargetTenant` + row `tenantId` for timeline (Phase 4 alignment).

**Phase 3 status — closed (2026-05-11).** All Phase 3 sprint exit criteria satisfied: municipal-bound writes plus portal-safe payment initiation/settlement paths are implemented and verified in automation above.

---

### Phase 4 — Citizen PWA (hub UX + workspace parity)

**Program goal:** After OTP, user lands on **hub** once preferences include ≥1 pinned ULB (`Sprint 4.16`); entering a municipality attaches header on API calls; “back to hub” clears scope. Sprint **4.16** scales the hub UI: **mandatory onboarding pins + favourites**, **browse/search** for all operational ULBs, and **lazy** service catalogue fetches, while KPIs remain **whole-portfolio** aggregates on **`/citizen/dashboard`** (including **`distinct_active_service_codes`** for Services).

#### Sprint 4.1 — Navigation + HTTP layer + hub data

| Item              | Detail                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | OTP uses portal `tenant_code`; new **hub** step with dashboard (endpoint or parallel fetches); municipality card → theme + `select-tenant` + workspace; **request helper** adds `X-Enagar-Tenant-Code` only in workspace; apply flow continues to send scope. |
| **Tests**         | PWA: minimal e2e or manual test script documented; lint/typecheck/build green.                                                                                                                                                                                |
| **Exit criteria** | Sponsor can demo: login → see multi-ULB rows with colour badges → open KMC → see only KMC → back to hub → see all again.                                                                                                                                      |

**Status: done (2026-05-11).** **`@enagar/citizen-pwa`:** OTP **send/verify** payloads include explicit **`tenant_code: WBPORTAL`** (`CITIZEN_PORTAL_OPTION_A_TENANT_CODE`). **`hub`** step loads **`GET /citizen/dashboard`** without `X-Enagar-Tenant-Code`, merges **`GET /tenants`**, renders per-ULB cards (theme stripe + Apps / Pay / Grv badges sorted by activity). Picking a municipality runs **`POST /citizen/select-tenant`**, **`applyTenantTheme`**, then **workspace**; all scoped fetches pass ULB into **`authHeaders(…, tenantScopeCode)`**. **Back to hub** clears workspace selection and resets default theme tokens. **Receipt** prefetch on **My Payments** passes `tenantScopeCode`. **Manual smoke:** `apps/citizen-pwa/README.md` § Sprint 4.1. **CI-style check:** `pnpm --filter @enagar/citizen-pwa run typecheck` (production `next build` in release pipelines).

#### Sprint 4.15 — Citizen hub KPI strip & tab dashboard (prep for 4.2)

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Hub landing gains **five KPI-style cards**: Language mirrors **session onboarding locale** (same **`language`** passed to **`t(...)`**) and is **PATCHed** to **`/citizen/language`** immediately after OTP so server profile aligns; distinct **services** union (active `services/tenants/{code}` merged); applications / payments / grievances summed from **`/citizen/dashboard`** buckets (wards aggregate removed per product); **pill tab rail** mirrors workspace navigation; aggregate reads as before; dossier **`tenant_code`** + stub-complete scope behaviour unchanged. |
| **Tests**         | Manual smoke in `apps/citizen-pwa/README.md` § 4.15; `pnpm --filter @enagar/citizen-pwa run typecheck` / `pnpm --filter @enagar/citizen-pwa run build`.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Exit criteria** | Hub aggregate **`GET`s never send** `X-Enagar-Tenant-Code` until a row-level action requires it; workspace behaviour unchanged aside from dossier-scope helper used for receipts / stub-complete / dossier edits. Sponsor can steer from KPIs straight into aggregated lists across ULBs without entering a municipality first (apply still redirects through workspace picker).                                                                                                                                                                                                      |

**Status: done (2026-05-12, language KPI + persistence fix 2026-05-12).** **PWA (`page.tsx`):** `CitizenWorkspaceTabStrip` shared between hub (`hubTab`) and workspace tabs; **`refreshHubData`** parallelises `/citizen/dashboard`, `/tenants`, `/applications`, `/payments`, and catalogue **`/services/tenants/{code}`**; **`verifyOtp`** issues **`PATCH /citizen/language`** with onboarding **`language`**; hub Language KPI **`language.toUpperCase()`**; dossier helpers unchanged. **Types:** **`ApplicationSummary` `tenant_*`**. **Docs:** README smoke § Sprint 4.15.

#### Sprint 4.16 — Hub at scale: mandatory onboarding pins + favourites (≤15 ULBs)

**Locked product decisions — confirmed 2026-05-12**

1. **Onboarding:** **≥1 municipality required** — user cannot skip first-time onboarding with zero pinned ULBs.

2. **Pinned ULBs:** **≤15**, ordered server-side favourites.

3. **`selected_tenant_code`:** **Separate** — stays “last/workspace convenience” via existing `POST /citizen/select-tenant`; pins are independent shortcuts (**no automatic sync** into pins).

4. **Pinned services:** Launch **workspace**, **Services tab**, catalogue **filtered** to favourite `service_code`s for that ULB (Apply is not pre-loaded with a draft).

5. **Hub KPIs:** **Across all ULBs** (today’s aggregates); **no** pinned-scope KPI toggle in Sprint 4.16.

6. **Municipality search:** Match **`tenant.code`**, **`tenant.name`**, **`district`** from **`GET /tenants`**. **Multilingual / alternate-script ULB search is not required** for Sprint 4.16 (explicitly out of scope).

7. **Pins ≠ access control:** Pins are **quick-entry shortcuts** on the hub. **Browse / search always reaches any operational municipality and any catalogue service**, pinned or not.

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | **Persistence** (migration + CitizenService): **`pinned_tenant_codes[]` (≤15, unique)**; **`pinned_services[]`** `{ tenant_code, service_code }` uniqueness; WBPORTAL ineligible — align with **`GET /tenants`** omit logic. **`GET` + `PATCH` citizen preferences**. **Validation** against active catalogue. **PWA:** mandatory post-OTP onboarding (≥1 ULB pin + optional pins on hub/search); **`Profile`/Shortcuts** to edit pins to cap 15; hub **pinned row** instead of dumping full catalogue by default **+ Browse all / search virtualised drawer**; **lazy** **`/services/tenants/:code`** for pinned/active ULB only — no hub-wide prefetch ×100; **pinned service shortcut** → open workspace Services with filter; KPI/dashboard fetch unchanged (**all-ULB** scope). Documentation: distinction pins vs **`selected_tenant_code`**. |
| **Tests**         | Unit/API: enforce cap **15**, reject duplicates, WBPORTAL, stale codes. **Manual smoke README** § 4.16; **typecheck** + **build** on PWA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Exit criteria** | First-time citizen **cannot bypass** onboarding without ≥1 pin (UI + PATCH guard). Returning user navigates scales to **many ULBs via search** while pin strip stays capped; KPI remains **whole-portfolio aggregates** (unchanged **`/citizen/dashboard`** bucket semantics plus **`distinct_active_service_codes`** for Services); **every** municipality/service reachable without pinning.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Status: done (2026-05-12).** **API:** Prisma migration `20260515103000_citizen_pin_preferences`; **`Citizen`** JSON **`pinned_tenant_codes`** / **`pinned_services`** surfaced on profile + **`GET`/`PATCH /citizen/preferences`** (validated against **`GET /tenants`** operational catalogue and active services; portal tenant ineligible). **`GET /citizen/dashboard`** now ships **`distinct_active_service_codes`** (seed-catalogue union) so the hub **Services** KPI stays whole-portfolio without hub-wide **`/services/tenants/:code`** fan-out. **`POST /citizen/select-tenant`** remains last-workspace UX only (**no sync** into pins). **PWA (`page.tsx`):** post-OTP pin gate → hub pinned row + searchable **Browse all municipalities** drawer; **Shortcuts** tab; pinned service chips / hub Services filtering open workspace **Services** with code filter; aggregated hub calls still omit ULB scope header until dossier/workspace actions demand it. **Docs:** `@enagar/citizen-pwa` README smoke § Sprint 4.16; `@enagar/api` README preference rows + dashboard KPI note; unit tests refreshed (`citizen.service.spec`, Postgres citizen store mocks, Postgres application save guard expectation).

#### Sprint 4.2 — Grievances UI scope + regression pass

| Item              | Detail                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `GrievancesWorkspace` (and related) receive `tenantScope`; list/create/detail calls match Phase 2–3 semantics; edge cases from hub (e.g. opening grievance detail) defined and implemented. Full regression on applications/payments tabs in workspace. |
| **Tests**         | Component or integration tests where feasible; update any API consumer mocks.                                                                                                                                                                           |
| **Exit criteria** | No call from workspace omits tenant header unintentionally; hub does not send header on aggregate fetches.                                                                                                                                              |

---

### Phase 5 — Keycloak Option A (non-dev environments)

**Program goal:** Staging/prod realms issue the same semantic claims as dev (portal tenant + stable `sub`).

#### Sprint 5.1 — Realm, client, mappers, verifier alignment

| Item              | Detail                                                                                                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Keycloak realm doc: citizen client ID, OTP/broker wiring, protocol mappers for `tenant_id` / `tenant_code` (portal), role claims; JWKS/issuer env on API updated for each env; **remove or bypass** username pattern `tenant:mobile` for citizen OTP if still present; deployment checklist. |
| **Tests**         | Staging smoke: OTP → JWT decode matches expected claims; API hub + workspace flows against real Keycloak; negative test wrong scope header.                                                                                                                                                  |
| **Exit criteria** | Security/DevOps sign-off on mapper set; ADR appendix or runbook merged.                                                                                                                                                                                                                      |

---

### Phase 6 — Hardening & program exit

#### Sprint 6.1 — Docs, observability spot-check, backlog triage

| Item              | Detail                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | README/ADR excerpt; troubleshooting (missing header on write); structured log fields if useful; performance smoke on dashboard query (N+1 avoided or documented). |
| **Tests**         | Full CI green; optional k6 or manual “100 hub loads” if risk flagged.                                                                                             |
| **Exit criteria** | Product owner accepts exit demo + written checklist; remaining items moved to backlog with IDs.                                                                   |

---

## 10. Assumptions and follow-ups (minimal)

- **Option A** assumes Keycloak can issue **portal** `tenant_*` claims for all citizen OTP logins without per-ULB user records. If policy mandates per-ULB Keycloak users later, revisit with Sponsor.
- **Mobile uniqueness** is enforced in Keycloak and/or API as today; multi-person shared mobile is out of scope.
- If **grievance SLA seed** for portal tenant is noisy, explicitly **skip** portal in SLA seed loop (record decision in Phase 1 exit notes).

**Question for Sponsor (only if blocking Phase 5):** Confirm the **exact claim names** Keycloak will emit (`tenant_id` vs `tenantId`, etc.) so API `jwt-verifier` maps them without a second translation layer.
