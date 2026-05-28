# EN-5 — Shared form builder (State + Tenant) with validation authoring

**Backlog:** [`../backlog/EN-5-state-global-form-builder.md`](../backlog/EN-5-state-global-form-builder.md)  
**Depends on:** EN-4 (global templates, onboarding, tenant re-sync) — **done** (`a9ccbc4` on `main`)  
**Status:** In progress (Phases 0–5 done)  
**Pilot templates for smoke:** global `birth-cert`; tenant service with `show_if` (`trade-licence`)

---

## How to resume

- _"Implement EN-5 Phase 0 — citizen PWA live conditional fields"_
- _"Implement EN-5 Phase 1 — extract @enagar/forms/builder"_
- _"Implement EN-5 Phase 2 — shared validation inspector"_
- _"Implement EN-5 Phase 4 — State library form editor page"_
- _"EN-5 exit — verify and docs"_

Update the **Progress tracker** as phases complete.

---

## Progress tracker

| Phase | Title                               | Status      | Notes                                                          |
| ----- | ----------------------------------- | ----------- | -------------------------------------------------------------- |
| 0     | Citizen PWA live conditional fields | Done        | `createRenderPlan` + `formValues`                              |
| 1     | Extract shared builder package      | Done        | `@enagar/forms/builder`                                        |
| 2     | Shared validation inspector         | Done        | `FieldValidationInspector` — field rules + `show_if`           |
| 3     | Date min/max enforcement            | Done        | Engine + JSON-Schema export                                    |
| 4     | State WYSIWYG page + save           | Done        | `/dashboard/library/[code]/form`                               |
| 5     | Preview + JSON fallback UX          | Done        | Preview toolbar + collapsed JSON sync                          |
| 6     | Cross-field rules                   | Done        | `cross_field_rules` + `equals_any` + builder UI (both portals) |
| 7     | Tests + verify                      | Done        | `verify:en5`, security contract, forms unit tests              |
| 8     | Docs + sign-off                     | Not started | Backlog, runbooks, `graphify update .`                         |

---

## Product scope (both portals)

EN-5 delivers **one shared visual form builder** used by:

| Portal           | Context                 | Save target                                                     |
| ---------------- | ----------------------- | --------------------------------------------------------------- |
| **State Admin**  | Global service template | `PATCH /api/admin/state/global-service-library` (`form_schema`) |
| **Tenant Admin** | ULB service designer    | `PATCH /api/admin/tenant/services/:id/form-draft` → publish     |

Both use the same components from `@enagar/forms/builder`. JSON remains an **advanced fallback** on both surfaces — not the primary editor.

```text
@enagar/forms/builder  (palette + field list + validation inspector + preview)
        ├── State Admin  → global form_schema
        └── Tenant Admin → tenant form draft / publish
                ↓
        validateFormSchema + validateSubmission  (@enagar/forms)
                ↓
        Citizen PWA + mobile apply
```

---

## Validation inventory

### Already in `@enagar/forms` (engine)

| Rule                      | Schema field(s)                 | `validateSubmission`   | Builder UI today                      |
| ------------------------- | ------------------------------- | ---------------------- | ------------------------------------- |
| Required                  | `required`                      | ✅ visible fields only | ✅ Phase 2 inspector                  |
| Text length               | `min_length`, `max_length`      | ✅                     | ✅ Phase 2 inspector                  |
| Text regex                | `pattern`                       | ✅                     | ✅ Phase 2 inspector                  |
| Number range              | `min`, `max`                    | ✅                     | ✅ Phase 2 inspector                  |
| Date format               | —                               | ✅ `YYYY-MM-DD`        | —                                     |
| Date range                | `min_date`, `max_date`          | ✅                     | ✅ Phase 2 inspector + Phase 3 submit |
| Choice enum               | `options`                       | ✅                     | ✅ Phase 2 inspector                  |
| File MIME / size          | `accept`, `max_size_mb`         | ✅                     | ✅ Phase 2 inspector                  |
| Conditional visibility    | `show_if` (see semantics below) | ✅ skips hidden fields | ✅ Phase 2 inspector                  |
| Cross-field compare       | —                               | ✅                     | ✅ Phase 6                            |
| Multi-value OR visibility | —                               | ✅                     | ✅ Phase 6 (`show_if.equals_any`)     |

