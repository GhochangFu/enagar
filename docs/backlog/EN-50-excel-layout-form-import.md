# EN-50 — Excel layout heuristic import

**Type:** Follow-up to **EN-26 Phase 1** (EN-30–EN-36 structured Excel MVP)  
**Status:** Backlog  
**Parent:** [EN-26](https://ghochangfu.atlassian.net/browse/EN-26) · **Jira:** [EN-50](https://ghochangfu.atlassian.net/browse/EN-50)  
**Policy:** [ADR-0015](../ADRs/ADR-0015-excel-layout-heuristic-import.md)  
**Portals:** Tenant Admin + State Admin (no new UI; extend `FormImportPanel` banner)  
**API:** Same form-import routes; extend Excel extractor only

---

## Problem

Phase 1 sample fixtures (`birth-certificate-template.xlsx`, `trade-licence-template.xlsx`) are **admin column templates**. ULB operators typically upload **layout workbooks**: labels in column A, blanks in column B, merged titles, checkbox characters, no `field_id` or `type` columns.

Today those uploads fail at extraction with `Missing required column: field_id`. Operators must manually re-type into the structured template or build fields in the visual designer.

---

## Goal

Accept common “Excel form” layouts, propose fields with **lower confidence**, and route operators through the **existing review wizard** before Apply — without changing replace-draft, draft-only, or publish behaviour (ADR-0014).

---

## Scope

### In scope

- Auto-detect **table vs layout** mode on upload
- Layout heuristics: label/input pairs, sections, date/number/file keywords, checkbox glyphs, Excel validation lists
- Generate `field_id` slugs from labels (editable in review)
- `extraction_mode` on import job response
- Layout banner in `FormImportPanel`
- Fixtures + unit/API tests (see Acceptance criteria)
- Operator runbook for layout fixtures

### Out of scope

- Scanned images embedded in sheets
- Repeating sub-grids / table field type
- Auto `show_if` / cross-field rules
- Multi-sheet picker (defer EN-51)
- Bengali/Hindi inference from layout labels

---

## Implementation notes

```text
upload .xlsx
    → ExcelFormImportExtractor
        ├── table mode (EN-31)     → confidence ~0.95
        └── layout mode (EN-50)    → confidence 0.68–0.80
    → FormImportService (unchanged job contract)
    → FormImportPanel review → Apply → Save draft / Publish
```

Suggested files:

| Area          | Path                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Layout parser | `apps/api/src/modules/form-import/extractors/excel-layout-form-import.extractor.ts`                        |
| Mode router   | extend `excel-form-import.extractor.ts` or `form-import.service.ts`                                        |
| Types         | `packages/forms/src/form-import/types.ts` — add `extraction_mode`                                          |
| UI banner     | `packages/forms/src/form-import-ui/FormImportPanel.tsx`                                                    |
| Tests         | `apps/api/src/modules/form-import/extractors/*.spec.ts`, `tests/security/en50-excel-layout-import.spec.ts` |

---

## Acceptance criteria

### AC1 — Table mode unchanged

- [ ] Uploading `birth-certificate-template.xlsx` still uses table mode, confidence ≥ 0.90 on all fields, Apply succeeds after review.

### AC2 — Layout mode detection

- [ ] Uploading `birth-certificate-layout-form.xlsx` does **not** require `field_id` column.
- [ ] Job status is `ready_for_review` with `extraction_mode: "layout"`.
- [ ] Proposal includes at least: section “Applicant details”, fields `applicant_name`, `date_of_birth`, `gender` (types may be inferred).

### AC3 — Noisy grid fixture

- [ ] Uploading `trade-licence-grid-form.xlsx` produces ≥ 4 field candidates despite blank rows and merged title row.
- [ ] `trade_type` (or equivalent slug) inferred as `select` or `radio` when checkbox/option row present.

### AC4 — Confidence gates

- [ ] No layout-inferred field has confidence > 0.80.
- [ ] At least one field on layout fixtures has confidence in [0.65, 0.85) and shows **warning** badge in UI.
- [ ] Apply blocked if operator accepts only fields all below 0.65 or overall mean < 0.50 (ADR-0014).

### AC5 — Operator transparency

- [ ] Tenant and State import panels show layout-mode banner when `extraction_mode === "layout"`.
- [ ] Operator can edit labels, change types, reject rows, reorder — same as Phase 1.

### AC6 — Apply semantics unchanged

- [ ] Apply replaces entire draft `fields` array (ADR-0014).
- [ ] Import never auto-publishes.

### AC7 — Negative cases

- [ ] Empty sheet → failed job with clear message (not 500).
- [ ] Sheet with only a title and no inputs → failed or zero-field proposal with Apply blocked.
- [ ] Structured template missing `label_en` still fails in table mode with existing error.

### AC8 — Tests

- [ ] Unit tests for layout extractor using committed fixtures.
- [ ] Security smoke: tenant upload layout fixture → GET job → proposal shape.
- [ ] CI runs `pnpm --filter @enagar/api test` green.

---

## Sample fixtures (“messy Excel forms”)

| File                                 | Purpose                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `birth-certificate-layout-form.xlsx` | Title merge, section row, label/input pairs, gender checkbox row   |
| `trade-licence-grid-form.xlsx`       | Business section, trade name/type rows, turnover, extra blank rows |

Regenerate:

```bash
pnpm --filter @enagar/api run fixtures:form-import
```

Spec: [form-import-excel-layout-fixtures.md](../runbooks/form-import-excel-layout-fixtures.md)

---

## Manual smoke (after implementation)

1. Tenant Admin → Service Designer → Import `birth-certificate-layout-form.xlsx`.
2. Confirm layout banner + warning badges on inferred fields.
3. Fix one field type in review → Apply → Save draft → verify preview.
4. Repeat on State Admin Global Form Builder.
5. Confirm structured template import still works (regression).

---

## Dependencies

- EN-26 Phase 1 merged (EN-30–EN-36)
- ADR-0015 accepted

## Estimate

**M** (3–5 dev days): extractor + tests + UI banner + docs

## Links

- [ADR-0015](../ADRs/ADR-0015-excel-layout-heuristic-import.md)
- [form-import operator guide](../runbooks/form-import.md)
- [Structured Excel template](../runbooks/form-import-excel-template.md)
