# EN-5 — State Admin global form builder (WYSIWYG + JSON fallback)

**Type:** Follow-up to **EN-4** (global form templates, onboarding publish, tenant re-sync)  
**Status:** Planned — see [`docs/runbooks/en5-state-global-form-builder-plan.md`](../runbooks/en5-state-global-form-builder-plan.md)  
**Portals:** State Admin (`admin-state`) only  
**API:** Reuses existing `PATCH /api/admin/state/global-service-library` (`form_schema`)

---

## Problem

EN-4 lets State curators edit global `form_schema` as **raw JSON** in the Service library panel. That works for engineers and seed parity, but State operators need the same **visual form builder** Tenant Admin already has (Sprint 6.7 palette + inspector + citizen preview), with JSON kept as an **advanced fallback** — not the primary editor.

---

## Target behaviour

```text
State Service library → Edit apply form (WYSIWYG)
        ↓ save
global_services.form_schema  (validated EnagarFormSchema)
        ↓ unchanged EN-4 chain
Onboarding / tenant re-sync → citizen apply forms
```

- **Primary:** drag-drop palette, field list, inspector (en/bn/hi labels, required, options, file accept).
- **Secondary:** collapsed **Advanced JSON fallback** (`JsonFallbackPanel` pattern) — two-way sync with visual state; invalid JSON blocks save.
- **Preview:** `DynamicFormFields` citizen preview (read-only sample values optional, no prefill submit).
- **No new API** for v1 — same upsert payload as EN-4 guided save.

---

## Out of scope

- State-level **workflow** WYSIWYG (globals still use `workflow_pattern` enum in guided curator).
- Auto-push template changes to existing ULB published forms (tenant **Load State template** remains manual).
- Grievance global form templates.
- Replacing Tenant Admin designer (tenant keeps publish/draft lifecycle; State edits **global template** only).

---

## Acceptance criteria

1. State Admin opens **Edit apply form** for a global service and builds/edits fields visually; save persists validated `form_schema`.
2. JSON fallback stays available, collapsed; editing JSON updates visual builder when valid.
3. Citizen preview renders through `@enagar/forms/web` on the builder page.
4. `birth-cert` template editable in UI matches seed/API schema shape; `pnpm verify:en4` still passes after save.
5. Tenant Admin service designer still works (shared builder extracted — no regression).
6. Contract test asserts State builder route + shared module exist.

---

## Dependencies

- **EN-4** done locally (global `form_schema`, library API, onboarding publish, tenant re-sync).
- Tenant Admin visual builder in `service-designer-client.tsx` (reference implementation to extract).

---

## Jira paste (summary)

**Title:** EN-5 — State Admin WYSIWYG global form builder with JSON fallback

**Summary:** Add a State Admin visual form builder for global service templates by extracting the Tenant Admin Sprint 6.7 form palette into a shared package, wiring a dedicated library form editor route, and keeping JSON as a collapsed advanced fallback. Reuses existing global library PATCH; no API schema changes.

**Follows:** EN-4

---

_Last updated: 2026-05-28_
