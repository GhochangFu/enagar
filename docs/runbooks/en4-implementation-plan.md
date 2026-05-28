# EN-4 — Implementation plan (local first, then VM)

**Backlog:** [`../backlog/EN-4-global-form-templates-onboarding.md`](../backlog/EN-4-global-form-templates-onboarding.md)  
**Depends on:** EN-3 (wizard onboarding, tenant admin provision, citizen catalogue) — **done**  
**Status:** In progress — Phases 1–6 implemented locally (see progress tracker)  
**Pilot ULB code for tests:** `EN4T` (use a fresh code; do not rely on KALY/UTPK with pre-fix forms)

---

## How to resume this work (for you or an agent)

In a new chat, point at this file and say which phase to run, for example:

- _"Implement EN-4 Phase 1 per `docs/runbooks/en4-implementation-plan.md`"_
- _"Continue EN-4 from Phase 4 — State Admin UI"_
- _"EN-4 local exit checklist — run verify and update docs"_

Update the **Progress tracker** table below as phases complete.

---

## Progress tracker

| Phase | Title                         | Status      | Notes                                                                              |
| ----- | ----------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| 0     | Local baseline                | Pending     | Run `pnpm db:seed` + dev stack before smoke                                        |
| 1     | Shared module + seed backfill | Done        | `tenant-service-onboarding-forms.ts`, seed backfill                                |
| 2     | Global library API            | Done        | `form_schema`, `has_usable_form_schema` on list                                    |
| 3     | Onboarding audit counts       | Done        | `forms_from_global`, `forms_stubbed` in audit                                      |
| 4     | State Admin UI                | Done        | JSON editor + citizen apply form indicator                                         |
| 5     | Wizard hint                   | Done        | Review step form source summary                                                    |
| 6     | `verify:en4` + tests          | Done        | `pnpm verify:en4`, `en4-global-form-templates.spec.ts`                             |
| 7     | Citizen manual smoke          | Done        | Manual smokes passed (incl. KONM re-sync path)                                     |
| 8     | Docs + local sign-off         | In progress | Commit + VM pending                                                                |
| VM    | Deploy to demosites VM        | Not started | After Phase 8                                                                      |
| EN-5  | State WYSIWYG form builder    | Planned     | [`en5-state-global-form-builder-plan.md`](./en5-state-global-form-builder-plan.md) |

---

## Already done (do not rebuild)

| Area                                       | Status       | Location / notes                                                               |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------ |
| `global_services.form_schema` column       | Done         | `schema.prisma`                                                                |
| PATCH global library accepts `form_schema` | Done         | `admin-state.service.ts` → `upsertGlobalServiceTemplate`                       |
| Onboarding publishes tenant form v1        | Partial      | `ensurePublishedOnboardingForm`, `resolveOnboardingFormSchema`                 |
| Valid stub fallback                        | Done         | `createBlankFormSchemaDraft()` (EN-3 fix)                                      |
| Citizen gate (published form required)     | Done         | `services.service.ts`                                                          |
| Rich schemas in seed (5 services)          | Partial      | `priorityServiceFormSchemas` in `seed.ts` → **tenant** forms only, not globals |
| Tenant Admin publish v2+                   | Done         | `admin-tenant.service.ts`                                                      |
| EN-3 wizard + `pnpm verify:en3`            | Done         | `scripts/verify-en3-state-onboarding.mjs`                                      |
| State library guided UI                    | Partial      | No `form_schema` in list/draft/payload                                         |
| `tenant-service-onboarding-forms.ts`       | Missing      | Referenced in backlog; logic inline in `admin-state.service.ts`                |
| Re-onboard form repair                     | Out of scope | Existing published v1 is skipped                                               |

**Main gap:** `global_services.form_schema` stays `{}` after seed → onboarding copies blank drafts, not rich birth-cert / trade-licence forms.

---

## Phase 0 — Local baseline

**Deliverables:** Running stack; pilot code `EN4T` chosen.

```powershell
cd d:\UDProjects\MunicipalServices
pnpm infra:up
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed
pnpm dev:portals
```

**Exit criteria**

- [ ] API `:3001`, State `:3003`, Citizen `:3000` up
- [ ] State Admin → Service library loads

---

## Phase 1 — Shared module + seed backfill

**Deliverables**

1. Add `apps/api/src/modules/admin-state/tenant-service-onboarding-forms.ts`:
   - `isUsableFormSchema(json)`
   - `resolveOnboardingFormSchema(serviceCode, serviceName, globalFormSchema)`
   - `classifyOnboardingForm(globalFormSchema)` → `'global' | 'stub'`
2. Refactor `admin-state.service.ts` to use the module.
3. In `seed.ts`: copy `priorityServiceFormSchemas` into `global_services.form_schema` on upsert.
4. Add `sanitation-grievance` minimal schema **or** document stub-only in seed comment.
5. Add `tenant-service-onboarding-forms.spec.ts`.