**Reference:** `packages/forms/src/index.ts` — `validateFormSchema`, `validateSubmission`, `isFieldVisible`.

**Live conditional example:** `trade-licence` → `fssai_certificate` with `show_if: { field: 'trade_type', equals: 'food' }`.

### Conditional visibility (`show_if`) semantics

Each field may have **at most one** `show_if` rule. The engine supports three condition kinds only:

| Kind                    | Schema                                | When it applies                                                                    | Controlling field type            |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| **Equals**              | `equals: string \| number \| boolean` | Controlling value **exactly matches** one value                                    | select, radio, text, number, etc. |
| **Includes one option** | `includes: string`                    | Controlling value is an **array** (multi-select) that contains **that one** option | **multiselect only**              |
| **Not empty**           | `not_empty: true`                     | Controlling field has any answer                                                   | any non-section field             |

**Not supported today (Phase 2 / current engine):**

- **“Includes any of food, retail, industrial”** on a single-choice field such as Trade Licence `trade_type` — use **Equals** with one value (e.g. `food`), or duplicate the dependent field per value (not ideal), or wait for Phase 6.
- **Multiple trigger values in one rule** (OR logic): e.g. show when `trade_type` is food **or** retail.
- **`includes` with several values** — `includes` stores a **single** string, not an array of alternatives.

**Trade Licence operator guidance:** `trade_type` is a **dropdown (single choice)**. For FSSAI certificate visibility, set **Equals one value → `food`**. Do **not** use “Includes one option (multi-select only)” — that condition only applies when the controlling field type is `multiselect`.

**Phase 6:** richer rules (e.g. `equals_any: ['food', 'retail']` or visibility entries on `cross_field_rules`) for OR / multi-value conditionals — see Phase 6 below. Until then, JSON cannot express OR visibility either; only the three kinds above are valid in `show_if`.

**Builder UI (Phase 2):** `FieldValidationInspector` offers **Equals one value**, **Includes one option (multi-select only)** (hidden unless controlling field is `multiselect`), and **Is not empty**, with inline help text.

### Gaps to close in EN-5

| Gap                                                                                                    | Phase |
| ------------------------------------------------------------------------------------------------------ | ----- |
| Citizen PWA does not pass `formValues` to `createRenderPlan` — conditional fields don’t show/hide live | 0 ✅  |
| Builder cannot author most validation without JSON                                                     | 2 ✅  |
| `min_date` / `max_date` typed but ignored at submit                                                    | 3 ✅  |
| Cross-field rules (e.g. end date > start date)                                                         | 6     |
| Multi-value OR visibility (e.g. show when `trade_type` is food **or** retail)                          | 6     |

### Out of scope (stay outside form schema)

- Holding lookup, fee calculation, document scan-clean gates (API / workflow).
- Dynamic dropdown options from external API (ward by borough) — future ticket after EN-5.
- Full JSON Schema `if/then/else` expression language.
- Multi-step wizard forms.

---

## Design decisions (locked)

| Decision             | Choice                                              | Rationale                                              |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Primary editor       | WYSIWYG (shared builder)                            | State + Tenant operators; JSON is backup               |
| Shared package       | `@enagar/forms/builder`                             | Single palette, inspector, preview for both portals    |
| Validation authoring | Part of builder Phase 2+                            | Avoid “visual labels only, JSON for rules”             |
| Cross-field rules    | New optional `cross_field_rules[]` on schema        | Simple compare ops; i18n messages; not full JSON Logic |
| JSON UX (State)      | Collapsed `JsonFallbackPanel` on builder page       | Matches State integrations pattern                     |
| JSON UX (Tenant)     | Keep existing draft JSON panel below visual builder | Already present; sync with shared state                |
| Preview values       | `{}` in builder preview                             | Same as citizen PWA (no prefill)                       |
| Preview conditional  | Pass preview `values` into `createRenderPlan`       | Tenant already does; State must too                    |
| State save           | Minimal PATCH `{ code, form_schema }`               | Avoid overwriting unrelated global metadata            |
| Tenant save          | Unchanged draft/publish API                         | Builder is UI-only swap                                |
| `service_code`       | Read-only in State builder                          | Must match global `code`                               |
| i18n                 | en / bn / hi on labels and rule messages            | Matches `@enagar/forms` locale maps                    |

