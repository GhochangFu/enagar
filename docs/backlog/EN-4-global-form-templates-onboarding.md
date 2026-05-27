# EN-4 — Global form templates, onboarding auto-publish, and citizen visibility

**Type:** Follow-up to **EN-3** (State Admin tenant onboarding wizard)  
**Status:** Backlog — not started  
**Portals:** State Admin (`admin-state`), API (`admin-state` module), Citizen PWA (read-only validation)

---

## Problem

EN-3 adopts **published global services** into a new ULB by category, but **citizen-visible services** also require a **published tenant form** (`service_form_versions.status = 'published'`). Today:

- `global_services.form_schema` exists in the DB/API but is **not curated in State Admin UI** (Service library guided form omits it; list API does not return it).
- Seed **rich** form layouts live only in `apps/api/prisma/seed.ts` → `priorityServiceFormSchemas` (5 services), not on every published global.
- Onboarding **may** auto-publish v1 stub forms (EN-3 intent); without a populated global `form_schema`, citizens see **minimal** apply forms until Tenant Admin publishes richer versions in the Service designer.

Operators need a clear product path: **State defines default forms → onboarding copies them → citizens see them without mandatory Tenant Admin edits**.

---

## Target behaviour (product model)

```text
State Service library (global service + form_schema)
        ↓ publish global
State onboarding wizard (category pick) → adopt tenant services
        ↓ activate
Auto-publish tenant form v1 from global form_schema (or validated stub)
        ↓
Citizen PWA lists service (requires published form)
        ↓ optional
Tenant Admin publishes v2+ → citizens see latest published version
```

**If Tenant Admin never edits a service:** citizens still see **v1** from onboarding (global template or stub), not “waiting for ULB publish.”

**If Tenant Admin publishes a new version:** citizens see the **latest published** form for that ULB only (state global changes do not auto-overwrite tenant forms).

---

## Scope

### 1. API — onboarding activate

- On ULB activate (and re-activate backfill), for each adopted `tenant_service`:
  - Resolve `form_schema` from linked `global_services.form_schema` when usable (`fields` non-empty, passes `validateFormSchema`).
  - Else create **minimal stub** `EnagarFormSchema` (service code + title) so the service is not hidden from citizens.
  - Upsert `service_form_versions` **v1** with `status: 'published'`.
- Return counts in provisioning payload (e.g. `forms_published`, `forms_stubbed`) and state audit metadata.

**Reference implementation (from EN-3 discussion):** `tenant-service-onboarding-forms.ts` + `ensurePublishedOnboardingForms()` wired from `admin-state.service` activate path — restore or implement if missing on branch.

### 2. API — global library

- `GET /api/admin/state/global-service-library` and row detail include `form_schema` (and optional `has_usable_form_schema` flag).
- `PATCH` continues to accept `form_schema` on upsert.

### 3. Seed / backfill

- On `pnpm db:seed`, copy `priorityServiceFormSchemas` into `global_services.form_schema` for matching codes (`birth-cert`, `trade-licence`, `prop-tax`, `community-hall`, `rti`, plus any new globals).
- Add missing seed schema for **`sanitation-grievance`** (or document as intentionally stub-only).

### 4. State Admin UI — Service library

- Guided curator: **Form template** section (read-only preview + “Edit in JSON” link) or embedded JSON editor for `form_schema`.
- Show **“Citizen apply form”** indicator: usable global schema vs stub-on-adopt.
- Wizard catalogue step: optional hint — “N services will get default forms on activate.”

### 5. Docs & verification

- Extend onboarding runbook with **State → Tenant → Citizen** form chain (this ticket’s model).
- Add or extend `pnpm verify:en3` (or `verify:en4`) to assert adopted services have published forms and non-empty schema where globals define them.

---

## Out of scope

- Full WYSIWYG form designer in State Admin (Tenant Admin designer remains the ULB customization tool).
- Auto-migrating all existing ULBs when a state global template changes (preserve tenant overrides; optional manual “re-sync from global” later).
- Grievance form templates (separate catalogue).

---

## Acceptance criteria

1. State Admin can **view and save** `form_schema` per global service template (guided or JSON), and published globals used in onboarding store usable schemas for pilot services.
2. Activating a new ULB via the wizard creates **published v1 forms** for every adopted service; Citizen PWA shows those services without Tenant Admin action.
3. If global `form_schema` is empty, activate still publishes a **stub** so the service appears (documented as minimal UX).
4. Tenant Admin **publishFormDraft** still works; a new published version replaces what citizens see for that ULB.
5. `pnpm verify:en3` (or successor) passes on local/demo VM for a pilot ULB (e.g. `BLYM`).

---

## Dependencies

- **EN-3** merged: category adoption, wizard, Keycloak provision, citizen `GET /api/tenants` from Postgres.
- EN-3 onboarding runbook / `pnpm verify:en3` when present on branch; else [`docs/help/start-the-app-step-by-step.md`](../help/start-the-app-step-by-step.md) for local smoke.

---

## Jira paste (summary)

**Title:** EN-4 — Global form templates and onboarding auto-publish for citizens

**Summary:** Complete the State → ULB → Citizen form pipeline: curate `form_schema` on global service templates in State Admin, backfill seed schemas onto `global_services`, auto-publish tenant form v1 on wizard activate, and document that citizens see the ULB’s latest published form (v1 from global if Tenant Admin never edits).

**Follows:** EN-3

---

## Technical pointers

| Area                 | Location                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Citizen gate         | `apps/api/src/modules/services/services.service.ts` — `formVersions: { some: { status: 'published' } }` |
| Global schema column | `global_services.form_schema` in `apps/api/prisma/schema.prisma`                                        |
| Seed canonical forms | `priorityServiceFormSchemas` in `apps/api/prisma/seed.ts`                                               |
| State library API    | `admin-state.service.ts` — `upsertGlobalServiceTemplate`, `listGlobalServiceTemplates`                  |
| Tenant publish       | `admin-tenant.service.ts` — `publishFormDraft`                                                          |
| State UI library     | `apps/admin-state/components/state-config-sections.tsx` — `StateLibrarySection`                         |

---

_Last updated: 2026-05-27 — filed as follow-up from EN-3 onboarding / form-template discussion._
