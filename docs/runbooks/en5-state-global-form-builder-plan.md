# EN-5 — State Admin global form builder (implementation plan)

**Backlog:** [`../backlog/EN-5-state-global-form-builder.md`](../backlog/EN-5-state-global-form-builder.md)  
**Depends on:** EN-4 (global templates, onboarding, tenant re-sync) — **engineering done; commit/VM pending**  
**Status:** Not started  
**Pilot global for smoke:** `birth-cert` (richest seed template)

---

## How to resume

- _"Implement EN-5 Phase 0 — extract shared form builder"_
- _"Implement EN-5 Phase 2 — State library form editor page"_
- _"EN-5 exit — verify and docs"_

Update the **Progress tracker** as phases complete.

---

## Progress tracker

| Phase | Title                               | Status      | Notes                                     |
| ----- | ----------------------------------- | ----------- | ----------------------------------------- |
| 0     | Extract shared builder              | Not started | From tenant `service-designer-client.tsx` |
| 1     | State app deps + route shell        | Not started | `@enagar/forms`, dedicated page           |
| 2     | WYSIWYG editor wired to global save | Not started | Visual ↔ `form_schema_json`               |
| 3     | Citizen preview pane                | Not started | `DynamicFormFields`                       |
| 4     | JSON fallback UX                    | Not started | Replace inline textarea                   |
| 5     | Tenant refactor regression          | Not started | Thin wrapper only                         |
| 6     | Tests + verify                      | Not started | Security contract + manual smoke          |
| 7     | Docs + sign-off                     | Not started | EN-4 plan pointer, backlog status         |

---

## Design decisions (locked)

| Decision             | Choice                                                                | Rationale                                                                   |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Primary editor       | WYSIWYG                                                               | User requirement; JSON is backup                                            |
| JSON UX              | Collapsed `JsonFallbackPanel`                                         | Already used in State library + integrations                                |
| Shared code location | `packages/forms/src/builder/` exported as `@enagar/forms/builder`     | Same schema types as runtime; tenant + state both depend on `@enagar/forms` |
| State navigation     | Dedicated page `/dashboard/library/[code]/form`                       | Matches tenant `/dashboard/services/[serviceId]`; room for preview          |
| Save contract        | Existing `libraryDraftToPayload` → `PATCH .../global-service-library` | No API change                                                               |
| Draft model          | In-memory `EnagarFormSchema` + serialized JSON string (like tenant)   | Bidirectional sync on valid parse                                           |
| Publish              | Unchanged lifecycle buttons on library row                            | Form template save ≠ global publish                                         |
| service_code         | Locked to global `code` (read-only in inspector header)               | Prevents invalid onboarding copy                                            |
| i18n fields          | en / bn / hi on labels (same as tenant)                               | Matches `@enagar/forms` locale maps                                         |

---

## Architecture

```text
packages/forms/src/builder/
  form-field-palette.ts      # FORM_FIELD_PALETTE builders
  form-builder-utils.ts      # clone, pretty, locale helpers, fieldSummary
  FormSchemaBuilder.tsx      # palette + field list + inspector (presentational)
  FormCitizenPreview.tsx     # createRenderPlan + DynamicFormFields wrapper

apps/admin-tenant/.../service-designer-client.tsx
  → imports @enagar/forms/builder (behavior unchanged)

apps/admin-state/app/dashboard/library/[code]/form/
  page.tsx
  global-form-builder-client.tsx
    → load global row from API (or pass code + fetch)
    → FormSchemaBuilder + preview + JsonFallbackPanel
    → Save → PATCH form_schema via libraryDraftToPayload subset
```

**Data flow on Save:**

1. `validateFormSchema(schema)` — block if invalid.
2. Ensure `schema.service_code === global.code`.
3. `PATCH /api/admin/state/global-service-library` with `{ code, form_schema: schema, ...existing metadata }`  
   **or** merge into full library draft if curator edited other fields on same session.

Prefer **form-only PATCH** on builder page (load row by code, PATCH `{ code, form_schema }` minimal) to avoid overwriting unrelated curator fields.

---

## Phase 0 — Extract shared builder

**Goal:** Zero UX change on Tenant Admin; move ~400–500 lines to `@enagar/forms/builder`.

**Extract from** `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx`:

- `FORM_FIELD_PALETTE`, `FIELD_DRAG_MIME`, `localeMap`, `defaultOptions`, `cloneFormSchema`, `pretty`
- `FormVisualBuilder`, `FieldInspector`, helpers (`pickLocaleText`, `fieldSummary`, …)

**Deliverables**

1. `packages/forms/package.json` → export `"./builder": "./src/builder/index.ts"`
2. `packages/forms/src/builder/index.ts` re-exports components + utils
3. Tenant designer imports from `@enagar/forms/builder`
4. `apps/admin-tenant` tailwind `content` already includes `packages/forms/src` — confirm builder classes retained

**Exit criteria**

- [ ] `pnpm --filter @enagar/admin-tenant typecheck`
- [ ] Manual: tenant service designer palette + inspector still works
- [ ] No duplicate palette in tenant file

---

## Phase 1 — State app shell

**Deliverables**