### Proposed `cross_field_rules` shape (Phase 6)

```typescript
// packages/forms — concept for Phase 6
cross_field_rules?: Array<{
  id: string;
  left: string;           // field id
  op: 'gt_field' | 'gte_field' | 'lt_field' | 'lte_field' | 'eq_field';
  right: string;          // field id
  message?: LocaleMap;    // optional; default message if omitted
  when?: ShowIfRule;      // optional gate (same as show_if)
}>;
```

Evaluated in `validateSubmission()` after per-field checks. Validated in `validateFormSchema()` (field IDs exist, compatible types).

---

## Architecture

```text
packages/forms/src/
  index.ts                    # validateFormSchema, validateSubmission (extend Phases 3 + 6)
  builder/
    form-field-palette.ts
    form-builder-utils.ts
    FormSchemaBuilder.tsx       # palette + field list
    FieldValidationInspector.tsx  # Phase 2: per-field rules + show_if
    CrossFieldRulesPanel.tsx      # Phase 6
    FormCitizenPreview.tsx

apps/admin-tenant/.../service-designer-client.tsx
  → orchestration (draft save, publish, workflow) + @enagar/forms/builder

apps/admin-state/app/dashboard/library/[code]/form/
  page.tsx
  global-form-builder-client.tsx
    → fetch global row → FormSchemaBuilder → Save PATCH form_schema

apps/citizen-pwa/app/page.tsx
  → Phase 0: createRenderPlan(schema, { values: formValues, ... })
```

---

## Phase 0 — Citizen PWA live conditional fields

**Goal:** Conditional fields behave at apply time the same way they do in tenant preview.

**Deliverables**

1. In `apps/citizen-pwa/app/page.tsx`, pass `formValues` into `createRenderPlan(..., { values: formValues })`.
2. Include `formValues` in `useMemo` deps so `show_if` visibility updates as the citizen types.
3. Re-run `validateSubmission` on submit (already done) — hidden fields stay excluded.

**Exit criteria**

- [ ] `trade-licence` apply: FSSAI field appears when trade type = food, hidden for retail
- [ ] Hidden conditional fields not required on submit
- [ ] Contract or unit test where feasible

---

## Phase 1 — Extract shared builder package

**Goal:** Move visual builder UI out of tenant file; **no behaviour change yet** (validation inspector comes Phase 2).

**Extract from** `apps/admin-tenant/.../service-designer-client.tsx`:

- `FORM_FIELD_PALETTE`, drag-drop helpers, `FormVisualBuilder`, current `FieldInspector` (labels/required/options/file)
- `FormCitizenPreview` wrapper (preview aside)

**Deliverables**

1. `packages/forms/package.json` → `"./builder": "./src/builder/index.ts"`
2. Tenant designer imports `@enagar/forms/builder`
3. Tailwind `content` includes `packages/forms/src/**` in **admin-tenant** and **admin-state** (prep for Phase 4)

**Exit criteria**

- [ ] Tenant designer manual smoke unchanged (palette, save draft, publish)
- [ ] No duplicate palette in tenant file
- [ ] `pnpm --filter @enagar/admin-tenant typecheck`

---

## Phase 2 — Shared validation inspector (State + Tenant)

**Goal:** Author existing engine rules in WYSIWYG — **same UI in both portals**.

**Replace / extend** `FieldInspector` → `FieldValidationInspector` with sections by field type:

| Field type        | Inspector controls                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| text / textarea   | min/max length, pattern (with common presets e.g. mobile IN)                                                               |
| number            | min, max                                                                                                                   |
| date              | min_date, max_date (stored on schema; enforced after Phase 3)                                                              |
| all (non-section) | required, help text, **show_if** editor (equals / includes-one-option on multiselect / not empty — **not** multi-value OR) |
| choice            | options (existing)                                                                                                         |
| file              | accept, max_size_mb (existing)                                                                                             |

