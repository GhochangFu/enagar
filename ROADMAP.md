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

- A citizen can complete an end-to-end Birth Certificate application: pick service → fill form → upload doc → submit → see "Document Verification" stage → see SLA-due timer.
- Adding a 77th service requires only a database insert (verified by recording the exact SQL).
- Switching a service's form schema between v1 and v2 does not break in-flight applications (snapshot semantics confirmed).
- 100 % API coverage with integration tests including tenant-leak attempts.

### Suggested Sprint Slice

- ✅ **Sprint 2.1**: DB schema + revenue heads + service catalogue layering.
- ✅ **Sprint 2.2**: Form-Schema spec + `packages/forms` renderer (web + RN parity).
- ✅ **Sprint 2.3**: Workflow engine + applications + timeline.
- ✅ **Sprint 2.4**: Document upload pipeline + holding lookup.
- **Sprint 2.5**: Citizen UI end-to-end (Services → Apply → My Apps).
- **Sprint 2.6**: Hardening, tenant-isolation testing, performance pass.

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
- Gateway sandbox credentials.

### Risks

- Gateway downtime during pilot → bad first impression. _Mitigation_: graceful degradation, retry queue, transparent status banner.
- Webhook signature spoofing. _Mitigation_: strict signature verification + IP allow-list.

### Exit Criteria

- 1,000 simulated payments — zero double-charges, zero orphan applications, every transaction in `gl_postings`.
- Refund flow: deposit → release-eligible → approved → refunded → citizen sees credit-back.
- Receipt PDF QR code resolves to a public verification page.
- PCI-DSS scope minimised (no card data ever touches our servers).

### Suggested Sprint Slice

- **Sprint 3.1**: Payment lifecycle + gateway adapter + idempotency.
- **Sprint 3.2**: Receipts + GL postings + reconciliation report.
- **Sprint 3.3**: Deposits + refunds + challans.
- **Sprint 3.4**: Citizen payment UI + failure-handling polish.

---

## Phase 4 — Grievances & SLA Engine

> "A grievance with no timeline is a grievance ignored."

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
- A breached SLA triggers an escalation push to the next role within 1 minute of breach.
- 80 % of seeded grievances auto-route to the correct role without human intervention (validated with 200-grievance fixture).

### Suggested Sprint Slice

- **Sprint 4.1**: DB + APIs + SLA engine.
- **Sprint 4.2**: Citizen UI + auto-routing.
- **Sprint 4.3**: Escalations + reopen + rating + hardening.

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

**Current state**: **Phase 2 Sprint 2.4 complete; Sprint 2.5 ready to plan.**

### Phase 0 closure note (2026-05-06)

Closed across two commits on `main`:

| Commit    | Slice            | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `77a7355` | Sprint 0.1 build | PNPM + Turborepo monorepo; 4 runnable scaffolds (`@enagar/config`, `@enagar/types`, `apps/api` NestJS hello, `apps/citizen-pwa` Next.js hello); 14 stubs; CI (lint/typecheck/test/Trivy/commitlint); Husky + commitlint + lint-staged; dev infra (`docker-compose` for postgres / redis / qdrant / minio / keycloak / meilisearch / mailhog; ollama behind `offline-llm` profile); `.env.example`; charter (`docs/charter.md`); ADRs 0001 / 0002 / 0003 / 0005 / 0008 |
| `7b604d2` | Sprint 0.2 docs  | `docs/glossary.md`; `docs/security/threat-model.md` (STRIDE + 64-test Phase-1 backlog); `docs/service-catalogue.md` (76 services, 6 workflow patterns, ID formats, seed plan); `docs/design-system.md` (tokens, theming, 6 wireframes); ADR-0009 (Keycloak); ADR-0010 (external-data adapters — proposed)                                                                                                                                                             |

### What was delivered against the original Phase-0 exit criteria

| Criterion (from §Phase 0 above)                                             | Status                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 7 ADRs ratified and merged                                              | ⚠️ **Partial** — 6 accepted (0001 / 0002 / 0003 / 0005 / 0008 / 0009), 1 proposed (0010), 3 explicitly deferred to their natural phases (0004 → Phase 2, 0006 → Phase 3, 0007 → Phase 6/7)                                                                                                                                                                 |
| `pnpm install && pnpm dev:up && pnpm dev` boots every app to a hello screen | ⚠️ **Partial** — `apps/api` + `apps/citizen-pwa` boot; `apps/admin-tenant`, `apps/admin-state`, `apps/mobile`, `apps/staff-mobile` are package-level stubs (Phase-2 / 5 / 6 deliverables). Solo-developer pragmatism: a stub per app meets the "monorepo discoverability" intent without spending days on hello-world copies of work that gets thrown away |
| CI green on a freshly cloned repo                                           | ✅                                                                                                                                                                                                                                                                                                                                                         |
| Storybook published with ≥ 30 components                                    | ⏭ **Deferred to Phase 2 Sprint 2.5** — no production component code exists yet; Storybook with empty atoms would be theatre. `docs/design-system.md` §8 commits to publishing in Phase 2                                                                                                                                                                  |
| Charter signed                                                              | 🟡 **Pending sponsor sign-off** — `docs/charter.md` v0.1 awaiting DoUD&MA review                                                                                                                                                                                                                                                                           |

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

**Next action**: Plan Sprint 2.5 — Citizen UI end-to-end: Services → Apply → My Applications.

---

_Living document. Edit freely; commit messages must reference the ADR or sprint that motivated the change._