1. `apps/admin-state/package.json` — add `@enagar/forms`, `@enagar/ui` (ui already present)
2. `apps/admin-state/tailwind.config.ts` — add `packages/forms/src/**` to `content` (mirror tenant)
3. Route: `app/dashboard/library/[code]/form/page.tsx`
4. Link from `StateLibrarySection`: **Edit apply form** → new route (enabled when row selected)
5. `global-form-builder-client.tsx` — load `GET /api/admin/state/global-service-library`, find row by `code`

**Exit criteria**

- [ ] Page loads for `birth-cert` with schema from API
- [ ] Back link to dashboard library tab

---

## Phase 2 — WYSIWYG wired to save

**Deliverables**

1. State builder holds `formSchema` state initialized from `createBlankFormSchemaDraft(code, name)` or row `form_schema`
2. Embed `FormSchemaBuilder` with same callbacks as tenant (`onAddField`, `onUpdateField`, …)
3. **Save template** button → validate → `PATCH` `{ code, form_schema }` (merge name/category from loaded row if required by API)
4. Status banner success/error (match tenant patterns)
5. Header shows **Citizen apply form** badge (`has_usable_form_schema` / field count)

**Exit criteria**

- [ ] Visual add/remove/reorder field persists to DB
- [ ] Reload page shows saved fields
- [ ] `pnpm verify:en4` still passes after editing `birth-cert`

---

## Phase 3 — Citizen preview

**Deliverables**

1. `FormCitizenPreview` aside: `createRenderPlan(schema, { platform: 'web' })` + `DynamicFormFields`
2. Empty values `{}` (no prefill — citizen PWA policy)
3. Optional: wire `form-field-examples` pattern later — **out of scope for EN-5 v1**

**Exit criteria**

- [ ] Preview updates live as inspector edits fields
- [ ] Invalid schema shows “Fix schema to preview”

---

## Phase 4 — JSON fallback

**Deliverables**

1. Remove primary inline **Form template (JSON)** textarea from `StateLibrarySection` guided card (or keep read-only one-liner summary only)
2. On builder page: `JsonFallbackPanel` collapsed by default
3. Sync rules:
   - Visual edit → updates JSON string
   - JSON edit → on blur or debounced parse → updates visual if valid; show validation errors if not
4. Library list panel: summary line + **Edit apply form** CTA (no large JSON box)

**Exit criteria**

- [ ] Curator can complete birth-cert edit without opening JSON
- [ ] Power user can paste seed JSON in fallback and see visual update

---

## Phase 5 — Tenant regression

**Deliverables**

- Run tenant designer manual smoke (add field, save draft, publish)
- Jest: existing admin-tenant tests green

**Exit criteria**

- [ ] No diff in tenant save/publish API behaviour

---

## Phase 6 — Tests + verify

**Deliverables**

1. `tests/security/en5-state-global-form-builder.spec.ts`:
   - `@enagar/forms/builder` export exists
   - State route `library/[code]/form` exists
   - `global-form-builder-client` uses `FormSchemaBuilder` + `JsonFallbackPanel`
   - Tenant designer imports shared builder (no local `FORM_FIELD_PALETTE`)
2. Optional: extend `verify:en4` field-count check after State save — not required if manual smoke suffices

**Exit criteria**

- [ ] `pnpm test:security -- en5-state-global-form-builder`
- [ ] State manual smoke: edit global → onboard fresh ULB → citizen rich form

---

## Phase 7 — Docs + sign-off

- Update EN-4 backlog / plan — WYSIWYG moved to EN-5 (done in backlog)
- Short section in [`state-tenant-onboarding.md`](./state-tenant-onboarding.md): State curates templates in visual builder
- Mark EN-5 backlog **Done** when phases 0–6 complete
- `graphify update .`

---

## Manual smoke checklist (State)

1. State Admin → Service library → select `birth-cert` → **Edit apply form**
2. Add a text field visually; set EN label; mark required
3. Preview shows new field
4. **Save template** — no JSON opened
5. Open JSON fallback — schema includes new field
6. Publish global lifecycle if still `draft` (existing flow)
7. Onboard new ULB or tenant **Load State template** — citizen sees new field

---

## Risk register

| Risk                                     | Mitigation                                               |
| ---------------------------------------- | -------------------------------------------------------- |
| Duplicating tenant builder in State      | Phase 0 extraction mandatory first                       |
| Tailwind purges builder classes in State | Add `packages/forms/src` to admin-state tailwind content |
| PATCH overwrites unrelated global fields | Form page PATCH minimal `{ code, form_schema }` only     |
| Schema `service_code` drift              | Lock code in builder; validate on save                   |
| Large refactor breaks tenant             | Phase 5 gate before State UI merge                       |

---

## Key files (today → after EN-5)

| Area                | Current                                                | EN-5 target                                           |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Tenant builder      | `service-designer-client.tsx`                          | Thin orchestration + `@enagar/forms/builder`          |
| State library JSON  | `state-config-sections.tsx` L281–293                   | Summary + link; JSON on builder page only             |
| State forms helpers | `state-dashboard-forms.ts`                             | Reuse `parseFormSchemaJson`, `countPreviewFormFields` |
| Shared validation   | `@enagar/forms` `validateFormSchema`                   | Unchanged                                             |
| API                 | `admin-state.service.ts` `upsertGlobalServiceTemplate` | Unchanged                                             |

---

_Last updated: 2026-05-28 — planned after EN-4 manual smokes passed._