**Deliverables**

1. `FieldValidationInspector.tsx` in `@enagar/forms/builder`
2. Wire into **Tenant Admin** service designer (immediate value)
3. Wire into **State Admin** builder when Phase 4 lands (or in parallel if Phase 4 follows immediately)
4. Live `validateFormSchema` feedback in builder header (already partially present)

**Exit criteria**

- [x] Tenant: set mobile `pattern` and `min_length` without JSON
- [x] Tenant: add `show_if` on a file field (trade-licence style) visually
- [x] State builder (Phase 4): same inspector renders identical controls
- [x] Saved schema passes `validateFormSchema`; citizen submit passes `validateSubmission`

---

## Phase 3 — Date min/max enforcement

**Goal:** Close engine gap — schema fields already support `min_date` / `max_date`.

**Deliverables**

1. In `validateSubmissionValue` for `date`: enforce `min_date` / `max_date` when set
2. In `validateFormSchema`: validate date string format on min/max bounds
3. Extend `exportToJsonSchema` if needed for parity
4. Unit tests in `packages/forms/test/run-tests.mjs`

**Exit criteria**

- [x] `event_date` with `min_date: '2026-01-01'` rejects earlier values
- [x] Builder inspector (Phase 2) rules actually block bad submissions

---

## Phase 4 — State Admin WYSIWYG page + save

**Deliverables**

1. `apps/admin-state/package.json` — add `@enagar/forms`
2. Route: `app/dashboard/library/[code]/form/page.tsx`
3. `global-form-builder-client.tsx` — load global by `code`, embed `FormSchemaBuilder` + `FieldValidationInspector`
4. **Save template** → `validateFormSchema` → `PATCH { code, form_schema }`
5. `StateLibrarySection`: **Edit apply form** link; remove large inline JSON textarea (summary only)

**Exit criteria**

- [x] State curator edits `birth-cert` visually including validation rules
- [ ] `pnpm verify:en4` passes after save
- [ ] Onboard / tenant re-sync still copies rich template

---

## Phase 5 — Preview + JSON fallback UX

**Deliverables**

1. Shared `FormCitizenPreview`: `createRenderPlan(schema, { platform: 'web', values: previewValues })` + `DynamicFormFields`
2. Preview toolbar: toggle sample values for testing `show_if` (preview only — not citizen prefill)
3. **State:** collapsed `JsonFallbackPanel` on builder page; two-way sync with visual state
4. **Tenant:** ensure JSON draft textarea stays in sync with shared builder state (existing panel)

**Exit criteria**

- [x] Preview updates when validation/visibility rules change
- [x] State curator completes edit without opening JSON
- [x] JSON fallback paste of seed schema updates visual builder when valid

---

## Phase 6 — Cross-field rules + richer visibility (State + Tenant)

**Goal:** Submit-time compares between fields **and** visibility rules that today’s single-value `show_if` cannot express.

**Deliverables**

1. Add `cross_field_rules` to `EnagarFormSchema` in `@enagar/forms`
2. `validateFormSchema` — structural checks (field refs, allowed ops by type)
3. `validateSubmission` — evaluate rules after per-field validation; respect optional `when`
4. `CrossFieldRulesPanel` in builder — add/list/remove rules with localized messages
5. Wire panel in **Tenant Admin** and **State Admin** builder pages
6. JSON fallback can still author rules for power users
7. **Visibility extensions** (design in Phase 6) — e.g. `show_if.equals_any: string[]` or visibility rows on schema so operators can author **“show when field is any of …”** without duplicating fields. Not available in Phase 2 `show_if` (`includes` is **one** option on a **multiselect** controlling field only).

**Example rules**

- `event_end_date` must be **after** `event_start_date` (submit validation)
- `guest_count` must be **≤** `hall_capacity` (when capacity field exists)
- Show `extra_document` when `trade_type` is **any of** `food`, `retail` (visibility — **not** supported by current `show_if`; Phase 6)

