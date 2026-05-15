# ROADMAP.md — eNagarSeba Delivery Plan

> **Audience**: Tech leads, engineering managers, the AI agent, and the WB Department of Urban Development & Municipal Affairs (DoUD&MA) sponsor.
> **Format**: Phase-wise plan. Each phase lists Goal, Scope, Key Deliverables, Out-of-Scope, Dependencies, Risks, Exit Criteria, and a _suggested_ sprint breakdown. **Sprint detailing is deferred** — we will plan each phase's sprints in a dedicated session before that phase begins.
> **Pace assumption**: 2-week sprints. A phase typically spans 1–4 sprints depending on size. Calendar weeks are _indicative_ — actual schedule depends on team size and parallelism.

---

## Phase Map at a Glance

```
   Phase 0     Phase 1     Phase 2     Phase 3     Phase 4     Phase 5     Phase 6
 Foundation   Tenant &   Service &   Payments,  Grievances  Citizen     Admin
 & Discovery  Identity   Workflow   Receipts &  & SLA       Mobile +    Portals
              Core       Engine     Finance     Engine      PWA Polish  (State +
                                                                        Tenant)
   2 wk        4 wk        6 wk        4 wk        3 wk        4 wk        5 wk

   Phase 7     Phase 8     Phase 9     Phase 10    Phase 11    Phase 12
 Sahayak AI   Bookings,  Field       Pilot       State-wide  Beyond
 (RAG + LLM   Smart City  Officer /  Hardening    Rollout     MVP
  Adapter)    & Tenders   Enforcement & Pilot                 (WhatsApp,
                          App        Launch                  Voice, IoT)
   4 wk        4 wk        2 wk        3 wk       continuous   continuous
```

**Total core build (Phase 0 → 10): ~41 weeks (~10 months)** with a team of 6–8 engineers + 1 PM + 1 designer + 1 QA. Phases overlap where dependencies allow (notes per phase).

---

## Execution spine (Master phases + Citizen Unified Hub)

This file carries **two coordinated naming schemes**:

1. **Master phases** — numbered **`Phase 0` … `Phase 12`** (whole-programme delivery: tenancy, workflow, payments, grievances engine, mobile polish, admin, AI, pilot…).
2. **Citizen Unified Hub programme** — sprints prefixed **`H`** (**`H1.1`**, **`H4.16`**, **`H5.1`**, …) under [Citizen Unified Hub programme (Option A)](#citizen-unified-hub-programme-option-a). Those **`H`** sprints are **not** the same labels as Master **Phase 4 grievance** sprints (**`Sprint 4.1`–`4.3`**) or Master **Phase 5 mobile** sprints (**`Sprint 5.1`–`5.4`**).

### Recommended rolling-wave order

Use this when prioritising what to pull next across tracks (adjust for staffing and credential unblock).

| Seq | Track  | Item                                                                                        | Notes                                                                                                                                                                           |
| --- | ------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Master | Phases **0 → 2**                                                                            | Closed where marked in sections below                                                                                                                                           |
| B   | Master | Phase **3** — payment core + stub rail                                                      | **Sprint 3.1B deferred:** not in the [locked 10-sprint queue](#locked-next-10-sprint-queue-priority-execution-order); add back when PSP credentials **and** sponsor unpause     |
| C   | Hub    | **H1 → H3** — portal tenant, hub reads, municipal writes                                    | Mostly closed — see Hub programme section                                                                                                                                       |
| D   | Master | Phase **4** — **Sprint 4.1–4.2** (grievance persistence + citizen tab MVP)                  | Closed 2026-05-11                                                                                                                                                               |
| E   | Hub    | **H4.1 → H4.15 → H4.16 → H4.2** — citizen **PWA hub** UX + grievance scope in hub/workspace | Mostly closed — hub sprint **order** is document order below                                                                                                                    |
| F   | Hub    | **H5.1** — Keycloak Option A on staging/prod + **staff/admin user bootstrap**               | **Next Hub-programme sprint** if continuing unified-hub identity rollout (after **H4.x**; no calendar lock — see [H5.1](#hub-phase-h5--keycloak-option-a-non-dev-environments)) |
| G   | Master | Phase **4** backlog (post‑4.3 core): breach inbox + public KPI slices                       | **Closed engineering 2026-05-14** — [`phase4-backlog-slice-exit.md`](docs/runbooks/phase4-backlog-slice-exit.md); native breach push deferred                                   |
| H   | Hub    | **H6.1** — hub docs / observability / backlog triage                                        | Exit polish for Hub programme slice                                                                                                                                             |
| I   | Master | Phase **5** — Citizen Mobile + PWA polish (**Master Sprint 5.1–5.4**)                       | Native shell + parity — **not** the same work as Hub **H5.1**                                                                                                                   |

### Locked next-10 sprint queue (priority execution order)

**Lock:** Execute **1 → 10** in order unless a sponsor-approved exception or a sprint exit failure forces a pause. **Sprint 3.1B** (PSP payment gateway) is **explicitly deferred** — it does **not** appear here; reinstate when credentials land **and** the sponsor pulls it from deferral.

**Progress:** **1 — Hub H5.1:** Repo slice merged — `realm-export` role parity + **runbook** + API **`tenant_clerk`/`municipality_*` acceptance** + **JWT tenant claim synonym resolution** (`tenantId`/`tenantCode` vs `tenant_id`/`tenant_code`). **Staging / pilot** still needs deliberate realm deploy, named operator inventory, Security/DevOps sign-off; **`pnpm infra:seed-keycloak-users`** ([runbook §7](./docs/runbooks/keycloak.md)) dummy ULB accounts suffice for QA smoke until pilot users exist. **2 — Hub H6.1:** **Closed in-repo (engineering)** **2026-05-14** — **[`hub-h6-exit-checklist`](./docs/runbooks/hub-h6-exit-checklist.md)** (**CI:** `pnpm lint` / `typecheck` / `test` / `test:security` green); **`citizen_hub_dashboard`** logs + KPI aggregation documented in **[`citizen-unified-hub`](./docs/runbooks/citizen-unified-hub.md)**; sponsor **PO initials** on the checklist optional; **tracker issue IDs** for deferred §6 backlog items still TBD when your board is wired. **3 — Master Phase 4 backlog slice:** **Closed in-repo (engineering)** **2026-05-14** — **[`phase4-backlog-slice-exit.md`](./docs/runbooks/phase4-backlog-slice-exit.md)** (citizen **`sla_breach` inbox**, public **`aggregate-metrics`**, attachment register + GPS-validated **`location`**, **200-case routing bake-off**; native breach push deferred). **4 — Master Sprint 5.1:** **Closed in-repo (engineering)** **2026-05-14** — **[`master-sprint-51-exit.md`](./docs/runbooks/master-sprint-51-exit.md)** (Expo **SDK 52** citizen shell **`Splash → GET /tenants → themed Home`**; `EXPO_PUBLIC_API_BASE_URL`; **`tsx` regression harness** (`tenantApi` doubles), SecureStore readiness probe). **5 — Master Sprint 5.2 (5.2a + 5.2b):** **Closed in-repo (engineering)** **2026-05-14** — **5.2a** [`master-sprint-52-exit.md`](./docs/runbooks/master-sprint-52-exit.md) (OTP, grievances, offline composer draft envelope); **5.2b** [`master-sprint-52b-exit.md`](./docs/runbooks/master-sprint-52b-exit.md) (`@enagar/forms` native **`createRenderPlan`**, **`/applications/**` + documents simulation, stub **`/payments`**). **6 — Sprint 5.3:** **Closed in-repo (engineering)** **2026-05-14** — [`master-sprint-53-exit.md`](./docs/runbooks/master-sprint-53-exit.md) (`@enagar/forms/web`, `@enagar/ui` citizen apply spine; PWA **`lib/service-schemas.ts`** + Tailwind **`content`** widening). **7 — Sprint 5.4:** **Closed in-repo (engineering)** **2026-05-15** — [`master-sprint-54-exit.md`](./docs/runbooks/master-sprint-54-exit.md) (push token persistence, **deep links**, **PWA manifest + SW + Lighthouse CI**, store listing copy). **8 — Sprint 6.1:** **Closed in-repo (engineering)** **2026-05-15** — [`master-sprint-61-exit.md`](./docs/runbooks/master-sprint-61-exit.md) (`apps/admin-tenant` Next shell **3002**, **`GET/PATCH /admin/tenant/\*`**, KPI dashboard + Postgres catalogue PATCH). **9 — Sprint 6.2:** **Closed in-repo (engineering)** **2026-05-15** — [`master-sprint-62-exit.md`](./docs/runbooks/master-sprint-62-exit.md) (form-schema draft/publish, workflow draft/publish, shared preview). **Next in queue:** **#10 — Sprint 6.3** (Fee-rule engine, document checklists, tax/tariff master, address master, revenue heads).

| #      | Sprint                             | Track            | Scope (pointer)                                                                                                                                                                                                                                                    |
| ------ | ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | **Hub H5.1**                       | Hub              | [Hub Phase H5 / H5.1](#hub-phase-h5--keycloak-option-a-non-dev-environments) — Keycloak Option A + staff/admin user bootstrap                                                                                                                                      |
| **2**  | **Hub H6.1**                       | Hub              | [Hub Phase H6 / H6.1](#hub-phase-h6--hardening--hub-programme-exit) — docs, observability spot-check, backlog triage                                                                                                                                               |
| **3**  | **Master Phase 4 — backlog slice** | Master           | **Closed engineering 2026-05-14** — [`phase4-backlog-slice-exit.md`](docs/runbooks/phase4-backlog-slice-exit.md) · post–4.3: SLA breach **`notifications`** + **`/public/grievances/aggregate-metrics`**, attachments/GPS polish, **`grievance-routing-bake-off`** |
| **4**  | **Sprint 5.1**                     | Master · Phase 5 | **Closed engineering 2026-05-14** — [`master-sprint-51-exit.md`](docs/runbooks/master-sprint-51-exit.md) · RN Expo shell (Splash → Tenant select → Home) — [§ Phase 5](#phase-5--citizen-mobile--pwa-polish)                                                       |
| **5**  | **Sprint 5.2**                     | Master · Phase 5 | **Closed engineering 2026-05-14** — [`master-sprint-52-exit.md`](docs/runbooks/master-sprint-52-exit.md) (**5.2a**) + [`master-sprint-52b-exit.md`](docs/runbooks/master-sprint-52b-exit.md) (**5.2b** native apply + stub payments)                               |
| **6**  | **Sprint 5.3**                     | Master · Phase 5 | **Closed engineering 2026-05-14** — [`master-sprint-53-exit.md`](docs/runbooks/master-sprint-53-exit.md) · `@enagar/forms/web` + `@enagar/ui` PWA apply spine                                                                                                      |
| **7**  | **Sprint 5.4**                     | Master · Phase 5 | **Closed engineering 2026-05-15** — [`master-sprint-54-exit.md`](docs/runbooks/master-sprint-54-exit.md) · push registration, deep links, PWA installability + Lighthouse CI, store metadata                                                                       |
| **8**  | **Sprint 6.1**                     | Master · Phase 6 | **Closed engineering 2026-05-15** — [`master-sprint-61-exit.md`](docs/runbooks/master-sprint-61-exit.md) · Tenant Admin Portal shell (**3002**), KPI dashboard + catalogue list/edit (`TenantService`) · [§ Phase 6](#phase-6--admin-portals-state--tenant)        |
| **9**  | **Sprint 6.2**                     | Master · Phase 6 | **Closed engineering 2026-05-15** — [`master-sprint-62-exit.md`](docs/runbooks/master-sprint-62-exit.md) · Form-schema draft/publish + shared preview; workflow draft/publish + validation                                                                         |
| **10** | **Sprint 6.3**                     | Master · Phase 6 | **Closed engineering 2026-05-15** — [`master-sprint-63-exit.md`](docs/runbooks/master-sprint-63-exit.md) · Fee-rule engine, document checklists, tax/tariff master, address master, revenue heads                                                                  |

**Master Phase 4 backlog slice (#3) — closed in-repo (engineering, 2026-05-14):** [`phase4-backlog-slice-exit.md`](docs/runbooks/phase4-backlog-slice-exit.md) — **`POST …/staff/sweep-sla`** fans out **`sla_breach` notification** rows (`GET/PATCH …/citizen/notifications`), **`POST …/:id/attachments/register`**, validated **`location` WGS-84** fields on create, **`GET /public/grievances/aggregate-metrics`**, deterministic **200-row** routing permutation test (`grievance-routing-bake-off.spec.ts`). **Still deferred:** sub-minute native breach push (**FCM/APNs**) + production rate limits on **`/public/*`**.

**Hub H6.1 — closed in-repo (engineering, 2026-05-14):** [`docs/runbooks/citizen-unified-hub.md`](./docs/runbooks/citizen-unified-hub.md) (hub header troubleshooting + verbatim portal-`400` bodies + dashboard notes), **`citizen_hub_dashboard`** structured logs (**`jwt_tenant_code`**, row counts, **`distinct_active_service_codes`** numeric count aligned with JSON, `duration_ms`) in `CitizenHubDashboardService`, O(U+R) KPI bucketing — see service JSDoc. **CI doc contract:** `tests/security/hub-h61-contract.spec.ts`. **Exit record:** [`hub-h6-exit-checklist.md`](./docs/runbooks/hub-h6-exit-checklist.md) (**Status: closed — engineering**). **Deferred hub polish:** [citizen-unified-hub §6](./docs/runbooks/citizen-unified-hub.md#6-backlog-pointers-triaged-under-h61); file discrete tracker issues when available.

**Master Sprint 5.1 (#4) — closed in-repo (engineering, 2026-05-14):** [`master-sprint-51-exit.md`](./docs/runbooks/master-sprint-51-exit.md) — **`apps/mobile`** Expo app + monorepo `metro`/Babel wiring; **`@enagar/i18n`** + **`@enagar/tenant-theme`** on Home theme rail; **`tsx`** `tenantApi` regression harness. **Sprint 5.2** (**5.2a** + **5.2b**): [`master-sprint-52-exit.md`](./docs/runbooks/master-sprint-52-exit.md), [`master-sprint-52b-exit.md`](./docs/runbooks/master-sprint-52b-exit.md).

**Master Sprint 5.2 (#5) — closed in-repo (engineering, 2026-05-14):** **`5.2a`** — [`master-sprint-52-exit.md`](./docs/runbooks/master-sprint-52-exit.md). **`5.2b`** — [`master-sprint-52b-exit.md`](./docs/runbooks/master-sprint-52b-exit.md): service catalogue, **`createRenderPlan`** (**`platform: 'native'`**), applications **`/drafts` → document intents → `/submit`**, stub **`/payments/initiate`** + **`/payments/stub/complete`**, **`POST /citizen/register`** after OTP. **Still deferred:** Detox / Maestro native E2E hard gate.

**Master Sprint 5.3 (#6) — closed in-repo (engineering, 2026-05-14):** [`master-sprint-53-exit.md`](./docs/runbooks/master-sprint-53-exit.md) — **`@enagar/forms/web`** (**`DynamicFormFields`**), **`@enagar/ui`** form primitives, **`apps/citizen-pwa/lib/service-schemas.ts`**, Tailwind **`content`** for cross-package class retention.

**Master Sprint 5.4 (#7) — closed in-repo (engineering, 2026-05-15):** [`master-sprint-54-exit.md`](./docs/runbooks/master-sprint-54-exit.md) — **`citizen_push_devices`** + **`POST /citizen/notifications/push-token`**; Expo push + **`enagarseba://` linking**; PWA **manifest / SW / icon**, query **deep links**, **`quality-gates.mjs`** in CI; pilot **[`docs/store-listing/`](./docs/store-listing/)** copy. **Still deferred:** universal / app links asset files on pilot host; **notification-worker** outbound FCM/APNs fan-out; Detox/Maestro hard E2E.

**Master Sprint 6.1 (#8) — closed in-repo (engineering, 2026-05-15):** [`master-sprint-61-exit.md`](./docs/runbooks/master-sprint-61-exit.md) — **`apps/admin-tenant`** Next.js (**PKCE** `admin-tenant` client); **`AdminTenantModule`** (`GET /admin/tenant/dashboard`, services **GET/PATCH**); **CORS** adds **`localhost:3002`**. **Explicit deferral:** citizen **`GET /services/tenants/:code`** stays seed-backed until a catalogue-alignment sprint.

**Master Sprint 6.2 (#9) — closed in-repo (engineering, 2026-05-15):** [`master-sprint-62-exit.md`](./docs/runbooks/master-sprint-62-exit.md) — **form-schema draft/publish** (`service_form_versions`), **workflow draft/publish** (`workflows`, `workflow_stages`, `workflow_transitions`), shared **`@enagar/forms/web`** preview in **`apps/admin-tenant`**, and workflow validation helpers in **`@enagar/workflow`**. **Explicit deferral:** drag-and-drop graph UI and citizen DB-backed schema consumption stay future slices.

**Master Sprint 6.3 (#10) — closed in-repo (engineering, 2026-05-15):** [`master-sprint-63-exit.md`](./docs/runbooks/master-sprint-63-exit.md) — Tenant Admin service **fee rule**, **document checklist**, and **revenue-head mapping** config; tenant **address master** + **tax/tariff master** APIs and UI; local seed data for KMC/HMC masters. **Explicit deferral:** citizen runtime still does not consume DB-backed admin config as the primary catalogue/source-of-truth.

**After #10:** Continue Phase **6** with **Sprint 6.4** onward, or replan with sponsor.

---

## Phase 0 — Foundation & Discovery

> "Decide everything that, if changed later, would force us to throw work away."

### Goal

Convert the current scratch-pad repo into a real, multi-app monorepo with CI, infrastructure-as-code, decided technology choices, and a baseline design system. Lock the **product charter** with the DoUD&MA sponsor.

### Scope

- Stakeholder workshops and field interviews (1 borough each in 3 ULBs of varying size — a corporation, a municipality, a notified-area authority).
- Ratify the seven open ADRs from `AGENT.md` §7.
- Stand up the monorepo, CI, dev infrastructure, design system.
- Translate the prototype's design into a tokenised, accessible design system (no business logic yet).

### Key Deliverables

1. **Charter & Stakeholder Map** (`docs/charter.md`): vision, success metrics, KPIs, escalation lanes.
2. **Decided ADRs** (`docs/ADRs/ADR-0001` … `ADR-0007`): DB engine, backend framework, mobile-first vs PWA, workflow engine, hosting target, payment gateway adapter strategy, KB authoring format.
3. **Monorepo skeleton** with PNPM + Turborepo:
   - All `apps/*` and `packages/*` folders scaffolded with package.json + minimal index.
   - ESLint, Prettier, TypeScript, Husky pre-commit, lint-staged, semantic-release configured.
4. **CI pipeline** (GitHub Actions): lint, type-check, unit test, build, Trivy scan, Renovate config.
5. **Local-dev infrastructure** (`infrastructure/docker-compose.yml`): postgres + redis + qdrant + ollama + minio + keycloak + meilisearch + mailhog. One command (`pnpm dev:up`) starts everything.
6. **Design system** (`packages/ui` + `packages/ui-native`):
   - Tokens (colour, type scale, spacing, radius, shadow) — sourced from the prototype's blue `#0F4C75` family, plus per-tenant overrides via CSS vars.
   - Core components (Button, Card, Input, Select, Modal, Toast, BottomSheet, Tabs, Badge, Avatar, Skeleton). 30 components target.
   - Storybook deployed to GitHub Pages for design review.
7. **Domain glossary** (`docs/glossary.md`) — every entity, every status, every revenue head, every role.
8. **Threat model** (`docs/security/threat-model.md`) — STRIDE per domain; informs Phase 1 onward.
9. **Service catalogue audit** — confirm the 76 services in the prototype against actual ULB by-laws; trim, add, correct fees.

### Out of Scope

- Any production code in `apps/api` or `apps/mobile` beyond a "hello world" route.
- Real database tables.
- Customer-facing UI flows.

### Dependencies

- DoUD&MA sponsor available for charter sign-off.
- Access to 3 sample ULBs for field interviews.

### Risks

- Late ratification of ADRs → cascades into Phase 1 delay. _Mitigation_: hard deadline of Phase 0 mid-point.
- Service catalogue gaps discovered later. _Mitigation_: catalogue audit is a Phase 0 deliverable.

### Exit Criteria

> ✅ Phase 0 closed 2026-05-06 — see Status section at the bottom of this file for the full closure note.

- ⚠️ All 7 ADRs ratified and merged. _6 accepted (0001/0002/0003/0005/0008/0009), 1 proposed (0010); 3 explicitly deferred to their natural phases (0004/0006/0007)._
- ⚠️ `pnpm install && pnpm dev:up && pnpm dev` boots every app to a hello screen. _`apps/api` + `apps/citizen-pwa` boot; the other 4 apps are package stubs._
- ✅ CI green on a freshly cloned repo.
- ⏭ Storybook published with ≥ 30 components. _Deferred to Phase 2 Sprint 2.5 — components don't exist yet._
- 🟡 Charter signed. _Pending sponsor sign-off._

### Suggested Sprint Slice

- ✅ **Sprint 0.1**: Charter, ADRs, repo skeleton, CI. _(commit `77a7355`)_
- ✅ **Sprint 0.2**: Design system docs, threat model, catalogue audit, glossary, ADR-0009, ADR-0010. _(commit `7b604d2`)_

---

## Phase 1 — Tenant & Identity Core

> "Everything else stands on this foundation. Get tenancy right, or rip it out later."
>
> ✅ Phase 1 closed 2026-05-07 — all exit criteria passed. DigiLocker remains blocked by missing external access / permission and is not treated as a Phase 1 completion blocker.

### Goal

Make the platform multi-tenant from the first byte. Citizens and staff can register, log in, switch municipalities, and prove their identity — all under enforced row-level isolation.

### Scope

- `tenants`, `citizens`, `users`, `roles`, `wards`, `address_master` tables with RLS.
- Authentication flow: OTP (citizen), username + password + MFA (staff), DigiLocker (optional Aadhaar verification).
- Keycloak realm per environment with OIDC clients for each app.
- JWT issuance with `tenant_id`, `roles`, `citizen_id` claims.
- Tenant picker / tenant switcher on citizen apps.
- Seed data for 8 sample tenants (the prototype's `MUNICIPALITIES` constant).
- Mobile + PWA splash, language picker, login, OTP, tenant select screens — wired to real APIs.

### Key Deliverables

1. ✅ **Database** (Phase 1.1):
   - ✅ Tables with RLS: `tenants`, `tenant_config`, `citizens`, `users` (staff), `roles`, `user_roles`, `wards`, `boroughs`, `localities`, `notifications` skeleton.
   - ✅ Prisma schema + initial migration.
   - ✅ **CI test**: every tenant-scoped table has an RLS policy; build fails otherwise.
2. **API endpoints** (subset of `ARCHITECTURE.md` §5):
   - ✅ `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`, `POST /auth/logout`
   - ✅ `POST /citizen/register`, `GET /citizen/profile`, `PATCH /citizen/profile`, `PATCH /citizen/language`, `POST /citizen/select-tenant`
   - ✅ `GET /tenants`, `GET /tenants/:id/config`
   - 🔴 `POST /auth/aadhaar-link` (DigiLocker OIDC broker placeholder wired; real integration blocked until access / permission is granted)
3. ✅ **Keycloak realm** with roles `citizen`, `tenant_clerk`, `tenant_admin`, `state_admin`, plus realm seed via Terraform / Keycloak CLI.
4. ✅ **JWT tenant-binding middleware**: every request derives tenant context from the verified Keycloak JWT before protected handlers run.
5. ✅ **Mobile + PWA screens** (real, not mock):
   - ✅ Splash → Language → Login (mobile + OTP) → OTP verify → Tenant picker → Empty Home.
   - ✅ Encrypted token storage (Expo SecureStore contract / browser crypto-backed session storage).
6. ✅ **i18n machinery**: en / bn / hi message catalogues in `packages/i18n`; CI lint for missing keys.
7. ✅ **Tenant theming**: `packages/tenant-theme` reads `tenants.theme_color` → emits CSS vars at runtime.
8. ✅ **Tenant onboarding script** (CLI): `pnpm seed:tenant -- --code KMC --name "Kolkata Municipal Corporation" …` — proves zero-code onboarding from the start.

### Out of Scope

- Service catalogue, applications, payments, grievances — none yet.
- Real Aadhaar verification (DigiLocker stub OK in dev).
- Admin portal screens.

### Dependencies

- Phase 0 complete (monorepo, design system, ADRs).
- DigiLocker sandbox credentials / permission from MeitY. _Currently unavailable; keep only placeholders and do not plan real Aadhaar linking until access is granted._

### Risks

- RLS misconfiguration → cross-tenant leak. _Mitigation_: automated tenant-isolation tests, dedicated security review at end of phase.
- Keycloak learning curve. _Mitigation_: 2-day spike at start of phase.

### Exit Criteria

- ✅ Two test citizens in two different tenants cannot see each other's profile in any way (automated via `CitizenService`; manual dev OTP path now reaches tenant selection).
- ✅ 8 tenants seeded; switching between them in the app picks up correct theme + name + ward count.
- ✅ OWASP ZAP scan: no critical / high findings on auth endpoints. _`pnpm security:zap:auth` completed with `FAIL-NEW: 0`, `WARN-NEW: 0`, and 119 passing checks._
- ✅ Keycloak MFA enforced for `*_admin` roles. _Realm marks admin roles `otp_required`; API rejects admin-role JWTs without `amr: ['otp']` or `acr: 'mfa'`._

### Suggested Sprint Slice

- ✅ **Sprint 1.1**: DB schema + RLS + Prisma + CI tests for tenant isolation.
- ✅ **Sprint 1.2**: Keycloak realm + auth endpoints + JWT middleware.
- ✅ **Sprint 1.3**: Mobile/PWA splash → tenant select screens, real APIs.
- ✅ **Sprint 1.4**: i18n + theming + onboarding CLI + security review.

### Parallelism

- Can overlap last 2 weeks with the start of Phase 2 once DB schema is stable.

---

## Phase 2 — Service & Workflow Engine (the heart of plug-and-play)

> "After this phase, adding a new service is a form-fill, not a code change."

### Goal

Build the data model and runtime that lets a tenant admin define a service end-to-end (form schema, fee, SLA, required docs, workflow stages, revenue head) and have it instantly available on the citizen apps — without a redeploy.

### Scope

- **Global Service Library** schema + 76-service seed.
- **Tenant Service Catalogue** layered on top with override semantics.
- **Form-Schema** (JSON-Schema variant tailored for our field types).
- **Form Renderer** (`packages/forms`): same library renders web (React) and mobile (RN). Fields supported in v1: text, number, date, radio, select, multiselect, textarea, file, section, conditional show-if.
- **Workflow / Stage Engine** (`packages/workflow` + `services/workflow-engine` worker):
  - State-machine schema: stages, transitions, role assignments, SLA per stage, on-enter / on-exit hooks, escalation rules.
  - Runtime: `applications` and `application_timeline` tables; clerk action API.
- **Application APIs**: create, list, detail, upload-doc, cancel, comment.
- **Citizen UI**: Services tab → category → service detail → multi-step form → review → success → My Applications → Application detail with live timeline (mirrors the prototype's flow exactly, but data-driven).
- **Document storage**: MinIO with virus scan via BullMQ + ClamAV.
- **Address / Holding-number lookup** API + UI — used by property tax / water / conservancy.

### Key Deliverables

1. **DB schema additions**:
   - `revenue_heads` (state-wide master)
   - `services` (per-tenant with override flag), `global_services` (state-wide library)
   - `service_categories` (state-wide), `service_documents`, `service_form_versions`
   - `workflows`, `workflow_stages`, `workflow_transitions`, `role_stage_map`
   - `applications`, `application_timeline`, `application_documents`, `application_comments`
   - `holdings` (property), `address_master`
2. **Form-Schema spec** (`docs/form-schema.md`) + Zod validators + JSON-Schema export.
3. **Workflow-Schema spec** (`docs/workflow-schema.md`) + visual representation.
4. **`packages/forms`**: render + validate + draft-save (auto-save every 30 s to local DB → background sync).
5. **`packages/workflow`**: pure state-machine evaluator + escalation calculator (no I/O, easy to test).
6. **API endpoints**: full set in `ARCHITECTURE.md` §5 → Services & Applications.
7. **Citizen flow on PWA + RN**: services list → detail → form → review → submit → My Applications → Application detail (matches the prototype 1:1 in UX).
8. **Document upload pipeline**: pre-signed MinIO URLs, ClamAV scan job, MIME validation, max-10 MB enforcement.
9. **Test fixture**: 76 seed services across 8 tenants, with at least 5 services having full form schemas (Birth Cert, Trade Licence, Property Tax, Water Connection, Building Plan).
10. **Performance benchmark**: list services for a tenant in < 100 ms (P95) cold cache.

### Out of Scope

- **Payments** (mocked "paid = true" for now).
- **Form Builder admin UI** (deferred to Phase 6).
- **Workflow visual designer** (deferred to Phase 6).
- Grievances (Phase 4).
- AI / chatbot.

### Dependencies

- Phase 1 complete (tenants, citizens, auth).
- ✅ Workflow engine decision accepted in ADR-0004: Postgres-backed state machine + BullMQ workers.

### Risks

- Form-schema spec under-designed for edge cases (conditional logic, computed fees). _Mitigation_: dogfood with 5 real services before declaring v1.
- Workflow engine too rigid. _Mitigation_: keep escalations and timers as runtime config, not code.

### Exit Criteria

- ✅ A citizen can complete an end-to-end Birth Certificate application: pick service → fill form → upload doc → submit → see "Document Verification" stage → see SLA-due timer. _Closed with draft application → document upload/scan → final submit ordering in the API and PWA._
- ✅ Adding a 77th service requires only a database insert (verified by recording the exact SQL). _Closed by `docs/sql/phase2-add-77th-service.sql` and `tests/security/phase2-closure.spec.ts`._
- ✅ Switching a service's form schema between v1 and v2 does not break in-flight applications (snapshot semantics confirmed). _Closed by explicit v1/v2 application snapshot regression coverage._
- ✅ 100 % API coverage with integration tests including tenant-leak attempts. _Closed for the Phase 2 API surface with Nest/Supertest integration coverage across services, applications, documents, holdings, and tenant-leak attempts._

### Suggested Sprint Slice

- ✅ **Sprint 2.1**: DB schema + revenue heads + service catalogue layering.
- ✅ **Sprint 2.2**: Form-Schema spec + `packages/forms` renderer (web + RN parity).
- ✅ **Sprint 2.3**: Workflow engine + applications + timeline.
- ✅ **Sprint 2.4**: Document upload pipeline + holding lookup.
- ✅ **Sprint 2.5**: Citizen UI end-to-end (Services → Apply → My Apps).
- ✅ **Sprint 2.6**: Hardening, tenant-isolation testing, performance pass.

### Sprint 2.1 — Detailed Deliverables

> ✅ Sprint 2.1 closed 2026-05-07 — Prisma schema/migration, catalogue seed fixtures, read APIs, override-resolution tests, tenant-isolation contracts, and full repo validation passed.

**Goal**: establish the database and seed-data foundation for plug-and-play services before form rendering, workflow runtime, or citizen application submission begins.

#### In Scope

1. ✅ **Prisma + migration schema**
   - ✅ Add state-wide `revenue_heads`.
   - ✅ Add state-wide `service_categories`.
   - ✅ Add state-wide `global_services` as the canonical library entry for each service code.
   - ✅ Add tenant-scoped `services` as the effective/adopted service catalogue per ULB.
   - ✅ Add service support tables needed for layering without implementing runtime forms yet: `service_documents`, `service_form_versions`, and lightweight workflow references/snapshot columns where needed.
   - ✅ Enable RLS and `tenant_isolation` policies for every tenant-scoped service table.
2. ✅ **Catalogue layering semantics**
   - ✅ Define global-template → tenant-adopted → tenant-overridden → tenant-only service behavior.
   - ✅ Preserve immutable fields from `docs/service-catalogue.md`: `service_code`, `category_code`, and DigiLocker-output policy.
   - ✅ Allow tenant overrides for active status, fees, SLA days, required documents, additive form fields, and additive workflow stages.
   - ✅ Ensure effective catalogue reads are tenant-scoped and never infer cross-tenant availability.
3. ✅ **Seed data foundation**
   - ✅ Create seed source structure for the 14 service categories.
   - ✅ Create seed source structure for revenue heads.
   - ✅ Create initial global service seed records from `docs/service-catalogue.md`.
   - ✅ Include the six priority service shells: Birth Certificate, Property Tax, Trade Licence, Community Hall Booking, Sanitation Grievance vocabulary placeholder, and RTI.
   - ✅ Keep full form schemas and workflow definitions as placeholders/snapshots for Sprint 2.2/2.3 unless needed for schema validation.
4. ✅ **API read surface**
   - ✅ Add public/citizen-safe catalogue endpoints for listing categories, listing tenant services, and reading service detail.
   - ✅ Return explicit columns only; no `SELECT *`.
   - ✅ Keep create/update admin APIs out of scope unless needed for seed validation.
5. ✅ **Tests and contracts**
   - ✅ Extend security migration contract tests to cover service catalogue tables and RLS policies.
   - ✅ Add service catalogue unit tests for effective override resolution.
   - ✅ Add API tests for tenant A/B catalogue isolation.
   - ✅ Add seed integrity tests: unique service codes, category references valid, revenue head references valid, and required translations present.
6. ✅ **Documentation**
   - ✅ Add or update the Phase 2 schema notes so future Sprint 2.2/2.3 work knows which fields are stable.
   - ✅ Update `tests/security/README.md` if new security contract suites are added.

#### Out of Scope

- Form renderer implementation in `packages/forms` (Sprint 2.2).
- Full JSON form-schema authoring and validation beyond version placeholders (Sprint 2.2).
- Workflow evaluator/worker runtime in `packages/workflow` and `services/workflow-engine` (Sprint 2.3).
- Application submission/timeline APIs (Sprint 2.3).
- Document upload, ClamAV jobs, and MinIO signed upload flow (Sprint 2.4).
- Citizen services UI beyond API contract smoke checks (Sprint 2.5).
- Admin portal form builder/workflow designer (Phase 6).

#### Sprint 2.1 Exit Criteria

- ✅ `prisma validate` and security migration contract tests pass for all new catalogue tables.
- ✅ Every tenant-scoped catalogue table has RLS enabled and a tenant isolation policy.
- ✅ At least 14 categories, revenue heads, and the initial priority service shells are seeded from structured source files.
- ✅ Tenant service override resolution is tested for default adoption, disabled service, fee/SLA override, and tenant-only custom service.
- ✅ Tenant A cannot read Tenant B's effective service catalogue through service APIs or direct service-layer tests.
- ✅ `ROADMAP.md` Sprint 2.1 deliverables are marked checked only after validation passes.

### Sprint 2.2 — Detailed Deliverables

> ✅ Sprint 2.2 closed 2026-05-07 — form-schema spec, shared `@enagar/forms` runtime, render-plan parity, JSON-Schema export, priority fixtures, package tests, security contracts, and full repo validation passed.

**Goal**: define the canonical form-schema contract and implement the shared `@enagar/forms` runtime so the same service form can be validated and rendered consistently on PWA, React Native, and the API.

#### In Scope

1. ✅ **Form-Schema specification**
   - ✅ Document `docs/form-schema.md` as the canonical v1 contract.
   - ✅ Define supported field types: text, number, date, radio, select, multiselect, textarea, file, section, and conditional show-if.
   - ✅ Define locale-aware labels/help text for en/bn/hi.
   - ✅ Define validation rules: required, min/max length, min/max number, regex pattern, enum options, file MIME/max-size metadata, and conditional visibility.
   - ✅ Define snapshot semantics for `service_form_versions` so in-flight applications keep the submitted schema version.
2. ✅ **`@enagar/forms` runtime**
   - ✅ Replace the Phase-0 placeholder with typed schema primitives.
   - ✅ Add schema validation helpers for field structure, duplicate IDs, unsupported field types, invalid required references, and invalid conditional references.
   - ✅ Add submission validation helpers that validate required visible fields, scalar types, enum values, multiselect values, and file metadata.
   - ✅ Add JSON-Schema export for server-side/API validation.
   - ✅ Add a platform-neutral render plan consumed by both web and RN renderers.
3. ✅ **Renderer parity contract**
   - ✅ Provide a web render adapter contract that maps fields to stable widget kinds.
   - ✅ Provide an RN render adapter contract that consumes the same render plan without DOM assumptions.
   - ✅ Keep actual styled citizen UI out of scope until Sprint 2.5.
4. ✅ **Seed schema fixtures**
   - ✅ Add representative v1 schemas for the Sprint 2.1 priority services where useful: Birth Certificate, Trade Licence, Property Tax, Community Hall Booking, and RTI.
   - ✅ Keep these fixtures compatible with `service_form_versions.form_schema`.
5. ✅ **Tests and contracts**
   - ✅ Unit-test schema validation, render-plan generation, JSON-Schema export, conditional visibility, and submission validation.
   - ✅ Add a security/static contract test proving form schemas remain shared between PWA/RN/API and do not introduce service-specific UI code.
   - ✅ Ensure invalid schemas fail tests before they can be seeded.

#### Out of Scope

- Persisting citizen application submissions (Sprint 2.3).
- Workflow transition/evaluator runtime (Sprint 2.3).
- Document upload pipeline and real file storage (Sprint 2.4).
- Styled citizen Services → Apply UI (Sprint 2.5).
- Admin form builder UI (Phase 6).
- Payment-aware fee collection (Phase 3).

#### Sprint 2.2 Exit Criteria

- ✅ `docs/form-schema.md` exists and documents every v1 field type plus snapshot semantics.
- ✅ `@enagar/forms` exports typed schema primitives, validation, render-plan generation, and JSON-Schema export.
- ✅ The same sample schema produces equivalent web and RN render plans.
- ✅ Invalid schemas fail fast for duplicate field IDs, unsupported field types, invalid required fields, and invalid conditional references.
- ✅ Submission validation passes for valid visible-field payloads and rejects missing/invalid visible fields.
- ✅ `pnpm --filter @enagar/forms test`, full repo typecheck/test/build, and security tests pass before deliverables are marked complete.

### Sprint 2.3 — Detailed Deliverables

> ✅ Sprint 2.3 closed 2026-05-07 — workflow/application schema, RLS migration, `@enagar/workflow` evaluator, idempotent worker helpers, protected application APIs, timeline/comment behavior, unit tests, security contracts, and full repo validation passed.

**Goal**: introduce the application runtime: a data-defined workflow evaluator, application records, timeline audit, and protected APIs that let a citizen submit and track a service request without implementing document upload or payments yet.

#### In Scope

1. ✅ **Prisma + migration schema**
   - ✅ Add `workflows`, `workflow_stages`, `workflow_transitions`, and `role_stage_map` as tenant-scoped workflow definition tables.
   - ✅ Add `applications`, `application_timeline`, and `application_comments` as tenant-scoped runtime tables.
   - ✅ Store immutable snapshots for `service_code`, form version, workflow version/current stage, status label, pending role, submitted form data, and mock payment status.
   - ✅ Enable RLS and `tenant_isolation` policies for every tenant-scoped workflow/application table.
2. ✅ **`@enagar/workflow` runtime**
   - ✅ Replace the placeholder with typed stage/transition/workflow primitives.
   - ✅ Implement pure transition evaluation: allowed verb, current stage, actor role, terminal-stage guard, and optional comment requirement.
   - ✅ Implement SLA due-date calculation.
   - ✅ Provide reusable workflow fixtures for certificate issuance, instant/tax, and booking patterns.
3. ✅ **`services/workflow-engine` worker helpers**
   - ✅ Replace the placeholder with idempotent job/effect primitives.
   - ✅ Key effects by `(tenant_id, application_id, transition_id, effect_type)` to prevent duplicate side effects.
   - ✅ Provide SLA escalation job shape and due-stage reconciliation helper without adding real notification dispatch yet.
4. ✅ **Applications API**
   - ✅ Add protected endpoints:
     - `POST /applications`
     - `GET /applications`
     - `GET /applications/:docketNo`
     - `POST /applications/:id/cancel`
     - `POST /applications/:id/comment`
   - ✅ Validate submitted form data with `@enagar/forms` fixtures.
   - ✅ Create an initial timeline row at submit.
   - ✅ Return citizen-owned, tenant-scoped application summaries and details.
   - ✅ Return 404 for cross-tenant/cross-citizen application lookups.
5. ✅ **Tests and contracts**
   - ✅ Unit-test workflow evaluator transitions, wrong-role rejection, terminal-stage rejection, and SLA due-date calculation.
   - ✅ Unit-test workflow-engine idempotency/reconciliation helpers.
   - ✅ Unit-test application create/list/detail/cancel/comment and citizen isolation behavior.
   - ✅ Extend migration/security contract tests for workflow/application tables and API route registration.

#### Out of Scope

- Document upload and MinIO/ClamAV processing (Sprint 2.4).
- Real payment lifecycle; use `payment_status = "not_required"` or mocked paid status until Phase 3.
- Staff/operator action UI and full back-office workflow inbox.
- Styled citizen Services → Apply → My Applications UI (Sprint 2.5).
- Admin workflow visual designer (Phase 6).
- Real notification delivery for SLA escalations.

#### Sprint 2.3 Exit Criteria

- ✅ Workflow/application tables exist with RLS and tenant-isolation policies.
- ✅ `@enagar/workflow` rejects invalid transitions and calculates SLA due dates deterministically.
- ✅ `services/workflow-engine` idempotency tests prove duplicate jobs produce one effect.
- ✅ A citizen can submit a Birth Certificate fixture application through the API and receive a docket number.
- ✅ Citizen application list/detail APIs return only that citizen's tenant-scoped applications.
- ✅ Cancel/comment actions append timeline/comment records without crossing tenant/citizen boundaries.
- ✅ API, workflow package, workflow-engine package, security tests, full typecheck/test/build pass before deliverables are marked complete.

### Sprint 2.4 — Detailed Deliverables

> ✅ Sprint 2.4 closed 2026-05-07 — document/holding schema, RLS migration, protected document upload/download contracts, scan-result guards, tenant-scoped holding lookup fixtures, application document metadata integration, unit tests, security contracts, and full repo validation passed.

**Goal**: add the document intake and property/holding lookup foundation needed by application submission, while keeping actual object storage and virus scanning behind replaceable adapters.

#### In Scope

1. ✅ **Prisma + migration schema**
   - ✅ Add tenant-scoped `application_documents` for upload metadata, object keys, scan status, and application linkage.
   - ✅ Add tenant-scoped `holding_records` as the local mirror/cache for property/holding lookup.
   - ✅ Add tenant-scoped `holding_lookup_audit` for lookup outcome, source, actor, and timestamp.
   - ✅ Enable RLS and `tenant_isolation` policies for all new tenant-scoped tables.
2. ✅ **Document upload API**
   - ✅ Add protected endpoints:
     - `POST /documents/upload-intent`
     - `POST /documents/:id/scan-result`
     - `GET /documents/:id/download`
   - ✅ Validate declared MIME type and file size before issuing upload intent.
   - ✅ Generate tenant-scoped object keys under a deterministic prefix.
   - ✅ Return a short-lived upload URL/download URL contract that can later be backed by MinIO pre-signed URLs.
   - ✅ Track scan status: `pending`, `clean`, `infected`, and `failed`.
   - ✅ Block download for documents that are not scan-clean.
3. ✅ **Document scan worker contract**
   - ✅ Add scan-result contract through API helper and document state transitions.
   - ✅ Ensure scan result updates are scoped to the same tenant/application/document.
   - ✅ Keep real ClamAV invocation out of scope, but preserve the result contract.
4. ✅ **Holding lookup API**
   - ✅ Add protected endpoints:
     - `GET /holdings/:holdingNumber`
     - `GET /holdings/search?q=...`
   - ✅ Seed tenant-specific holding fixtures for KMC/HMC so positive, negative, and cross-tenant cases are testable.
   - ✅ Return explicit fields: holding number, owner display name, ward, locality, address, property type, outstanding amount, and source freshness.
   - ✅ Represent lookup audit semantics for found and not-found outcomes.
5. ✅ **Application integration**
   - ✅ Allow application details to expose associated document metadata without returning upload/download URLs inline.
   - ✅ Keep form submission itself unchanged; document upload remains a separate step until Sprint 2.5 UI integration.
6. ✅ **Tests and contracts**
   - ✅ Unit-test MIME/size validation, upload intent generation, scan-result state transitions, and scan-clean download guard.
   - ✅ Unit-test holding lookup found/not-found/cross-tenant behavior.
   - ✅ Extend tenant-isolation migration tests for all new document/holding tables.
   - ✅ Add security/static tests proving protected document/holding APIs are registered and not public.

#### Out of Scope

- Real MinIO SDK integration and bucket provisioning beyond URL/object-key contract.
- Real ClamAV daemon invocation or streaming file scan.
- Browser/mobile upload UI (Sprint 2.5).
- Payment-linked document gates.
- External municipal property API adapters; use local mirror fixtures in this sprint.
- Staff-side document review UI.

#### Sprint 2.4 Exit Criteria

- ✅ Document/holding tables exist with RLS and tenant-isolation policies.
- ✅ Upload intent rejects unsupported MIME types and files over 10 MB.
- ✅ Upload intent returns a tenant-scoped object key and short-lived URL contract.
- ✅ Download URLs are blocked until the document scan status is `clean`.
- ✅ Holding lookup returns the correct KMC fixture and does not leak HMC records.
- ✅ Not-found holding lookups are represented/auditable without exposing another tenant's data.
- ✅ API, security tests, full typecheck/test/build pass before deliverables are marked complete.

### Sprint 2.5 — Detailed Deliverables

> ✅ Sprint 2.5 closed 2026-05-07 — citizen PWA service catalogue, schema-driven apply flow, holding lookup, document upload/scan simulation, My Applications list/detail, comments, cancellation, static security contracts, and full repo validation passed.

**Goal**: turn the citizen PWA from an onboarding shell into the first end-to-end service application experience: Services → Apply → Documents/Holding lookup → Submit → My Applications.

#### In Scope

1. ✅ **Citizen navigation and dashboard**
   - ✅ Add post-login navigation tabs for Home, Services, Apply, and My Applications.
   - ✅ Preserve Sprint 1.3 onboarding: splash, language, OTP login, tenant picker, tenant theming, token storage.
   - ✅ Show selected tenant, language, application count, and latest application status on the dashboard.
2. ✅ **Services catalogue UI**
   - ✅ Fetch tenant services from `GET /services/tenants/:tenantCode`.
   - ✅ Render priority service cards with category, fee type, SLA, required documents, and DigiLocker availability.
   - ✅ Let a citizen choose a service and move into the Apply flow.
3. ✅ **Schema-driven Apply flow**
   - ✅ Use shared `@enagar/forms` fixtures/render-plan concepts rather than service-specific React components.
   - ✅ Render v1 field types needed by priority fixtures: text, date, radio/select, number, textarea, file placeholder, and section.
   - ✅ Validate required fields enough to block obviously incomplete submissions before API call.
   - ✅ Submit applications through `POST /applications`.
4. ✅ **Holding lookup integration**
   - ✅ For property-tax style applications, call `GET /holdings/:holdingNumber`.
   - ✅ Display found/not-found outcomes and source freshness.
   - ✅ Do not leak another tenant's holding data through UI assumptions.
5. ✅ **Document upload simulation**
   - ✅ For file fields, call `POST /documents/upload-intent` after application submission.
   - ✅ Immediately simulate a clean scan through `POST /documents/:id/scan-result` so the citizen can see document state without real MinIO/ClamAV.
   - ✅ Show document code, scan status, and object-key prefix in application detail.
6. ✅ **My Applications UI**
   - ✅ Fetch `GET /applications` and `GET /applications/:docketNo`.
   - ✅ Show docket number, service name, stage/status, payment status, submitted date, timeline, comments, and documents.
   - ✅ Support citizen comment and cancel actions through existing API endpoints.
7. ✅ **Tests and contracts**
   - ✅ Add static/security contract tests proving the PWA uses Sprint 2.1-2.4 API routes.
   - ✅ Preserve the no service-specific form component guard.
   - ✅ Run PWA lint/typecheck/build plus full repo validation before marking deliverables complete.

#### Out of Scope

- Staff/operator workflow inbox.
- Real browser file binary upload to MinIO.
- Real ClamAV scan execution.
- Payment collection screens beyond showing current mock/not-required payment status.
- Offline queueing for application drafts.
- Admin service/form/workflow builders.

#### Sprint 2.5 Exit Criteria

- ✅ Citizen can log in, select KMC, view service cards, choose Birth Certificate, submit a valid application, and see a docket number in My Applications.
- ✅ Property Tax flow can call holding lookup and display the KMC holding fixture without leaking HMC data.
- ✅ File fields create document upload intents and clean scan-result metadata in the application detail.
- ✅ My Applications supports list, detail, comment, and cancel actions.
- ✅ PWA uses shared form-schema fixtures/render-plan semantics, not service-specific form components.
- ✅ PWA lint/typecheck/build, API tests, security tests, and full repo validation pass before deliverables are marked complete.

### Sprint 2.6 — Detailed Deliverables

> ✅ Sprint 2.6 closed 2026-05-07 — expanded cross-citizen/cross-tenant mutation tests, Phase 2 protected-route and PWA hardening contracts, local performance smoke budgets, PWA source-size guard, security documentation, and full repo validation passed.

**Goal**: harden the Phase 2 implementation before moving to Phase 3 by expanding isolation coverage, enforcing protected-route contracts, and adding lightweight performance/bundle budgets for the catalogue, forms, workflow, and PWA.

#### In Scope

1. ✅ **Tenant/citizen isolation hardening**
   - ✅ Add unit tests for cross-citizen comment/cancel rejection on applications.
   - ✅ Add unit tests for cross-tenant/cross-citizen document scan/download rejection.
   - ✅ Add holding lookup/search assertions for found, not-found, and cross-tenant behavior.
   - ✅ Ensure forbidden cross-tenant application/document access resolves as 404-style behavior rather than data-bearing errors.
2. ✅ **Security/static contract hardening**
   - ✅ Add a Phase 2 hardening security suite that checks all protected API controllers stay non-public and bearer-authenticated.
   - ✅ Assert PWA uses the expected Phase 2 API routes and keeps service-specific form components out.
   - ✅ Assert tenant-scoped migration contract names reflect Phase 2 rather than stale Sprint labels.
   - ✅ Keep generated reports/artifacts out of source-controlled paths.
3. ✅ **Performance smoke checks**
   - ✅ Add deterministic tests for service catalogue resolution and form render-plan generation under small local thresholds.
   - ✅ Add workflow transition evaluator smoke test under a local threshold.
   - ✅ Add PWA source/bundle budget guard so `app/page.tsx` remains below the 1,600-line project standard.
   - ✅ Keep these as smoke budgets, not production P95 claims.
4. ✅ **Documentation**
   - ✅ Update `tests/security/README.md` to include the Sprint 2.6 hardening suite.
   - ✅ Mark Sprint 2.6 deliverables and exit criteria complete only after validation passes.

#### Out of Scope

- Replacing in-memory API storage with Prisma persistence.
- Real load testing with k6/JMeter.
- Browser automation with Playwright.
- Production observability dashboards.
- Payment hardening; that starts in Phase 3.
- Staff/operator workflow UI.

#### Sprint 2.6 Exit Criteria

- ✅ Cross-citizen application comment/cancel attempts are covered and rejected.
- ✅ Cross-tenant document scan/download attempts are covered and rejected.
- ✅ Protected Phase 2 API controllers remain non-public and bearer-authenticated.
- ✅ Catalogue, form render-plan, and workflow evaluator smoke performance tests pass.
- ✅ PWA page remains below the 1,600-line project standard.
- ✅ Full lint, typecheck, test, build, and security suites pass before Sprint 2.6 is marked complete.

### Phase 2 Closure Hardening — Detailed Deliverables

**Goal**: satisfy the original Phase 2 exit criteria strictly before Phase 3 starts, not just the sprint-level checklist.

#### In Scope

1. ✅ **SQL-only 77th service proof**
   - ✅ Record the exact SQL needed to add a new global service and make it available to a tenant.
   - ✅ Add a security/static test proving the SQL touches only catalogue/form tables and does not require a code seed.
2. ✅ **Form schema snapshot regression**
   - ✅ Add an explicit v1/v2 test showing an in-flight application keeps its original `form_version`.
   - ✅ Prove newly submitted applications can use the updated schema version without mutating the existing application snapshot.
3. ✅ **Phase 2 API integration coverage**
   - ✅ Add Nest/Supertest integration tests for tenant service listing, application creation/detail, draft document upload, final submission, holding lookup, and tenant-leak attempts.
   - ✅ Ensure cross-tenant/cross-citizen reads and document access return non-data-bearing 404-style responses.
4. ✅ **Pre-submit document ordering**
   - ✅ Add a draft application step so document upload intents are created before final submission.
   - ✅ Update the PWA to create draft → upload/scan documents → submit draft → show docket/stage/SLA.
   - ✅ Keep actual MinIO binary transfer and ClamAV daemon integration out of scope, but make the API order real and enforceable.
5. ✅ **Documentation and closure status**
   - ✅ Update security documentation for the new integration and SQL proof coverage.
   - ✅ Mark Phase 2 exit criteria only after focused and full validation pass.

#### Exit Criteria

- ✅ Exact SQL for adding a 77th service is committed and tested.
- ✅ Form schema v1/v2 snapshot behavior has a regression test.
- ✅ API integration tests cover happy paths and tenant-leak attempts for Phase 2 routes.
- ✅ The PWA no longer uploads documents only after final application submission.
- ✅ Full lint, typecheck, tests, security contracts, and build pass.

### Parallelism

- Form-schema and workflow can be designed in parallel by two engineers.
- UI work can begin once API contracts (OpenAPI) are frozen — usually mid-Sprint 2.3.

---

## Phase 3 — Payments, Receipts & Finance

> "If we can't take ₹50 reliably, we can't run a municipality."

### Goal

Reliable, idempotent, gateway-agnostic payments tied to applications, plus the finance-side primitives: receipts, GL postings, deposits, refunds, and challans.

### Scope

- Payment gateway adapter pattern (`IPaymentGateway`); first concrete adapter (Razorpay or PayU per ADR-006).
- Payment lifecycle: initiate → redirect / SDK → webhook → settle → receipt PDF.
- **Idempotency keys** on `POST /payments/initiate`.
- Deposits as first-class entities (EMD, security deposit, hall booking deposit).
- Daily job: identify deposits past `expected_release_at` in `HELD` → create refund task.
- Challans: enforcement-issued, citizen-paid; pay-by-challan-number flow.
- Fines as a distinct path (citizen pays without an application).
- GL posting: every settled payment auto-posts to `gl_account` based on `revenue_head_code`.
- Receipt PDF generation (HTML → PDF via Playwright in worker).

### Key Deliverables

1. **DB additions**:
   - `payments` (extended), `deposits`, `challans`, `gl_postings`, `refunds`.
2. **`IPaymentGateway` interface** + Razorpay/PayU adapter.
3. **Endpoints**: `POST /payments/initiate`, `POST /payments/webhook`, `GET /payments`, `GET /payments/:id/receipt`, `GET /challans/:no`, `POST /challans/:no/pay`.
4. **Webhook signature verification** + replay protection (Redis nonce store).
5. **Receipt PDF service** with QR code linking back to verification URL.
6. **Refund engine**: daily job, finance-officer approval, idempotent gateway refund call.
7. **Reconciliation report** (CSV + PDF) — daily, per tenant, downloadable from admin portal API.
8. **Citizen UI**: Payment screen integrated into Apply flow (steps 1 → 2 → 3 in prototype), My Payments screen, Receipt download.
9. **Failure handling**: timeout, gateway-down, partial-success — every state is recoverable.

### Out of Scope

- Tenant admin UI for finance (Phase 6).
- Auto-disburse of refunds (manual approve in v1).
- Smart parking pay-as-you-go (Phase 8).

### Dependencies

- Phase 2 complete (applications carry the amount payable).
- Gateway sandbox credentials for real provider redirects, webhook validation, refunds, and reconciliation. _Unavailable as of 2026-05-08; Sprint 3.1A proceeds with a deterministic stub gateway only._

### Risks

- Gateway downtime during pilot → bad first impression. _Mitigation_: graceful degradation, retry queue, transparent status banner.
- Webhook signature spoofing. _Mitigation_: strict signature verification + IP allow-list.

### Exit Criteria

- 1,000 simulated payments — zero double-charges, zero orphan applications, every transaction in `gl_postings`.
- Refund flow: deposit → release-eligible → approved → refunded → citizen sees credit-back.
- Receipt PDF QR code resolves to a public verification page.
- PCI-DSS scope minimised (no card data ever touches our servers).

### Suggested Sprint Slice

- **Sprint 3.1A**: Payment core without gateway credentials — `IPaymentGateway`, stub adapter, fixed-fee application payment initiation, idempotency contract, tenant/citizen isolation tests, and explicit credential-gated boundaries.
- **Sprint 3.1B**: Real provider adapter once sandbox credentials arrive — Razorpay/PayU/state aggregator adapter, real redirect contract, webhook signature verification, replay protection, and gateway status polling.
- **Sprint 3.2**: ✅ Receipts + GL postings + reconciliation groundwork (closed 2026-05-11 — see detailed section below).
- **Sprint 3.4A**: ✅ Citizen payment UI + failure-handling polish on the stub rail (closed 2026-05-11 — PWA: My Applications checkout, My Payments tab, receipt metadata placeholder).
- **Sprint 3.3A**: ✅ Deposits + refund approvals + enforcement challans (closed 2026-05-11 — Prisma migration `20260511143000_deposits_refunds_challans`, tenant RLS, `/api/finance/*` staff routes gated to `tenant_admin` / `municipality_admin` / `state_admin`; PSP disbursement/refund RPC intentionally absent until Sprint 3.1B).
- **Sprint 3.1B interrupt lane**: Start immediately when gateway sandbox credentials arrive, even if it interrupts 3.3A at a clean checkpoint.

#### Sprint 3.1A — Payment Core Without Gateway Credentials

**Status**: completed 2026-05-08 for stub-gateway payment core and DB persistence proof.

**Goal**: replace Phase 2's mocked payment status with a real internal payment initiation contract while keeping external gateway calls stubbed until credentials are available.

##### In Scope

1. ✅ Accept ADR-0006 as an adapter-first payment gateway decision with `stub` as the only runnable provider until sandbox access exists.
2. ✅ Add `POST /payments/initiate`, `GET /payments`, and `GET /payments/:id` API surface for citizen-owned fixed-fee application payments.
3. ✅ Require `Idempotency-Key` on payment initiation and reject key reuse with a different request body.
4. ✅ Enforce tenant/citizen ownership so cross-tenant payment reads and mutations return not-found responses.
5. ✅ Keep amount validation conservative: Sprint 3.1A supports only fixed-fee `amount_paise` service configs and rejects computed/slab/external fee flows.
6. ✅ Add Postgres schema for `payments` and `payment_idempotency_keys`, including RLS, active-payment uniqueness, and the removal of Phase 2's `mock_paid` application status.
7. ✅ Add a `PaymentStore` persistence boundary plus an in-memory runtime store and a Postgres store implementation shape aligned to the new tables.
8. ✅ Add an `ApplicationStore` boundary so application persistence can be switched independently from workflow/payment logic.
9. ✅ Add `citizens.keycloak_subject` persistence and a `CitizenStore` boundary so application rows can resolve `citizen_id` from the authenticated subject.
10. ✅ Add a shared Nest `DatabaseModule` / `PrismaService` backed by the generated Prisma client, without forcing eager DB connection while runtime stores remain in-memory.
11. ✅ Make citizen, application, document, and payment service/controller paths async-ready so Postgres stores can be activated without changing API contracts again.
12. ✅ Activate `PostgresCitizenStore` in `CitizenModule` and add focused Prisma-store tests for tenant + Keycloak-subject lookup/upsert behavior.
13. ✅ Implement `PostgresApplicationStore`, add `applications.runtime_snapshot`, and wire an explicit `APPLICATION_STORE_PROVIDER=postgres` activation gate with focused persistence tests.
14. ✅ Add and execute a gated DB-backed `PostgresApplicationStore` integration spec (`RUN_DB_TESTS=1`) that persists and restores an application through Postgres.
15. ✅ Wire `PostgresPaymentStore` behind `PAYMENT_STORE_PROVIDER=postgres` so payment storage can move to Postgres once application persistence is enabled.
16. ✅ Add and execute a gated DB-backed `PostgresPaymentStore` integration spec (`RUN_DB_TESTS=1`) that persists payment attempts and idempotency keys against a real `applications.id` foreign key.

##### Out of Scope

- Real Razorpay/PayU/state-aggregator SDK calls. _Aggregator details are unavailable and explicitly deferred to a later Phase 3 provider-integration slice._
- Public webhook handling with real signature verification.
- Receipt PDF/HTML worker orchestration (`Playwright` pipeline) stays future work — Sprint 3.2 issues immutable receipt rows, the public verifier endpoint + QR contract (`enagar_receipt_verify_v1`), `gl_postings`, and gated CSV reconciliation export from stub settlements.
- Public PSP webhooks handling with signature verification remains credential-gated.
- Automated refunds / deposits / challans (planned for separate sprints inside Phase 3).
- Computed property-tax and legacy-backed fee collection.
- Community hall `deposit_paise` collection. _Deposits remain Sprint 3.3 so they can share one refund/release model instead of becoming a special case in 3.1A._

##### Exit Criteria

- API tests prove successful stub initiation, idempotent retry, idempotency-key conflict, amount mismatch rejection, and cross-tenant isolation.
- Gated DB tests prove application persistence plus payment/idempotency persistence against local Postgres.
- Prisma schema and payment-core migration validate.
- Full API lint/typecheck/test pass.
- No card, UPI handle, wallet token, or net-banking credential is accepted or persisted by the platform.

##### Sequencing Note

`CitizenModule` now uses `PostgresCitizenStore`, backed by `citizens.keycloak_subject`. `PostgresApplicationStore` is available behind `APPLICATION_STORE_PROVIDER=postgres`, and `PostgresPaymentStore` is available behind `PAYMENT_STORE_PROVIDER=postgres`. Both gated DB specs have passed against local Postgres, including payment/idempotency persistence against a real `applications.id` foreign key. Keep the explicit provider gates until the remaining application workflows are ready for Postgres-by-default runtime activation.

#### Sprint 3.2 — Receipts + GL Postings + Reconciliation Groundwork

**Status**: completed 2026-05-11.

**Goal**: turn a stub-captured payment into durable finance primitives (receipt fact, GL row, reconciliation extract) without depending on live PSP credentials, so Sprint 3.1B only adds adapter metadata instead of redesigning tables.

##### In Scope

1. ✅ Prisma migration `20260511093000_payment_receipts_gl` adding `receipts`, `gl_postings`, and `payments.settled_at`, each `tenant_id` scoped with RLS mirroring other finance-adjacent tables.
2. ✅ Deterministic stub settlement API `POST /api/payments/stub/complete` guarded from production unless `ALLOW_STUB_PAYMENT_SETTLEMENT=true`.
3. ✅ Citizen receipt artefact `GET /api/payments/:paymentId/receipt` returning the `enagar_receipt_verify_v1` QR contract (relative paths only — callers join their public origin).
4. ✅ Public verifier `GET /api/public/receipts/verify/:token` (`@Public`) returning non-PII audit metadata for QR deep links.
5. ✅ GL posting per settlement: debit `PG-CLEARING-STUB`, credit the catalogue `accounting_code`, `settlement_reference` defaults to the stub `gateway_order_id` until PSP settlement IDs arrive.
6. ✅ CSV reconciliation export `GET /api/payments/reconciliation/export?business_date=YYYY-MM-DD` filtered to the India/Kolkata civil day, restricted to `tenant_admin` / `municipality_admin` / `state_admin` (tests may set `ALLOW_FINANCE_EXPORT_FOR_TESTS=true`).
7. ✅ `ServicesService.resolveLedgerCodesForService` centralises revenue head → accounting code resolution for payment settlement.

##### Out of Scope

- Receipt PDF / HTML rendering workers.
- Live PSP redirect + webhook flows (Sprint 3.1B interrupt lane).
- Admin portal widgets (Phase 6) — export is API-only for now.

##### Exit Criteria

- Postgres path creates exactly one `receipts` row and one `gl_postings` row per successful stub settlement, with payment status `settled` and application `payment_status` advanced to `paid`.
- Public verifier responds with `valid=false` for unknown tokens without differentiating why.
- `pnpm --filter @enagar/api test`, `lint`, and `typecheck` succeed; optional `RUN_DB_TESTS=1` exercises the new settlement integration spec.

#### Recommended Next Two Sprints While Gateway Credentials Are Pending

1. ✅ **Sprint 3.4A — Citizen Payment UI + Failure Handling** (2026-05-11)
   - Citizen PWA: **My Applications** detail includes fixed-fee line, method selector, `POST /payments/initiate` (Idempotency-Key), **Simulate PSP capture** for `requires_action`, failed/pending copy, and **Load receipt metadata** via `GET /payments/:id/receipt` (JSON / QR contract placeholder — no PDF).
   - **My Payments** tab lists history, repeats stub-complete and receipt preview, and documents `409` / network recovery behaviour.
   - **Exit met:** recoverable payment step on the application detail panel + dedicated **My Payments** view, all against existing stub APIs.

2. ✅ **Sprint 3.3A — Deposits / Refunds / Challan Model** (2026-05-11)
   - **Delivered**: `deposits`, `refund_dispatches`, `challans` tables (paise-aligned amounts), partial unique queue index on refund dispatches, RLS parity with payment tables; pure lifecycle guards for transitions; Nest `FinanceModule` with Swagger-tagged **`/api/finance/*`** staff endpoints (deposit CRUD-lite, forfeiture + release eligibility chain, refund queue submit/approve/reject/**complete-internal**, challan issue / waive / **mark-paid-internal** without PSP linkage).
   - **Out of scope (unchanged)**: live aggregator refund/disbursement RPCs — deferred to Sprint 3.1B with settlement identifiers.
   - **Exit**: community-hall-grade refundable deposits plus finance approval queue represented end-to-end in Postgres + deterministic tests (`finance-lifecycle.spec.ts` always-on; **`RUN_DB_TESTS=1`** activates `finance.db.spec.ts`).

**Recently closed while credentials are pending**

- ✅ **Sprint 3.2** — Receipt + GL + reconciliation groundwork (2026-05-11). See detailed block above.
- ✅ **Sprint 3.4A** — Citizen payment UI + failure handling on stub rail (2026-05-11). See numbered item above.
- ✅ **Sprint 3.3A** — Deposits / refund approvals / challans (2026-05-11). See numbered item §2 above.

**Blocked / interrupt sprint**: Sprint 3.1B remains blocked on gateway sandbox credentials. When credentials arrive, pause the active sprint at a clean checkpoint and prioritize the real provider adapter, webhook signature verification, replay protection, and gateway status polling.

---

## Phase 4 — Grievances & SLA Engine

> "A grievance with no timeline is a grievance ignored."

### Programme status (2026-05-14 refresh)

**Sprints 4.1–4.2** are **closed**. **Sprint 4.3 — core MVP slice closed 2026-05-13** (citizen **re-open** + **SLA sweep queue escalation**). **Master Phase 4 backlog slice (locked queue #3) closed engineering 2026-05-14** — SLA breach **`notifications`** + citizen inbox API, **`/public/grievances/aggregate-metrics`**, structured attachment register + validated GPS **`location`**, **200-case routing regression** — see [`phase4-backlog-slice-exit.md`](./docs/runbooks/phase4-backlog-slice-exit.md); **native** breach push still future. Citizen **hub** UX continues under Hub **H4.x** ([Citizen Unified Hub programme](#citizen-unified-hub-programme-option-a)); interrupt track **Sprint 3.1B** unchanged when PSP credentials land.

### Goal

End-to-end grievance management: file → categorise → route to ward / department → track → escalate → resolve → rate → reopen if needed.

### Scope

- Grievance taxonomy (10 categories from prototype, sub-categories editable per tenant).
- Auto-routing rules: by category × ward × priority → role.
- SLA engine: hours-to-resolve per (category, priority); breach → escalation chain.
- Photo + GPS attachment.
- Anonymous submission (with optional later claim by citizen).
- Reopen flow (one-time within 7 days of resolution).
- Citizen-side rating + feedback.
- Staff-side action API (assign / comment / mark in-progress / resolve / close).

### Key Deliverables

1. **DB additions**:
   - `grievances`, `grievance_timeline`, `grievance_attachments`, `grievance_routing_rules`, `sla_policies`.
2. **Routing engine**: deterministic rule evaluation; tenant admin configurable in Phase 6.
3. **SLA engine**: hourly tick (BullMQ delayed job) — flags breaches, sends notifications, escalates.
4. **API endpoints**: full grievances set per `ARCHITECTURE.md` §5.
5. **Citizen UI**: Grievance tab → category → form → success → My Grievances → Grievance detail (matches prototype).
6. **Staff actions** (used later by Field Officer App in Phase 9 — but the API exists now).
7. **Public dashboard endpoint** (anonymised, aggregated) — feeds the open data API in Phase 12.

### Out of Scope

- Field Officer app UI (Phase 9).
- Tenant-admin routing-rule configurator (Phase 6).
- Predictive SLA breach (Phase 12).

### Dependencies

- Phase 1 (citizens), Phase 2 (timeline pattern reused).
- Phone-camera + GPS permissions on mobile app.

### Risks

- SLA breaches not visible enough → no behavioural change. _Mitigation_: proactive push + daily clerk dashboard.

### Exit Criteria

- Citizen can file → track → see SLA timer → rate, end-to-end.
- A breached SLA is visible to municipal staff (**escalating queue / timeline**) within the sweep horizon; citizen receives a **`sla_breach` inbox ping** keyed to grievance numbers only (**native FCM/APNs breach push** remains future **`notification-worker`** work).
- 80 % of seeded grievances auto-route without human intervention (**200-permutation deterministic bake-off**: `apps/api/src/modules/grievances/grievance-routing-bake-off.spec.ts`).

### Suggested Sprint Slice

- **Sprint 4.1**: DB + APIs + SLA engine.
- **Sprint 4.2**: Citizen UI + auto-routing.
- **Sprint 4.3**: ✅ Core — citizen **re-open** + **SLA sweep escalation** (2026-05-13). ✅ Backlog slice — notifications/public KPI/GPS/routing bake-off (**2026-05-14**). **Still open**: sub-minute native breach push (FCM), production-grade **`/public/*`** hardening beyond anonymised aggregates.

#### Sprint 4.1 — kickoff backlog _(implemented; see delivery note below)_

Foundation slice while PSP credentials remain unavailable. Outcome: tenant-safe persistence and server APIs so **Sprint 4.2** can add the citizen PWA surface without redesigning tables.

| Area           | Scope                                                                                                                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data model** | Prisma migration aligned to deliverable §1: `grievances`, `grievance_timeline`, `grievance_attachments` (or equivalent metadata keys to object storage), `grievance_routing_rules`, `sla_policies`; **RLS** parity with other tenant tables; reconcile naming with the illustrative DDL in `ARCHITECTURE.md` §3 where it differs. |
| **APIs**       | Citizen: file, list own, detail; staff: assign / comment / status transitions — follow **§5 grievance routes** in `ARCHITECTURE.md`. JWT tenant binding + ownership rules.                                                                                                                                                        |
| **Routing**    | Deterministic evaluation from seeded `grievance_routing_rules` (MVP ruleset); extensible for Phase 6 admin UI later.                                                                                                                                                                                                              |
| **SLA engine** | Persist SLA deadlines; breach detection via scheduled jobs (`services/notification-worker` / BullMQ when wired; otherwise a documented scheduler stub in API for local dev).                                                                                                                                                      |
| **Quality**    | Unit tests for lifecycle and routing; gated `RUN_DB_TESTS=1` integration against Postgres where applicable.                                                                                                                                                                                                                       |

**Explicitly out of 4.1:** tenant-admin routing editor (Phase 6); Field Officer app (Phase 9).

#### Sprint 4.1 — delivery note (closed 2026-05-11)

| Exit item (4.1 scope)                                                                             | Met |
| ------------------------------------------------------------------------------------------------- | --- |
| Prisma models + migration `20260512100000_grievances_sla` with RLS on grievance tables            | ✅  |
| Citizen + staff HTTP APIs under `/api/grievances/*` (see `ARCHITECTURE.md` §5)                    | ✅  |
| Seeded `sla_policies` + `grievance_routing_rules` via `pnpm db:seed`                              | ✅  |
| SLA deadline persistence + staff `POST .../staff/sweep-sla` breach pass                           | ✅  |
| Unit tests (`grievance-lifecycle.spec.ts`) + gated DB spec (`RUN_DB_TESTS=1`) + security contract | ✅  |

#### Sprint 4.2 — citizen PWA grievances (closed 2026-05-11)

MVP slice in `apps/citizen-pwa`: **Grievances** tab calling `/api/grievances` (list, create, detail by `grievance_no` or UUID). Includes category grid, priorities, optional location text, success confirmation, timeline, citizen comments, and **rating + close** after staff mark **resolved**.

| Exit item (4.2 scope)                                                                               | Met |
| --------------------------------------------------------------------------------------------------- | --- |
| Grievances tab + dashboard metric + translated strings (`packages/i18n` `grievance.*`, en/bn/hi)    | ✅  |
| `GET /citizen/profile` gate with inline `POST /citizen/register` (mobile prefilled after OTP login) | ✅  |
| `tests/security/grievance-sprint42-pwa.spec.ts`; `pnpm test:security` clean                         | ✅  |
| Phase-2 file-size discipline (`phase2-hardening.spec`): shared panels + `lib/workspace-*.ts`        | ✅  |

**Remaining after Sprint 4.3 backlog slice (engineering 2026-05-14)**: breach **native mobile push**, dedicated **field-officer** workflows, hardened **production Open Data `/public/*` policies** beyond today's aggregate counts.

#### Sprint 4.3 — delivery note (core slice closed 2026-05-13)

| Deliverable                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Citizen **re-open**            | `POST /api/grievances/:id/reopen` (optional `reason`) while `status=resolved`, within **7 days** of `resolved_at`; returns case to **`under_review`**, clears `resolved_at` / prior breach flags, recalculates **`sla_due_at`** from policy; timeline event **`reopen`**. Uses the same **`X-Enagar-Tenant-Code`** read-scope rules as hub/workspace detail reads. **`POST …/feedback`** now resolves ownership via the same **`getById`** path (**portal JWT–safe**). |
| ✅ **SLA sweep escalation** (MVP) | `POST /api/grievances/staff/sweep-sla` marks breach **and** bumps **`routed_role_code`** (`municipality_clerk` → **`municipality_admin`** → **`tenant_admin`** → **`state_admin`**) with **`assigned_to_user_id` cleared** so admin queues can pick up; adds **`sla_escalation`** timeline row (+ enriched **`sla_breach`** metadata).                                                                                                                                 |

**Explicit MVP vs charter gap (post–backlog slice)**: sub-minute breach **native push** (+ shared-device notification hygiene — see threat model), Field Officer workflows, hardened rate limits/WAF stance on **`/public/*`**.

**Manual E2E smoke (README) — deferred:** Full **Sprint 4.3** smoke (staff resolve/`PATCH` status, `POST …/staff/sweep-sla`, citizen re-open + feedback chain) stays **on hold** until **Keycloak staff/admin logins** and staff-gated APIs are configured end-to-end — target alignment with **Hub H5.1** (see [locked queue](#locked-next-10-sprint-queue-priority-execution-order)). Checklist remains in **`apps/citizen-pwa/README.md`** § **Manual smoke — Sprint 4.3**.

---

## Citizen Unified Hub programme (Option A)

> **Audience:** Engineering, architecture, PM, Keycloak/DevOps. **Apps:** Citizen PWA (`apps/citizen-pwa`), API (`apps/api`). **Merged:** Former standalone `docs/roadmap-citizen-unified-hub.md` — that file now redirects here.
>
> **Naming:** Hub work uses **`H`-prefixed** sprint IDs (**`H4.16`**, **`H5.1`**, …). Do **not** confuse **`H5.1`** (Keycloak staging) with **Master Phase 5 Sprint 5.1** (React Native shell) later in this document.

**Status:** Hub phases **H1–H4** largely delivered per sprint notes below; **Hub H6.1** engineering exit **closed 2026-05-14** ([checklist](./docs/runbooks/hub-h6-exit-checklist.md)). **Hub H5.1** staging / pilot deployment and formal Security–DevOps sign-off remain forward-looking unless reprioritised.

**Keycloak:** **Option A (chosen)** — tokens carry **portal** tenant claims and a **single stable `sub`** per citizen; ULB scope is header/body — not different logins per ULB.

**Pace convention:** Unless noted, assume **two-week** sprints.

### Hub programme — product and UX commitments

These decisions should be locked before coding.

1. **Two surfaces**
   - **Hub (common dashboard):** Aggregated read view across municipalities the citizen has interacted with — applications, payments, grievances — each row tagged with municipality identity (code, name, **`theme_color` / badge**).
   - **Municipality workspace:** Current behaviour preserved: catalogue, apply flow, and lists scoped to **one chosen ULB** at a time.

2. **Citizen identity**
   - Exactly **one stable principal identity** per person (Keycloak **`sub`**; in dev, a deterministic subject e.g. per mobile) — **not** different subjects per OTP `tenant_code`.
   - JWT may retain a **portal / default tenant** for claims or infrastructure; **citizen-visible data** must **not** be driven only by that claim when listing cross-ULB activity.

3. **Production identity (Keycloak) — Option A (locked)**

   Sponsor selected **Option A.** Target token shape:
   - **`sub`:** Stable per citizen (survives across ULBs; same person = same `sub` after OTP).
   - **`tenant_id` / `tenant_code`:** Always the **portal** ULB (`WBPORTAL` or equivalent), not the municipality — except where internal staff realms differ; citizen OIDC clients use portal tenant only for these claims.
   - **Roles:** Citizen role preserved; municipality is **never** inferred from JWT alone for data listing.

   Implementation detail for **Hub Phase H5**: Keycloak realm, **citizen-public** client, OTP/broker flow consistent with WB policy — plus **protocol mappers** issuing portal `tenant_id` / `tenant_code`. Separate artefact: mapper JSON + env vars for staging.

   Option B (`username = {tenant}:{mobile}` plus API mapping) is **out of scope** unless Sponsor reopens it.

### Hub programme — data model principles

4. **Logical vs physical citizen** — **Logical:** one citizen may apply across many ULBs. **Physical (Prisma):** `Citizen` remains **`@@unique([tenantId, keycloakSubject])`**; a **single global Citizen row** refactor is **out of initial scope**.

5. **Lazy ULB citizenship** — On first filing under ULB **X**, **ensure** a `Citizen` row for `(tenantId = X, keycloakSubject)`.

6. **Optional preference persistence** — **`selected_tenant_code`** (or preferences table) for last workspace UX.

7. **Portal tenant in catalogue** — Register **portal ULB** (e.g. `WBPORTAL`) in **`tenant.seed.ts`** + seed pipeline. **Business transactions** remain under **municipal** `tenant_id`s.

### Hub programme — API scoping contract

8. **`X-Enagar-Tenant-Code: {ULB}`** when the app is in **municipality workspace**; **omit** for hub aggregate reads.

9. **Writes** — Resolve exactly **one** target ULB from header/DTO; **reject** if missing when JWT is portal.

10. **Staff** — Ignore hub header for authz; tenant remains **JWT-bound** for staff routes.

### Hub programme — backend implementation sequence

Implement in this order to avoid partial broken states.

11. **Shared helpers** — Portal detection, citizen-only vs staff, parse `X-Enagar-Tenant-Code`, resolve ULB for writes.

12. **Auth service (dev path)** — Default OTP `tenant_code` → portal; stable `sub`; align refresh.

13. **Citizen persistence** — Resolve profile by subject (portal row preferred); `select-tenant` preference.

14. **Applications** — Hub vs workspace list/access; drafts/submits bind municipal `tenant_id`.

15. **Grievances** — Citizen list by subject + optional tenant filter; writes use row **`tenantId`** when JWT is portal.

16. **Payments** — List/get by subject; initiate uses **application’s** tenant for idempotency/gateway context.

17. **Holdings and documents** — Same ULB resolution as applications.

18. **Optional hub bundle** — `GET /citizen/dashboard` with `tenant_code` + `theme_color`.

### Hub programme — frontend (Citizen PWA)

19. **OTP** — Portal `tenant_code` on send/verify.

20. **Navigation** — Hub landing → municipality → `select-tenant` → workspace; **Back to hub** clears scope.

21. **HTTP wrapper** — Bearer + **`X-Enagar-Tenant-Code`** only in workspace.

22. **Grievances UI** — Pass **scope** (`tenant_code` or null) into client.

### Hub programme — verification, rollout, documentation

23. **Tests** — Portal JWT cross-ULB list; payment idempotency with JWT tenant ≠ application tenant; staff unchanged.

24. **Migrations and seed** — Portal row; preferences; `pnpm db:migrate` + `pnpm db:seed`.

25. **Documentation** — Hub vs workspace, header contract, Keycloak Option A checklist.

### Hub programme — execution checklist

Rough order remains: catalogue + auth parity → hub reads → municipality writes → PWA → Keycloak staging → hardening. Detailed sprints follow.

### Hub programme — explicit non-goals (initial slice)

- Merging every municipal `Citizen` row into one global row without a phased migration strategy.
- Cross-tenant **staff** “super dashboard” without separate RBAC design.
- Changing translation keys unless copy is reviewed with i18n owners.

---

### Hub Phase H1 — Platform identity & data foundation

**Program goal:** Introduce portal ULB in data + code, align **dev** JWT with Option A shape, and add shared scoping utilities.

#### Sprint H1.1 — Catalogue, schema, seed

| Item              | Detail                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Add `WBPORTAL` (or final portal code) to `tenant.seed.ts`; Prisma migration if adding `citizens.selected_tenant_code` (or `citizen_preferences` table); `pnpm db:seed` idempotent for portal row; skip or no-op ULB-only artefacts for portal if product wants zero grievance routing noise (document choice). |
| **Tests**         | Migration applies on clean DB; seed upsert test or script smoke; existing API test suite still green.                                                                                                                                                                                                          |
| **Exit criteria** | CI passes; fresh `migrate + seed` creates portal tenant; no regression on existing tenant rows.                                                                                                                                                                                                                |

**Status: done (2026-05-11).** Portal `WBPORTAL` in `apps/api/src/modules/tenants/tenant.seed.ts` (`CITIZEN_PORTAL_TENANT_CODE`); migration `apps/api/prisma/migrations/20260514100000_citizen_selected_tenant_code/`; seed skips grievance SLA/routing for portal; `TenantsService.list()` excludes WBPORTAL; `apps/api/README.md` documents behaviour.

#### Sprint H1.2 — Dev auth, helpers, citizen profile resolution

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Dev OTP/verify: default `tenant_code` → portal; JWT `sub` stable per mobile (e.g. `dev-citizen-{mobile}`); claims `tenant_id` / `tenant_code` = portal; fix dev **refresh** to stop hard-coding unrelated mobile/tenant (or document limitation). Add **`citizen-portal` helpers**: `isPortalPrincipal`, `parseTenantScopeHeader`, `resolveTargetUlbForWrite`, `isCitizenOnly`. Postgres `CitizenStore`: `findByPrincipal` prefers portal row by `keycloakSubject`, else fallback row; `save` / `select-tenant` persist `selected_tenant_code` if column exists. |
| **Tests**         | Unit tests for helpers; citizen store spec: same `sub`, two tenant rows — correct read preference; auth integration: two verifies same mobile → same `sub` in decoded dev JWT.                                                                                                                                                                                                                                                                                                                                                                                   |
| **Exit criteria** | Dev login flow issues Option-A-shaped token; profile API returns consistent fields for portal user; staff principals unchanged by helpers.                                                                                                                                                                                                                                                                                                                                                                                                                       |

**Status: done (2026-05-11).** `AuthService`: dev verify/refresh issue **WBPORTAL** claims and `sub` = `dev-citizen-{mobile}`; optional `tenant_code` on OTP DTO; dev refresh token embeds mobile (`dev-refresh-{mobile}-{uuid}`); **`refresh` is async** so legacy `dev-refresh-{uuid-only}` and other parse failures reject as `UnauthorizedException`. Helpers in `src/common/auth/citizen-scope.ts`. `PostgresCitizenStore` prefers portal composite row, then latest by subject; persists `selectedTenantCode`. Tests: `auth.service.spec`, `citizen-scope.spec`, updated `postgres-citizen.store.spec`.

---

### Hub Phase H2 — Hub read APIs (aggregated citizen view)

**Program goal:** Citizens list **their** data across ULBs when **no** `X-Enagar-Tenant-Code` is sent; with header, lists match **one** ULB.

#### Sprint H2.1 — Applications + holdings/documents read scope

| Item              | Detail                                                                                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `ApplicationsController` passes optional header into service; `list`, `getByDocketNo`, `getOwnedApplication`, `canAccess` implement hub vs workspace rules. **Holdings** + **documents** routes resolve ULB from header for citizen; staff ignore header. |
| **Tests**         | Portal principal, apps in two ULBs — list all without header; list one with header; staff list still JWT-tenant only.                                                                                                                                     |
| **Exit criteria** | No 404 for legit cross-ULB docket when unscoped; scoped requests hide other ULB apps.                                                                                                                                                                     |

**Status: done (2026-05-11).** `ApplicationReadScope` + `X-Enagar-Tenant-Code` on `applications` and `documents` controllers; `ApplicationsService` hub vs municipal JWT paths; `HoldingsService`, `DocumentsService` aligned. Tests: `applications.service.spec`, `holdings.service.spec`, Phase 2 integration.

#### Sprint H2.2 — Payments + grievances read scope + dashboard

| Item              | Detail                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Payments list/get/receipt: citizen by `citizen_subject`, optional tenant filter via header; portal JWT ownership when subject matches. Grievances citizen list/detail by subject (+ optional `tenantId`). **`GET /citizen/dashboard`** with grouped payloads + `tenant_code` + `theme_color`. |
| **Tests**         | Payment store/service: two tenants, same subject — unscoped vs scoped lists; grievances cross-tenant list; dashboard smoke if implemented.                                                                                                                                                    |
| **Exit criteria** | Hub populated from API without client-side merging hacks; staff grievance list still tenant-scoped.                                                                                                                                                                                           |

**Status: done (2026-05-11).** Payments + grievances hub paths; **`GET /api/citizen/dashboard`**; **CORS:** `x-enagar-tenant-code`. Tests: `citizen-scope.spec`, `payments.service.spec`.

---

### Hub Phase H3 — Municipality write APIs (ULB-scoped creates & payment integrity)

**Program goal:** Every create/settlement path binds to an explicit ULB when JWT tenant is portal.

#### Sprint H3.1 — Applications write path + ULB citizen ensure

| Item              | Detail                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `createDraft` / `create` / `submitDraft`: resolve target ULB from header/DTO; **`submitDraft`** uses **application’s** `tenant_code` for workflow; **ensureCitizen(ulb)** when needed. Documents/holdings writes aligned with resolved ULB. |
| **Tests**         | Integration: portal JWT + header KMC → draft has KMC `tenant_id`; submit uses KMC workflow; without ULB resolution → 400.                                                                                                                   |
| **Exit criteria** | No application row left on portal `tenant_id` by mistake; citizen row exists for target ULB when required by schema.                                                                                                                        |

**Status: done (2026-05-11).** `resolveCitizenMunicipalityForWrite`, **`ensureMunicipalCitizenRow`**, **`DocumentsService`** municipal paths for portal citizens. Tests: `applications.service.spec`, `documents.service.spec`, **`payment-portal.http.integration.spec`**.

#### Sprint H3.2 — Payments initiate + stub complete + grievances writes

| Item              | Detail                                                                                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | **initiate:** idempotency scoped to **application’s `tenant_id`**; gateway `tenantId` = application’s. **Stub complete:** portal citizen ownership without strict `payment.tenantId === principal.tenantId`. **Grievances create/comments:** municipal `tenantId`; timeline uses row’s tenant. |
| **Tests**         | Idempotency replay with portal JWT; stub complete; grievance create in two ULBs; isolation on timeline writes.                                                                                                                                                                                 |
| **Exit criteria** | Finance/grievance reviewers sign off on demo script (initiate → stub settle → receipt read) with portal token.                                                                                                                                                                                 |

**Status: done (2026-05-11) — payments slice.** `PaymentsService` initiate/complete from application ULB; **`findIdempotencyRecord`** tenant override; Postgres + in-memory stores. Grievances writes aligned with Phase 4 Master grievance APIs.

**Hub Phase H3 — closed (2026-05-11).** Municipal-bound writes + portal-safe payments verified in automation above.

---

### Hub Phase H4 — Citizen PWA (hub UX + workspace parity)

**Program goal:** After OTP, user reaches **hub** with onboarding pins (**`Sprint H4.16`**); entering a municipality attaches header on API calls; **Back to hub** clears scope.

#### Sprint H4.1 — Navigation + HTTP layer + hub data

| Item              | Detail                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | OTP uses portal `tenant_code`; **hub** step with dashboard; municipality card → theme + `select-tenant` + workspace; **request helper** adds `X-Enagar-Tenant-Code` only in workspace. |
| **Tests**         | PWA manual smoke / typecheck / build documented.                                                                                                                                       |
| **Exit criteria** | Demo: login → multi-ULB rows → open one ULB → scoped workspace → back to hub → aggregates again.                                                                                       |

**Status: done (2026-05-11).** **`@enagar/citizen-pwa`:** `tenant_code: WBPORTAL`; **`GET /citizen/dashboard`** without scope header; **`authHeaders(…, tenantScopeCode)`** in workspace. **`apps/citizen-pwa/README.md`** § Sprint 4.1 (historical smoke label — maps to **H4.1**).

#### Sprint H4.15 — Citizen hub KPI strip & tab dashboard

| Item              | Detail                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | Hub **five KPI-style cards**; Language PATCH after OTP; services union; apps/payments/grievances from dashboard buckets; **pill tab rail**; aggregate reads omit scope header until row-level actions need it. |
| **Tests**         | Manual smoke README § 4.15; typecheck / build.                                                                                                                                                                 |
| **Exit criteria** | Sponsor can use KPIs → aggregated lists across ULBs without entering a municipality first (apply still via workspace picker).                                                                                  |

**Status: done (2026-05-12).** Shared tab strip; **`refreshHubData`**; **`PATCH /citizen/language`**. README § Sprint 4.15 ↔ **H4.15**.

#### Sprint H4.16 — Hub at scale: mandatory onboarding pins + favourites (≤15 ULBs)

**Locked product decisions — confirmed 2026-05-12**

1. **Onboarding:** **≥1 municipality required** — cannot skip with zero pinned ULBs.
2. **Pinned ULBs:** **≤15**, ordered server-side favourites.
3. **`selected_tenant_code`:** **Separate** from pins — **`POST /citizen/select-tenant`** only; **no auto-sync** into pins.
4. **Pinned services:** Workspace **Services** tab filtered to favourites (Apply not pre-loaded).
5. **Hub KPIs:** **Across all ULBs**; **no** pinned-scope KPI toggle in **H4.16**.
6. **Municipality search:** Match **`tenant.code`**, **`tenant.name`**, **`district`** from **`GET /tenants`**. Multilingual ULB search **out of scope** for **H4.16**.
7. **Pins ≠ access control:** Browse/search reaches **any** operational municipality and service.

| Item              | Detail                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | **`pinned_tenant_codes[]`**, **`pinned_services[]`**; **`GET`/`PATCH /citizen/preferences`**; PWA onboarding gate + pinned row + browse drawer + lazy **`/services/tenants/:code`**; **`distinct_active_service_codes`** on dashboard for Services KPI. |
| **Tests**         | Unit/API cap 15, duplicates, WBPORTAL, stale codes; README § 4.16; PWA typecheck + build.                                                                                                                                                               |
| **Exit criteria** | Cannot bypass onboarding without ≥1 pin (UI + PATCH guard); many ULBs via search; whole-portfolio KPIs; every municipality/service reachable without pinning.                                                                                           |

**Status: done (2026-05-12).** Migration `20260515103000_citizen_pin_preferences`; preferences API + PWA pin gate + Shortcuts tab. README § Sprint 4.16 ↔ **H4.16**.

#### Sprint H4.2 — Grievances UI scope + regression pass

| Item              | Detail                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | `GrievancesWorkspace` + hub paths: scope matches Hub Phases **H2–H3**; hub detail derives header from grievance **`tenant_id`**; regression on applications/payments tabs. |
| **Tests**         | `pnpm --filter @enagar/citizen-pwa run test` (`lib/grievance-scope.ts`).                                                                                                   |
| **Exit criteria** | Workspace calls send tenant header when required; hub aggregates omit header; no accidental hub refresh loops.                                                             |

**Status: done (2026-05-12).** **`hubMunicipalityCatalogue`**, **`onGrievancesMutated`** post-mutation only, banner errors. README § Sprint 4.2 ↔ **H4.2** (scope UX layered on Master Phase **4** grievance APIs).

---

### Hub Phase H5 — Keycloak Option A (non-dev environments)

**Program goal:** Staging/prod realms issue the same semantic claims as dev (portal tenant + stable `sub`).

**Queue position:** In the [recommended rolling-wave order](#recommended-rolling-wave-order), Hub **H5.1** is row **F** — the **next Hub-programme sprint** after **H4.x** when you prioritise the **unified-hub identity** track. It does **not** imply a calendar week: sequencing is **priority-based** and can slip behind Master items (e.g. row **G** Phase 4 backlog) or interrupt **B** (payment **3.1B**) when credentials land.

#### Sprint H5.1 — Realm, client, mappers, verifier alignment + admin/staff users

| Item              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | **Citizen (Option A):** Keycloak realm doc: citizen client ID, OTP/broker wiring, protocol mappers for `tenant_id` / `tenant_code` (portal), role claims; JWKS/issuer env on API updated per env; **remove or bypass** `tenant:mobile` username pattern for citizen OTP if still present; deployment checklist. **Operators (new):** Bootstrap **initial admin/staff users** on staging (pattern for prod): at least one **tenant-scoped** staff account per pilot ULB used in E2E (e.g. `tenant_admin`, `tenant_clerk` from `infrastructure/keycloak/realm-export.json`, with user attributes **`tenant_id`** / **`tenant_code`** matching that ULB’s seed UUID/code) and MFA enrolment where realm policy requires it (`tenant_admin`, `state_admin`). **Grievance API alignment:** Add **`municipality_clerk`** / **`municipality_admin`** realm roles **or** Keycloak role **composite / hard-role** mapping so JWT **`role`** claims match `GRIEVANCE_STAFF_ROLES` (today’s export uses `tenant_clerk`, not `municipality_*`). Document which clients issue staff tokens (`admin-tenant`, `staff-mobile`, etc.). Prefer **IaC** (Terraform / `kcadm` / realm partial import) or a repeatable **runbook script** rather than one-off Admin Console clicks. |
| **Tests**         | Staging smoke: citizen OTP → JWT decode (existing). **New:** password/OIDC login (per client) for **≥1 tenant admin** and **≥1 clerk**; decode token and assert `tenant_id`, `tenant_code`, `role`, MFA claims for admin roles; call at least one **staff-gated** API (e.g. `PATCH /api/grievances/:id/status` or `POST …/sweep-sla`) with **200** against a known grievance tenant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Exit criteria** | Security/DevOps sign-off on mapper set; ADR appendix or runbook merged; **named list of bootstrap users** (service accounts vs humans redacted) and **rotation** expectation; **role-name parity** documented between Keycloak realm roles and API `GRIEVANCE_STAFF_ROLES` / admin portals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Repo / engineering status (engineering slice closed in-repo):** **Runbook** — [`docs/runbooks/keycloak.md`](docs/runbooks/keycloak.md). Realm export extends **`municipality_clerk` / `municipality_admin`**; API accepts **`tenant_clerk`** alongside **`municipality_*`** ([`grievance-staff-roles.ts`](apps/api/src/modules/grievances/grievance-staff-roles.ts)). **`resolveEnagarTenantFromJwtPayload`** normalises **`tenant_id`/`tenant_code`** vs **`tenantId`/`tenantCode`** (reject mismatches). ADR-0009 references updated.

**Outside the repo:** live staging realm import + formal **Security/DevOps sign-off** + pilot-only **bootstrap user ledger** / rotation expectation.

---

### Hub Phase H6 — Hardening & Hub programme exit

#### Sprint H6.1 — Docs, observability spot-check, backlog triage

| Item              | Detail                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deliverables**  | README/ADR excerpt; troubleshooting (missing header on write); structured log fields if useful; performance smoke on dashboard query (N+1 avoided or documented). |
| **Tests**         | Full CI green; optional k6 or manual “100 hub loads” if risk flagged.                                                                                             |
| **Exit criteria** | Product owner accepts exit demo + written checklist; remaining items moved to backlog with IDs.                                                                   |

**Closure (engineering):** **2026-05-14** — [`hub-h6-exit-checklist.md`](docs/runbooks/hub-h6-exit-checklist.md) marked **Status: closed — engineering (repo)** with full CI green; PO column left optional.

**Engineering artefacts (started / maintained under H6.1):** [`docs/runbooks/citizen-unified-hub.md`](docs/runbooks/citizen-unified-hub.md) · [`docs/runbooks/hub-h6-exit-checklist.md`](docs/runbooks/hub-h6-exit-checklist.md) · [`CitizenHubDashboardService`](apps/api/src/modules/citizen/citizen-hub-dashboard.service.ts) (**`citizen_hub_dashboard`** structured logs) · **`apps/api`** unit **`citizen-hub-dashboard.service.spec.ts`**.

---

### Hub programme — assumptions and follow-ups

- **Option A** assumes Keycloak can issue portal **`tenant_*`** claims for all citizen OTP logins without per-ULB Keycloak users.
- **Mobile uniqueness** enforced as today; shared-mobile multi-person out of scope.
- If **grievance SLA seed** for portal tenant is noisy, **skip** portal in SLA seed loop (record in Hub **H1** exit notes).

**Issuer mapper guidance (resolved in `@enagar/api`, Hub H5.1):** Keycloak SHOULD emit **`tenant_id` / `tenant_code`** snake_case claims (ADR-0009). The verifier also accepts **`tenantId` / `tenantCode`** if supplied **instead of** snake_case — **never with conflicting duplicates** (401). Issuers migrating from ageing conventions (e.g. **`tenant:{mobile}` usernames**) should pivot to **`sub-username`** + portal tenant mappers (see [`docs/runbooks/keycloak.md`](docs/runbooks/keycloak.md)).

---

## Phase 5 — Citizen Mobile + PWA Polish

> "Make the prototype real, on both surfaces."

### Goal

Two production-quality citizen surfaces — React Native (Expo) and Next.js PWA — that share `packages/forms`, `packages/sdk`, `packages/i18n`, and `packages/ui*`. Feature parity with the prototype + offline drafts + push notifications + deep links.

### Scope

- RN app: build for Android first (target API 30+), then iOS.
- PWA: installable, standalone display, service worker, offline shell.
- Push notifications: FCM (Android), APNs (iOS), Web Push (PWA).
- Deep links: docket numbers, payment results, notifications.
- Offline form drafts via local SQLite (RN) / IndexedDB (PWA), background sync on reconnect.
- Notification centre, mark-all-read, type filters (matches prototype).
- Profile screen, language switcher, change-municipality, logout.
- Accessibility audit (axe-core PWA, RN built-in checks).
- Performance: First Contentful Paint < 2 s on a Moto G7 over 4G.

### Key Deliverables

1. RN app on Play Internal track + iOS TestFlight.
2. PWA at `https://app.enagarseba.wb.gov.in` (or pilot subdomain).
3. Notification worker (`services/notification-worker`): FCM + APNs + Web Push + SMS + email + WhatsApp stub.
4. Offline form draft engine in `packages/forms` (storage-agnostic).
5. Performance budget enforced in CI (Lighthouse PWA score ≥ 90 on every PR).
6. Accessibility report (axe-core baseline saved).
7. App store / Play Store metadata, screenshots, privacy declaration.

### Out of Scope

- Sahayak AI chatbot beyond a "Coming Soon" tile (Phase 7).
- Field officer roles (Phase 9).
- Real Aadhaar e-KYC (Phase 11 readiness).

### Dependencies

- Phases 2–4 backend complete.
- FCM project, APNs cert, Web Push VAPID keys provisioned.

### Risks

- App store review delays. _Mitigation_: start TestFlight + Play Internal ASAP; production review window planned for Phase 10.
- iOS PassKey / OTP autofill quirks. _Mitigation_: dedicated 2-day spike.

### Exit Criteria

- Pilot user can: install app → log in → switch tenant → apply → pay → track → file grievance → receive push on status change. Offline.
- Lighthouse PWA score ≥ 90.
- Average API call < 500 ms over 4G.

### Suggested Sprint Slice

- **Sprint 5.1**: RN app shell + screen porting (Splash → Tenant select → Home).
- **Sprint 5.2**: RN apply / payments / grievance flows + offline drafts.
- **Sprint 5.3**: PWA equivalent (sharing screens via `packages/forms` + `packages/ui`).
- **Sprint 5.4**: Push, deep links, accessibility, perf, store metadata.

---

## Phase 6 — Admin Portals (State + Tenant)

> "Where the plug-and-play promise gets real."

### Goal

Two Next.js portals that let admins configure everything _without_ talking to engineers. Tenant Admin = the day-to-day driver. State Super-Admin = the platform operator.

### Scope

**Tenant Admin Portal** (`apps/admin-tenant`):

- Dashboard: live KPIs, SLA compliance, revenue, open grievances heatmap.
- Service catalogue: inherit / override / disable / add. Inline form-schema builder (drag-drop, preview-on-phone-frame).
- Workflow / stage designer: visual state-machine editor, role assignments, SLA per stage, escalation rules.
- Fee-rule engine: flat / slab / zone / time-of-day / property-attribute (built-up area, ARV).
- Document checklist editor.
- Bookable assets manager + calendar (halls, auditoria, parks, equipment, blackout dates).
- Tax / tariff master (property, water, conservancy, sewerage).
- Address master (wards → boroughs → mouzas → localities) — bulk CSV import.
- Revenue head & GL mapping.
- Notification template editor (push / SMS / email / WhatsApp; en / bn / hi; with variable preview).
- Knowledge-Base CMS (Markdown WYSIWYG + .docx upload + auto-convert; tags; publish / unpublish; auto-trigger RAG re-index).
- Staff & roles: invite, assign role, map roles to workflow stages.
- Branding: theme colour, logo, hero imagery, languages enabled.
- Feature flags.
- Maintenance / banners.
- Reports: SLA, revenue, top services, grievance heatmap — CSV / PDF export.

**State Super-Admin Portal** (`apps/admin-state`):

- Tenant onboarding wizard (zero-code: name, code, district, wards, theme, languages, gateways, default services to inherit → activate).
- Tenant directory + drill-down.
- Global Service Library curator.
- State-wide KPI dashboards.
- Audit log search across tenants.
- Tenant impersonation (logged) for support.
- State-level integration management (DigiLocker, Aadhaar, master payment partners, SMS DLT).
- Cross-tenant analytics + leaderboards (publishable as transparency reports).

### Key Deliverables

1. Two production portals, both behind Keycloak with MFA.
2. **Form-Schema Builder** (`packages/forms` extended): drag-drop palette → JSON-Schema → live preview on phone-frame component (the same one in `index.html`).
3. **Workflow Designer**: visual state-machine editor (React Flow or X6) → JSON → executed by Phase 2 engine.
4. **Fee-Rule Engine**: declarative rules editor → safe expression evaluator (no `eval`).
5. **KB CMS**: in-portal Markdown editor + `.docx` upload + Mammoth conversion + tag taxonomy + publish.
6. **Tenant impersonation**: state-admin generates a short-lived JWT scoped to one tenant; every request audited.
7. **Reports**: PDF (Playwright-rendered) + CSV per tenant; downloadable.

### Out of Scope

- AI / chatbot (Phase 7).
- Predictive analytics (Phase 12).

### Dependencies

- Phases 2–5 complete.
- Form-renderer in `packages/forms` mature enough that the builder can preview against it without divergence.

### Risks

- Form-schema builder UX is famously hard. _Mitigation_: borrow from established libraries (FormKit, RJSF, FormIO) for v1; build custom only what we must.
- Workflow designer scope creep. _Mitigation_: lock v1 to linear-stage-with-branch; defer complex parallelism to v2.

### Exit Criteria

- A tenant admin can, with zero engineering involvement: add a brand-new service, design its form, define its 4-stage workflow, assign it to staff roles, set a fee, set an SLA, publish KB articles for it — and a citizen sees it in the app within 5 minutes.
- A state admin can onboard a 9th municipality entirely through the wizard.
- All admin actions are in the audit log.

### Suggested Sprint Slice

- **Sprint 6.1**: Tenant Admin Portal shell, dashboard, service catalogue list/edit.
- **Sprint 6.2**: Form-Schema Builder + Workflow Designer.
- **Sprint 6.3**: Fee-rule engine, document checklists, tax/tariff master, address master, revenue heads.
- **Sprint 6.4**: Notification templates, KB CMS, branding, feature flags, staff & roles.
- **Sprint 6.5**: State Super-Admin Portal + tenant onboarding wizard + impersonation + cross-tenant analytics.

### Parallelism

- Two engineers can split: one on form/workflow builders, one on configuration CRUD. Mid-phase merge.

---

## Phase 7 — Sahayak AI (RAG + KB Indexing + LLM Adapter)

> "Citizens type 'how to apply for water connection in bengali' — they get the right answer, in their tenant's words."

### Goal

Production-grade RAG chatbot grounded in each tenant's actual KB + the citizen's own application context. Inference via the `ILLMProvider` adapter (per [ADR-0008](./docs/ADRs/ADR-0008-llm-provider-adapter.md)) — OpenAI / Gemini in production, Ollama as optional fallback. PII redacted before egress. Streaming responses. Multilingual (en / bn / hi).

### Scope

- `services/rag-indexer` (Python): nightly + on-demand indexer.
  - Loaders: Markdown, PDF (pdfplumber), DOCX (Mammoth → Markdown), HTML, plain text, **services table snapshot**.
  - Chunking: ~500 tokens, 50 overlap.
  - Embeddings: `paraphrase-multilingual-MiniLM-L12-v2` — runs **on-prem** (CPU); embeddings never leave the platform.
  - Qdrant: collection per tenant (`kb_kmc`, `kb_hmc` …) — **on-prem**.
- **`packages/types`** + **`apps/api/src/modules/chatbot`**: `ILLMProvider` interface and three concrete implementations (`OpenAIProvider`, `GeminiProvider`, `OllamaProvider`), each conforming to the same streaming contract.
- **`apps/api/src/modules/chatbot/redaction.ts`**: mandatory PII-redaction layer (mobile, Aadhaar last-4, holding number, docket, citizen name, address) with reverse-substitution map kept server-side only.
- **`apps/api/src/modules/chatbot/audit.ts`**: per-call audit record (provider, model, tokens, latency, redaction count, query hash) — raw query text never logged.
- Query pipeline: detect lang → embed → Qdrant top-K with `tenant_id` filter → BM25 rerank → augment with citizen context → **redact** → `ILLMProvider.stream()` → de-redact → SSE stream to client.
- Hard guardrails:
  - Reply **only** in user's language.
  - Cite sources (KB article slugs).
  - Refuse out-of-scope.
  - Never invent fees / SLAs (numeric fact-check against services table).
  - Sanitise prompt-injection attempts.
- Per-tenant `tenants.config.chatbot` settings: provider override, model override, monthly token budget, DPA-signed flag (runtime guard).
- Per-tenant cost telemetry: `llm_tokens_total{tenant,provider,direction}` Prometheus counter; daily aggregation; 80 %-of-budget alert.
- Per-response thumbs-up / thumbs-down feedback → reviewer queue.
- Session history (per citizen, 30-day retention).
- Citizen-facing **consent screen** on first chatbot session: "Your queries are processed by OpenAI / Google after PII redaction. You may opt out and use KB-search-only mode."
- Mobile + PWA chatbot UI (matches prototype's gradient-bubble style).

### Key Deliverables

1. RAG indexer service (Python, FastAPI for on-demand triggers + cron for nightly).
2. Qdrant collections per tenant (on-prem).
3. `ILLMProvider` interface + `OpenAIProvider` + `GeminiProvider` + `OllamaProvider` implementations, conformance-tested against a shared suite.
4. PII-redaction layer with adversarial test fixtures (≥ 25 cases).
5. Chatbot NestJS module with SSE streaming + audit + cost telemetry.
6. System prompt template per `ARCHITECTURE.md` §4.
7. Mobile + PWA chat UI with consent screen, suggestions, voice-input placeholder, image-attach placeholder.
8. Feedback loop: thumbs ↔ analytics dashboard.
9. Per-tenant cost dashboard panel in State Super-Admin.
10. Provider-failover behaviour: if active provider returns 5xx three times in 60 s, automatically fail over to the configured secondary and alert.
11. Cost / latency benchmark with realistic 50-tenant-day fixture; document P50 / P95 first-token and end-to-end times for each provider.

### Out of Scope

- Voice input (Phase 12).
- WhatsApp channel (Phase 12).
- Fine-tuning models (Phase 12+).
- Anthropic / Claude provider (deferred — adapter accommodates trivially).

### Dependencies

- Phases 1, 2, 4 (citizen, applications, grievances exist for context augmentation).
- Phase 6 KB CMS (so tenant admins can publish KB articles).
- **Phase 0 follow-up**: Data Processing Agreements (DPAs) signed with OpenAI and Google before pilot.
- **Phase 0 follow-up**: privacy-policy disclosure of cross-border processing.

### Risks

- Hallucinated fees / timelines. _Mitigation_: strict prompt + automatic post-response numeric fact-check against the services table.
- Prompt injection. _Mitigation_: input sanitiser + system-prompt isolation + adversarial test suite.
- Provider outage / pricing change. _Mitigation_: adapter pattern allows hot-swap; secondary provider configured per tenant; cost telemetry + budget caps.
- DPA non-compliance discovered late. _Mitigation_: runtime guard refuses to call any provider without `dpa_signed = true` in tenant config.
- PII leak via redaction bypass. _Mitigation_: dedicated adversarial test fixtures; quarterly third-party review.

### Exit Criteria

- Bengali query "আমি কীভাবে জন্ম সার্টিফিকেট পাবো?" gets a correct, cited, in-language answer in < 3 s end-to-end (P95).
- Adversarial prompt-injection test suite passes 100 %.
- Adversarial PII-redaction fixture suite (25+ cases) passes 100 %.
- Citizen with an in-flight Birth Cert application sees personalised response: "Your application WBM/KMC/BC/2026/00342 is currently in Document Verification."
- Cost dashboard correctly attributes ₹ to tenant + provider; budget alert fires at 80 %.
- Provider failover validated under chaos test (kill primary, verify secondary takes over within 5 s).

### Suggested Sprint Slice

- **Sprint 7.1**: RAG indexer + Qdrant + embedding benchmark.
- **Sprint 7.2**: `ILLMProvider` interface + OpenAI / Gemini / Ollama implementations + PII redaction + audit.
- **Sprint 7.3**: Chatbot service + streaming + guardrails + failover + cost telemetry.
- **Sprint 7.4**: Mobile + PWA UI + consent screen + feedback loop + adversarial testing.

---

## Phase 8 — Bookings, Smart-City & Tender Modules

> "The long tail of revenue heads — designed to land _after_ the core is stable."

### Goal

Productionise the specialty modules already modelled in `ARCHITECTURE.md` §10: bookable assets with calendar, smart-city pricing hooks, tenders with EMD/security deposit lifecycle.

### Scope

- **Bookings**: hall, auditorium, park, ground, equipment.
  - Calendar UI (citizen + admin).
  - GiST exclusion-constraint anti-double-booking (already in arch).
  - Deposit + cancellation policy + booking confirmation PDF.
- **Smart-City Services**:
  - Smart Parking: zone × time-of-day pricing, sensor stub adapter, reserve-and-pay flow.
  - EV Charging: per-kWh metering, slot reservation.
  - IoT Smart Water Meter: prepaid recharge UI.
  - Smart Waste Bin Subscription.
  - GIS data licensing portal.
  - Rooftop solar / telecom NOC application flow (uses generic application engine).
- **Tenders & Deposits** (citizen-facing):
  - Tender list + form purchase + EMD payment.
  - Vendor / contractor empanelment.
  - Refund-of-deposit application.
- **Advertisement & Media**: hoarding tax calculator (ward × size × duration), digital billboard application, LED slot booking calendar.
- **Welfare**: pension applications + monthly disbursement-status view.
- **Health**: ambulance / hearse / crematorium booking (booking engine reused).

### Key Deliverables

1. **Pricing-Rule Engine** (extended from Phase 6 fee engine): zone, time, vehicle, kWh, hoarding-rate matrix.
2. **Booking calendar UI** (citizen + tenant admin).
3. **Smart-Parking adapter**: stub of Modbus/MQTT sensor source — plug-in for real telemetry in pilot.
4. **Tenders module**: list + EMD + vendor registration.
5. **Hoarding-rate calculator** (UI + API).
6. **Welfare disbursement status** (read-only, monthly Excel import in v1; integrated with PFMS in v2).

### Out of Scope

- Real IoT integration (relies on hardware procurement; covered in Phase 12 pilot).
- Auction engine for scrap sale (manual bid recording in v1; full engine v2).
- e-Tender e-procurement (out of scope; integrate with state e-tender portal via deep link).

### Dependencies

- Phase 2 (workflow / forms).
- Phase 3 (payments / deposits).
- Phase 6 (fee-rule engine).

### Risks

- Calendar UX complexity. _Mitigation_: borrow from FullCalendar / React Big Calendar for v1.
- Pricing-rule engine becoming a DSL. _Mitigation_: cap expressions to whitelisted operators; no Turing-complete logic.

### Exit Criteria

- Citizen can book a community hall on a specific date, pay, get confirmation PDF; admin sees the booking on their calendar; the slot is unbookable for anyone else.
- Smart parking flow works end-to-end with the stub sensor.
- A tender list page renders 5 active tenders; user buys form + pays EMD.

### Suggested Sprint Slice

- **Sprint 8.1**: Bookings calendar + booking flow + deposit linkage.
- **Sprint 8.2**: Smart-Parking + EV-Charging + IoT-Water-Meter (stubbed adapters).
- **Sprint 8.3**: Tenders + Vendor empanelment + Advertisement / Hoarding.
- **Sprint 8.4**: Welfare + Health bookings + hardening.

---

## Phase 9 — Field Officer / Enforcement App

> "The clerk's view, but in the field, on a phone."

### Goal

A scoped Expo app for inspectors, sanitation officers, enforcement staff, and registrars to do their bit of the workflow on the move. Same JWT realm, different role, different navigation.

### Scope

- Login as staff (Keycloak, MFA).
- Role-aware home: "My queue" of applications / grievances assigned to me.
- Application detail with available actions: comment, mark in-progress, request more info, recommend approval, approve / reject.
- Grievance detail with: assign / mark in progress / resolve + photo evidence + GPS pin.
- **Challan issue** flow:
  - Pick violation type (revenue head category).
  - Capture photo + GPS automatically.
  - Enter offender name / mobile (citizen may not be registered).
  - Generate challan number, send SMS to mobile.
  - Bluetooth thermal-printer support for paper challan (optional).
- Offline mode: queue actions when no network, sync on reconnect.
- Geofencing: officer's actions logged with GPS for audit.

### Key Deliverables

1. `apps/staff-mobile` Expo app on Play Internal.
2. Role-scoped JWT (e.g. only sees grievances in their ward).
3. Challan-issue flow integrated with `challans` table from Phase 3.
4. Offline action queue (SQLite + background sync).
5. Bluetooth printer adapter (optional, library evaluation in this phase).
6. Pilot training pack (PDF + 2 short videos) for inspectors.

### Out of Scope

- Tenant admin UI changes (already handled in Phase 6).
- Multi-language support beyond Bengali + English (Hindi optional).

### Dependencies

- Phases 1, 2, 3, 4 — all action APIs exist.

### Risks

- Inspector device fragmentation. _Mitigation_: target Android 9+ baseline.
- Offline conflict resolution. _Mitigation_: last-write-wins is acceptable; document the rule in the app.

### Exit Criteria

- A sanitation inspector can resolve a grievance in the field with photo + GPS, fully offline, and the resolution syncs cleanly when back online.
- Enforcement officer issues a challan offline; SMS sends to citizen on next connection.

### Suggested Sprint Slice

- **Sprint 9.1**: App shell + role-scoped queue + grievance / application actions + offline queue.
- **Sprint 9.2**: Challan-issue + camera/GPS + (optional) Bluetooth printer + pilot pack.

---

## Phase 10 — Pilot Hardening & Launch

> "The work between 'demo-ready' and 'production-ready' is bigger than the demo work."

### Goal

Take the platform from feature-complete to production-resilient, secure, observable, and supportable. Launch the pilot with 1 corporation + 1 municipality.

### Scope

- **Security**: full pen-test (external + internal), MASVS L2 sign-off, OWASP ASVS L2 sign-off, secrets rotation drill, threat-model review.
- **Performance**: load-test 5,000 concurrent citizens, 1,000 RPS sustained on hot endpoints, P95 < 500 ms.
- **Resilience**: chaos engineering — kill DB, kill Redis, kill Ollama, kill MinIO; verify graceful degradation and recovery.
- **Observability**: every service has dashboards, alerts, runbooks. SLOs defined.
- **DR**: nightly Postgres + MinIO snapshots; quarterly DR drill rehearsed once.
- **Compliance**: DPDP Act consent ledger, data export endpoint, account deletion endpoint, GDPR-style RoPA documented.
- **Operations**: support helpdesk wired in (Zammad / OSTicket — open source); on-call rotation; incident-response playbook.
- **Training**: tenant admin training (1 day per ULB), inspector training (half day), citizen-facing FAQ video.
- **Pilot launch**: 1 corporation + 1 small municipality + 1 notified-area authority; soft-launch to 10,000 citizens for 4 weeks.
- **Hot-fix loop**: weekly retrospective + 48-hour patch cycle during pilot.

### Key Deliverables

1. Pen-test report + remediation log.
2. SLO document (`docs/slo.md`).
3. Runbooks (`docs/playbooks/*.md`): on-call, incident, DR, tenant-onboarding, payment-failure-triage, RAG-index-rebuild.
4. Loadtest report (k6) with proven 1,000 RPS.
5. DR drill report.
6. Admin + inspector training materials.
7. Citizen FAQ video + microsite.
8. Public launch communications kit.
9. Pilot retrospective document at +4 weeks.

### Out of Scope

- State-wide rollout (Phase 11).

### Dependencies

- Phases 0–9 complete.
- 3 ULBs onboarded, MoUs signed.

### Risks

- Pen-test finds critical issues. _Mitigation_: 2-week buffer baked in.
- Pilot ULB staff resistance. _Mitigation_: training, hand-holding, escalation hotline to project team.

### Exit Criteria

- Pen-test: zero criticals, all highs remediated.
- 30-day pilot uptime ≥ 99.9 % across all hot paths.
- ≥ 70 % citizen satisfaction (in-app rating).
- ≤ 2 % SLA breaches in pilot ULBs.

### Suggested Sprint Slice

- **Sprint 10.1**: Security + perf + resilience hardening.
- **Sprint 10.2**: Observability + DR + compliance + helpdesk.
- **Sprint 10.3**: Training + pilot launch + retrospective.

---

## Phase 11 — State-Wide Rollout

> "From 3 ULBs to 125+, without breaking what works."

### Goal

Onboard every WB ULB in waves, with infrastructure scaling, regional support, and continuous configuration improvements.

### Scope

- **Wave plan**: corporations first (high impact, well-staffed), then municipalities, then notified-area authorities.
- **Infrastructure scale-up**: K8s cluster sizing, Postgres read replicas, Qdrant horizontal scaling, MinIO erasure-coded cluster, Ollama-pool with multiple workers.
- **Regional support hubs**: divisional team setup for tenant onboarding / training / first-line support.
- **Onboarding factory**: standardised checklist (tenant config form → service inheritance → KB seeding → staff invites → DLT sender ID → gateway sub-merchant → branding) — target: 1 ULB onboarded per day per support engineer.
- **Continuous improvement**: monthly release train, fortnightly tenant-feedback loop, quarterly security audit.

### Key Deliverables

1. Wave-onboarding plan with calendar.
2. Infra scaling plan + executed.
3. Regional hub SOPs.
4. Per-quarter platform release.
5. Per-month tenant-feedback report.

### Out of Scope

- New product features (covered by Phase 12 cadence).

### Dependencies

- Phase 10 complete.
- Continuous DoUD&MA sponsorship for ULB MoUs.

### Risks

- Onboarding bottleneck. _Mitigation_: invest in self-service onboarding wizard improvements.
- ULB-specific configuration drift. _Mitigation_: enforce that all customisation is data-driven; periodic audits.

### Exit Criteria

- 100 % of WB ULBs live within 12 months of pilot launch.
- 99.9 % uptime sustained.
- ≥ 1 million active citizen accounts.

### Suggested Sprint Slice (continuous)

- **Sprint 11.x**: a wave per sprint, with a parallel platform-team sprint for fixes & scale work.

---

## Phase 12 — Beyond MVP (Continuous)

> "The roadmap that begins after we stop calling it a roadmap."

### Goal

Strategic capability additions, post-pilot, in approximate order of citizen impact.

### Scope (each is its own mini-phase, prioritised quarterly)

1. **WhatsApp Business API channel** — same RAG backend, new front door. Massive adoption multiplier in WB. _Effort: ~2 sprints._
2. **Voice-first chatbot** — Whisper.cpp self-hosted (with Bengali fine-tune), streaming voice → text → RAG → text → TTS (Coqui XTTS). Critical for low-literacy users. _Effort: ~4 sprints._
3. **Predictive SLA-breach alerts** — historical-data ML model flagging applications likely to breach 24 h before deadline; alert clerks proactively. _Effort: ~3 sprints._
4. **Open Data API** — anonymised, aggregated grievance trends, revenue, service uptake; for researchers, journalists, NGOs. _Effort: ~2 sprints._
5. **IoT integrations** — water-tanker GPS, garbage-truck route tracking, IoT water-meter live consumption, smart streetlight fault auto-detection. _Effort: ~6+ sprints, hardware-dependent._
6. **Offline-first form filling at full fidelity** — already partially done in Phase 5; harden for low-connectivity wards with full-screen offline-first mode + paper-form OCR fallback.
7. **Aadhaar e-Sign integration** — for high-trust services (mutation, marriage registration).
8. **Real-time disaster-response module** — hooks into State Disaster Management Authority feeds.
9. **Citizen reputation / civic-points** — gamified engagement (rate your ULB, top-rated ward of the month).
10. **Cross-ULB portability** — citizen moves house from KMC to HMC; profile, holding, family graph migrates with consent.
11. **Whole-of-government interoperability** — DigiLocker outbound, MyScheme.gov.in cross-link, MeriPehchan SSO.
12. **Regional language expansion** — Nepali (Darjeeling region), Santali (tribal districts) — same i18n machinery.
13. **PFMS / Treasury integration** — automatic GL-to-treasury posting for disbursement-side flows (welfare pensions, refunds).
14. **Citizen-led mapping** — crowdsourced street furniture / pothole / bin-fill-level reporting that augments the IoT data.

### Out of Scope (intentionally deferred until later)

- Anything that depends on hardware not yet procured.
- Anything that requires legislative change (e.g. fully digital approval certification with legal e-Sign — depends on policy).

### Cadence

- Quarterly road-mapping with the DoUD&MA sponsor + tenant council (representative committee of municipal commissioners).
- Monthly platform release.
- Continuous tenant-led configuration improvements.

---

## Cross-Phase Workstreams (run in parallel throughout)

| Workstream                     | Description                                                        | Cadence                         |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------- |
| **Design & UX research**       | Field studies, usability testing, screen-by-screen iteration       | Continuous                      |
| **Service-catalogue curation** | Adding services, refining fees / SLAs / docs based on ULB feedback | Continuous                      |
| **Knowledge-base authoring**   | KB articles per tenant, reviewed for accuracy                      | Per-tenant onboarding + monthly |
| **Security & compliance**      | Quarterly pen-test, monthly dependency scan, annual ASVS audit     | Quarterly / monthly / annually  |
| **Observability tuning**       | Dashboards, alerts, SLO refinement                                 | Per release                     |
| **Documentation**              | API docs, admin manuals, citizen FAQs                              | Per feature                     |
| **Translation QA**             | Bengali + Hindi review by native speakers; especially legal terms  | Per release                     |
| **Accessibility audit**        | axe-core CI + quarterly manual audit                               | CI + quarterly                  |
| **Tenant-feedback loop**       | Tenant council meetings, survey instrumentation                    | Fortnightly / monthly           |

---

## Decision Log Pointer

All ratified architecture decisions live in `docs/ADRs/` from Phase 0 onward. ADRs supersede this file when in conflict; this file gets updated in the same PR as the ADR.

---

## Glossary Pointer

See `AGENT.md` §10 for the canonical glossary. Phase-specific terms are introduced inline.

---

## Status

**Current state**: **Phase 2 complete.** **Master Phase 4:** **Sprints 4.1–4.2** closed **2026-05-11**; **Sprint 4.3 core** closed **2026-05-13**; **Master Phase 4 backlog slice (#3)** **closed engineering 2026-05-14** ([exit record](./docs/runbooks/phase4-backlog-slice-exit.md)). Phase 3 payment/finance slices through **3.3A** closed on stub rail; **Sprint 3.1B** **deferred**. **Citizen Unified Hub programme** **H1–H4** closed; **Hub H5.1** repo engineering slice merged; **Hub H6.1** **closed in-repo (engineering, 2026-05-14)** per [exit checklist](./docs/runbooks/hub-h6-exit-checklist.md) ([runbook](./docs/runbooks/citizen-unified-hub.md)); sponsor PO line optional. **Master Sprint 5.1 (#4)** and **5.2 (#5)** (5.2a+5.2b), **Sprint 5.3 (#6)**, **Sprint 5.4 (#7)** **closed in-repo (engineering)** — [`master-sprint-54-exit.md`](./docs/runbooks/master-sprint-54-exit.md) closes push/deep-link/PWA polish. **Sprint 6.1 (#8)** and **Sprint 6.2 (#9)** **closed in-repo (engineering)** — [`master-sprint-61-exit.md`](./docs/runbooks/master-sprint-61-exit.md), [`master-sprint-62-exit.md`](./docs/runbooks/master-sprint-62-exit.md). **Locked queue next:** Sprint **6.3** (#10). See [locked queue](#locked-next-10-sprint-queue-priority-execution-order).

### Phase 0 closure note (2026-05-06)

Closed across two commits on `main`:

| Commit    | Slice            | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `77a7355` | Sprint 0.1 build | PNPM + Turborepo monorepo; 4 runnable scaffolds (`@enagar/config`, `@enagar/types`, `apps/api` NestJS hello, `apps/citizen-pwa` Next.js hello); 14 stubs; CI (lint/typecheck/test/Trivy/commitlint); Husky + commitlint + lint-staged; dev infra (`docker-compose` for postgres / redis / qdrant / minio / keycloak / meilisearch / mailhog; ollama behind `offline-llm` profile); `.env.example`; charter (`docs/charter.md`); ADRs 0001 / 0002 / 0003 / 0005 / 0008 |
| `7b604d2` | Sprint 0.2 docs  | `docs/glossary.md`; `docs/security/threat-model.md` (STRIDE + 64-test Phase-1 backlog); `docs/service-catalogue.md` (76 services, 6 workflow patterns, ID formats, seed plan); `docs/design-system.md` (tokens, theming, 6 wireframes); ADR-0009 (Keycloak); ADR-0010 (external-data adapters — proposed)                                                                                                                                                             |

### What was delivered against the original Phase-0 exit criteria

| Criterion (from §Phase 0 above)                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 7 ADRs ratified and merged                                              | ⚠️ **Partial** — 6 accepted (0001 / 0002 / 0003 / 0005 / 0008 / 0009), 1 proposed (0010), 3 explicitly deferred to their natural phases (0004 → Phase 2, 0006 → Phase 3, 0007 → Phase 6/7)                                                                                                                                                                                                                                                   |
| `pnpm install && pnpm dev:up && pnpm dev` boots every app to a hello screen | ⚠️ **Partial** — `apps/api` + `apps/citizen-pwa` boot; **`apps/mobile`** boots an Expo RN shell (**[Sprint 5.1](./docs/runbooks/master-sprint-51-exit.md)**); **`apps/admin-tenant`** boots Tenant Admin (**[Sprint 6.1](./docs/runbooks/master-sprint-61-exit.md)**); `apps/admin-state`, `apps/staff-mobile` remain stubs (later phases). Solo-developer pragmatism: avoid duplicate hello-world scaffolding where sprints supersede stubs |
| CI green on a freshly cloned repo                                           | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Storybook published with ≥ 30 components                                    | ⏭ **Deferred to Phase 2 Sprint 2.5** — no production component code exists yet; Storybook with empty atoms would be theatre. `docs/design-system.md` §8 commits to publishing in Phase 2                                                                                                                                                                                                                                                    |
| Charter signed                                                              | 🟡 **Pending sponsor sign-off** — `docs/charter.md` v0.1 awaiting DoUD&MA review                                                                                                                                                                                                                                                                                                                                                             |

### Open items rolling forward

| #   | Item                                                                                  | Origin             | Lands in                                                         |
| --- | ------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| 1   | Sponsor sign-off on charter, glossary, threat model, service catalogue, design system | Sprint 0.2 outputs | Sponsor track                                                    |
| 2   | DPA template signed with OpenAI + Google for chatbot                                  | ADR-0008           | Phase 7 prerequisite                                             |
| 3   | `docs/playbooks/postgres-for-sql-server-developers.md`                                | ADR-0001 follow-up | Opportunistic, before DB-heavy Phase 2/3 work                    |
| 4   | `docs/playbooks/postgres-on-prem-ops.md`                                              | ADR-0001 follow-up | Phase 5 hardening                                                |
| 5   | `docs/playbooks/onprem-bootstrap.md`                                                  | ADR-0005 follow-up | Phase 5 hardening                                                |
| 6   | `pnpm run generate:sdk` script wired into Turborepo                                   | ADR-0002 follow-up | Phase 2 SDK automation track                                     |
| 7   | NestJS module template (validation pipe, error filter, tenant guard, swagger)         | ADR-0002 follow-up | ✅ delivered (`apps/api`); template extraction later if repeated |
| 8   | Capacity-planning request to WBSCSC                                                   | ADR-0005 follow-up | Sponsor / state IT — out of solo-dev hands                       |
| 9   | Field interviews in 3 ULBs                                                            | Phase-0 scope      | Sponsor-driven; not blocking Phase 1 dev                         |
| 10  | ADR-0010 final acceptance (currently Proposed)                                        | Sprint 0.2         | Phase 3 kickoff after KMC IT liaison                             |

### Phase 1 closure status

Phase 1 exit criteria (per §Phase 1 above):

- ✅ Cross-tenant citizen isolation covered by automated `CitizenService` tests and manual dev OTP flow.
- ✅ 8 tenant seeds available; tenant switching updates name, ward count, and runtime theme.
- ✅ OWASP ZAP auth scan passed with `FAIL-NEW: 0`, `WARN-NEW: 0`, and 119 checks passing.
- ✅ Admin MFA enforced by realm contract plus API JWT claim checks.
- 🔴 DigiLocker sandbox credentials / permission from MeitY remain unavailable; real Aadhaar linking is deferred until access is granted.

**Next action:** Continue Phase **6** with **Sprint 6.4** — notification templates, KB CMS, branding, feature flags, staff & roles. Parallel **Hub H5.1** staging / pilot readiness as capacity allows. **Sprint 3.1B** (payment gateway) stays **deferred** until sponsor unpause. _(Hub **H5.1** and Master **Phase 5** sprints are distinct labels — do not confuse.)_

---

_Living document. Edit freely; commit messages must reference the ADR or sprint that motivated the change._