**Exit criteria**

- [ ] Unit tests pass
- [ ] After `pnpm db:seed`, `birth-cert` global row has non-empty validated `form_schema`

---

## Phase 2 — Global library API

**Deliverables**

- Extend `StateGlobalServiceTemplateRow` with `form_schema`, `has_usable_form_schema`
- Update `toGlobalServiceTemplateRow()`
- Contract test in `tests/security/` (new `en4-*.spec.ts` or extend `master-sprint-612.spec.ts`)

**Exit criteria**

- [ ] `GET /api/admin/state/global-service-library` returns new fields
- [ ] `birth-cert` → `has_usable_form_schema: true`

---

## Phase 3 — Onboarding activate metadata

**Deliverables**

- `ensurePublishedOnboardingForm()` returns `{ source: 'global' | 'stub' }`
- `upsertTenant()` aggregates `forms_from_global`, `forms_stubbed` in audit metadata

**Exit criteria**

- [ ] Fresh wizard activate of `EN4T` → tenant v1 for `birth-cert` matches global fields in DB
- [ ] Audit log includes form counts

**Not in scope:** re-onboard replacing existing published v1.

---

## Phase 4 — State Admin UI (Service library)

**Deliverables**

- `LibraryDraft` / `libraryDraftToPayload` / `libraryRowToDraft` round-trip `form_schema`
- Badge: “Template ready” vs “Stub on adopt”
- Form template preview or JSON editor section
- Update `state-dashboard-client.tsx` types

**Exit criteria**

- [ ] View and save `form_schema` per global template in State Admin
- [ ] Indicator matches API flag

---

## Phase 5 — Wizard hint

**Deliverables**

- Review step hint: N services, M from global templates, K stubs

**Exit criteria**

- [ ] Review step shows form source summary before Activate

---

## Phase 6 — Automated verification

**Deliverables**

- `scripts/verify-en4-global-onboarding-forms.mjs`
- `package.json` → `"verify:en4": "..."`
- Chain with `verify:en3` where useful

**Exit criteria**

- [ ] `pnpm verify:en4` passes for `EN4T` after wizard onboard
- [ ] Fails if global schema missing or tenant form is blank stub for `birth-cert`

---

## Phase 7 — Citizen manual smoke

**Steps**

1. OTP login (`DEV_AUTH_ENABLED=true`, OTP `12345`)
2. Open `EN4T` → Birth Certificate
3. Form shows applicant / DOB / upload fields (not single-field stub)
4. Submit application (stub storage + scan simulation)

**Exit criteria**

- [ ] Citizen apply form matches global template for ≥1 service

---

## Phase 8 — Local sign-off

**Deliverables**

- Update [`state-tenant-onboarding.md`](./state-tenant-onboarding.md) — State → Tenant → Citizen form chain
- Update EN-4 backlog status
- Mark progress tracker above complete
- `graphify update .`

**Exit criteria**

- [ ] Phases 0–7 checked
- [ ] Commit: `feat(repo): EN-4 global form templates and onboarding publish`

---

## VM rollout (after local Phase 8)

1. `git push origin main`
2. VM: `git pull`, `pnpm install`, `pnpm db:seed`
3. Confirm `KEYCLOAK_BASE=http://127.0.0.1:8080` (EN-3 fix)
4. Restart apps
5. Onboard **new** ULB or accept re-onboard limits
6. `pnpm verify:en4` + `pnpm verify:en3` with HTTPS env vars
7. Citizen smoke on `https://enagarcitizen.demosites.co.in`

See also [`vm-deploy-demo-current-stage.md`](./vm-deploy-demo-current-stage.md).

---

## Out of scope (unchanged)

- Re-onboard / auto-repair of bad published forms
- Auto-sync tenant forms when global template changes
- WYSIWYG State form designer → **EN-5** ([`en5-state-global-form-builder-plan.md`](./en5-state-global-form-builder-plan.md))
- Grievance form templates

---

## Key files

| Area                          | Path                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| Onboarding forms (to extract) | `apps/api/src/modules/admin-state/admin-state.service.ts`  |
| Seed schemas                  | `apps/api/prisma/seed.ts` → `priorityServiceFormSchemas`   |
| State UI library              | `apps/admin-state/components/state-config-sections.tsx`    |
| State forms helpers           | `apps/admin-state/lib/state-dashboard-forms.ts`            |
| Wizard                        | `apps/admin-state/components/tenant-onboarding-wizard.tsx` |
| EN-3 verify                   | `scripts/verify-en3-state-onboarding.mjs`                  |

---

_Last updated: 2026-05-27 — implementation plan from EN-4 scoping session._
