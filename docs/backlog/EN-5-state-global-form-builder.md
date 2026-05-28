# EN-5 — Shared form builder (State + Tenant) with validation authoring

**Type:** Follow-up to **EN-4** (global form templates, onboarding publish, tenant re-sync)  
**Status:** In progress (Phases 0–2 done) — see [`docs/runbooks/en5-state-global-form-builder-plan.md`](../runbooks/en5-state-global-form-builder-plan.md)  
**Portals:** State Admin (`admin-state`) **and** Tenant Admin (`admin-tenant`)  
**API:** Reuses existing PATCH endpoints (no new routes for v1)

---

## Problem

EN-4 lets State curators edit global `form_schema` as **raw JSON**. Tenant Admin has a Sprint 6.7 visual palette, but the **field inspector only covers labels, required, options, and file MIME** — most validation (`pattern`, min/max, `show_if`, date bounds) still requires JSON.

Operators need:

1. **State Admin** — WYSIWYG global template editor (JSON as advanced fallback).
2. **Tenant Admin** — the **same** validation authoring UI when customizing ULB forms.
3. **Citizen apply** — conditional fields that show/hide live (`show_if`), not only at submit time.

---

## Target behaviour

```text
@enagar/forms/builder  (shared)
        ├── State Admin  → global_services.form_schema
        └── Tenant Admin → service_form_versions (draft → publish)
                ↓
        validateFormSchema / validateSubmission
                ↓
        Citizen PWA + mobile
```

**Primary:** drag-drop palette, field list, **validation inspector** (required, bounds, pattern, `show_if`, cross-field rules).  
**Secondary:** JSON fallback (collapsed on State builder page; existing panel on Tenant designer).  
**Preview:** `DynamicFormFields` with optional preview values to test conditionals.

### `show_if` limits (current engine)

- **Equals one value** — use for select/radio/text (e.g. Trade Licence: show FSSAI when `trade_type` **equals** `food`).
- **Includes one option** — only when the **controlling field is multiselect**; checks that the citizen selected that single option, not “any of several”.
- **Not supported until Phase 6:** multi-value OR visibility (e.g. show when `trade_type` is food **or** retail **or** industrial). Phase 2 inspector does not offer this; neither does raw `show_if` JSON today.

---

## Scope

### In scope

- Extract `@enagar/forms/builder` from tenant designer
- Shared validation inspector (field rules + single-value `show_if`) on **both** portals
- Enforce `min_date` / `max_date` in submission validation — **done (Phase 3)**
- New `cross_field_rules` (e.g. end date after start date) **and** richer visibility (multi-value OR, e.g. show when any of several choice values) — engine + builder UI
- State route `/dashboard/library/[code]/form`
- Citizen PWA: pass `formValues` into `createRenderPlan` for live conditionals

### Out of scope

- State-level workflow WYSIWYG
- Auto-sync global template changes to existing tenant published forms
- Grievance form templates
- API lookup–driven dynamic dropdowns
- Full JSON Schema / JSON Logic rule engine

---

## Acceptance criteria

1. State Admin builds/edits global templates visually; save persists validated `form_schema`.
2. Tenant Admin uses the **same** validation inspector — no JSON required for common rules.
3. JSON fallback available on both surfaces; valid JSON syncs to visual builder.
4. Citizen preview and PWA honour `show_if` while filling the form.
5. Cross-field compare rule can be added in builder and enforced on submit.
6. Multi-value OR visibility (e.g. show field when choice is any of several values) can be added in Phase 6 — not in Phase 2 `show_if`.
7. `pnpm verify:en4` still passes; new security contract tests for EN-5.

---

## Dependencies

- EN-4 merged (`a9ccbc4`)
- `@enagar/forms` validation model (`packages/forms/src/index.ts`)
- Tenant designer reference: `service-designer-client.tsx`

---

## Jira paste (summary)

**Title:** EN-5 — Shared form builder with validation authoring (State + Tenant)

**Summary:** Extract a shared `@enagar/forms/builder` used by State global template editing and Tenant service designer. Add WYSIWYG validation authoring (pattern, bounds, show_if, cross-field rules), fix citizen live conditional fields, enforce date min/max, and keep JSON as advanced fallback.

**Follows:** EN-4

---

_Last updated: 2026-05-27_