**Exit criteria**

- [x] Unit tests for compare ops and gated `when`
- [x] Builder can add one cross-field rule without JSON
- [x] Builder can add one multi-value OR visibility rule without JSON (or documented `equals_any` shape)
- [x] Citizen PWA shows combined errors on submit; visibility OR rules hide/show fields live

---

## Phase 7 — Tests + verify

**Deliverables**

1. `tests/security/en5-shared-form-builder.spec.ts` (rename/extend from prior EN-5 sketch):
   - `@enagar/forms/builder` exports
   - State route + tenant import shared builder
   - `FieldValidationInspector` / `cross_field_rules` referenced
   - Citizen PWA passes `formValues` to `createRenderPlan`
2. `packages/forms` tests for date bounds + cross-field rules
3. Manual smoke scripts documented below

**Exit criteria**

- [x] `pnpm test:security -- en5-shared-form-builder`
- [x] `pnpm --filter @enagar/forms test` green
- [x] `pnpm verify:en5` runs automated suite (optional API smoke when stack is up)
- [ ] State + Tenant manual smokes pass (see checklists below; run before release)

**Automated verify**

```bash
pnpm verify:en5
# Skip live API check when stack is down:
EN5_SKIP_API=1 pnpm verify:en5
```

---

## Phase 8 — Docs + sign-off

- Update [`EN-5-state-global-form-builder.md`](../backlog/EN-5-state-global-form-builder.md) status
- Short validation section in [`state-tenant-onboarding.md`](./state-tenant-onboarding.md)
- Note in `packages/forms/README.md` — validation model + builder
- Mark progress tracker complete
- `graphify update .`

---

## Manual smoke checklists

### Tenant Admin

1. Open `trade-licence` (or any service) → Configure
2. Add text field with min length + mobile pattern via inspector (no JSON)
3. Add conditional file field with `show_if` via inspector — **Equals one value** for single-choice fields (e.g. `trade_type` → `food`); do not use Includes unless controlling field is multiselect
4. Preview: toggle trade type — conditional field shows/hides
5. Save draft → Publish → Citizen apply reflects rules

### State Admin

1. Service library → `birth-cert` → **Edit apply form**
2. Edit fields + validation in shared builder
3. Save template → `pnpm verify:en4`
4. Tenant **Load State template** → publish → citizen rich form with rules

### Citizen PWA (Phase 0)

1. Apply for `trade-licence` → select **food** → FSSAI field visible
2. Switch to **retail** → FSSAI hidden; submit without FSSAI succeeds

---

## Risk register

| Risk                                | Mitigation                                                  |
| ----------------------------------- | ----------------------------------------------------------- |
| Duplicating builder in State        | Mandatory Phase 1 extraction                                |
| Tenant regression                   | Phase 1 gate before State page; tenant smoke in every phase |
| Validation UI drift between portals | Single `@enagar/forms/builder` — never fork inspector       |
| Cross-field rules too complex       | Phase 6 limited op set; JSON fallback for edge cases        |
| Tailwind purges builder classes     | Both apps include `packages/forms/src/**` in content        |
| State PATCH overwrites metadata     | Minimal `{ code, form_schema }` PATCH on builder page       |

---

## Key files

| Area                 | Path                                                    |
| -------------------- | ------------------------------------------------------- |
| Form engine          | `packages/forms/src/index.ts`                           |
| Shared builder (new) | `packages/forms/src/builder/`                           |
| Tenant designer      | `apps/admin-tenant/.../service-designer-client.tsx`     |
| State builder (new)  | `apps/admin-state/app/dashboard/library/[code]/form/`   |
| Citizen apply        | `apps/citizen-pwa/app/page.tsx`                         |
| State library list   | `apps/admin-state/components/state-config-sections.tsx` |
| Seed / fixtures      | `packages/forms/src/fixtures.ts` (`show_if` example)    |

---

_Last updated: 2026-05-27 — Phase 7 done: `verify:en5`, extended security contract, forms unit tests for cross-field + equals_any._
