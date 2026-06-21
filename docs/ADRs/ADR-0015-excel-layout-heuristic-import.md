# ADR-0015 — Excel layout heuristic import (EN-50)

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Status**          | Proposed (2026-06-21)                                                        |
| **Date**            | 2026-06-21                                                                   |
| **Decision-makers** | Project Technical Lead (engineering default pending sponsor override)        |
| **Related**         | EN-26, EN-50, ADR-0014, `docs/runbooks/form-import-excel-layout-fixtures.md` |

## Context

Phase 1 Excel import (EN-30–EN-36) accepts only a **column table** with required headers `field_id`, `label_en`, and `type`. ULB staff often upload **layout-style workbooks**: labels in one column, blank input cells beside them, merged title rows, checkbox glyphs, and no explicit field types.

Uploading such files today fails fast (`Missing required column: field_id`) before the review wizard. ADR-0014 already defines confidence gates and human review for low-trust proposals; this ADR extends Excel import with a second extractor mode without changing Apply, publish, or replace semantics.

## Decision

### 1. Dual-mode Excel extraction — auto-detect table vs layout

The Excel extractor tries modes in order:

1. **Table mode** (existing EN-31 behaviour) — when the first header row contains `field_id`, `label_en`, and `type` (case-insensitive, trimmed).
2. **Layout mode** (EN-50) — when table mode does not match; scan the active sheet for label/input pairs and section headings.

The API response includes `extraction_mode: "table" | "layout"` on the import job for operator transparency. No new HTTP routes.

### 2. Layout heuristics (MVP scope)

| Signal                                                                         | Inferred `type`          | Notes                           |
| ------------------------------------------------------------------------------ | ------------------------ | ------------------------------- |
| Label cell + adjacent empty cell (same row)                                    | `text`                   | Default when no stronger signal |
| Label contains `date`, `dob`, `birth` + date pattern in adjacent cell or label | `date`                   | Confidence capped at 0.75       |
| Adjacent cell has Excel date number format                                     | `date`                   |                                 |
| Label or adjacent area contains `☐` / `☑` / `[ ]`                              | `radio` or `multiselect` | Parse option text after glyphs  |
| Adjacent cell has data validation list                                         | `select`                 | Options from validation source  |
| Merged row spanning ≥2 columns, short text, no input neighbour                 | `section`                |                                 |
| Label suggests amount / turnover / `INR` / `#`                                 | `number`                 |                                 |
| Label suggests upload / attach / document                                      | `file`                   | Low confidence (0.65)           |

**Out of scope for EN-50:** merged multi-field rows, repeating table grids, images of paper forms, cross-sheet references, auto `show_if`.

### 3. Generated identifiers and labels

- **`field_id`:** slug from English label (`applicant_name`, deduped with `_2` suffix). Operator may edit in review; slug rules unchanged from EN-30.
- **`label_en`:** trimmed label text with trailing `:` removed.
- **`label_bn` / `label_hi`:** not inferred in EN-50; `completeLocaleMap` copies English (ADR-0014).

### 4. Confidence — layout proposals are lower trust

Reuse `FORM_IMPORT_POLICY` thresholds from ADR-0014. Layout mode adds **mode-specific caps**:

| Field signal strength                           | Max confidence |
| ----------------------------------------------- | -------------- |
| Table mode (EN-31)                              | 0.95           |
| Layout: validation list / explicit checkbox row | 0.80           |
| Layout: keyword type guess (date, number, file) | 0.75           |
| Layout: default text pair                       | 0.70           |
| Layout: section heading only                    | 0.68           |

Overall job confidence remains the mean of **accepted** field confidences. Fields below **0.65** cannot be accepted without manual override in review (existing UI). Apply remains blocked below **0.50** overall.

### 5. Operator UX — same review wizard

No new portal surfaces. `FormImportPanel` shows:

- Banner when `extraction_mode === "layout"`: “Detected Excel form layout — check field types before Apply.”
- Existing per-field confidence badges and reject/edit flows.

Apply still **replaces** draft fields; import never auto-publishes (ADR-0014 unchanged).

### 6. Fixtures and tests

Committed under `apps/api/test/fixtures/form-import/` (see runbook):

- `birth-certificate-layout-form.xlsx` — title row, label/input pairs, gender checkboxes
- `trade-licence-grid-form.xlsx` — section headings, select-like row, noise rows, no `field_id` column

Regenerate via `pnpm --filter @enagar/api run fixtures:form-import`.

## Alternatives considered

| Option                                          | Pros             | Cons                             | Rejected because             |
| ----------------------------------------------- | ---------------- | -------------------------------- | ---------------------------- |
| Force operators to re-type into column template | High accuracy    | High friction for ULBs           | Defeats import value         |
| LLM vision on sheet screenshot                  | Handles scans    | Cost, privacy, offline           | Out of EN-26 scope           |
| Merge layout + table in one pass                | Single code path | False positives on hybrid sheets | Sequential detect is simpler |
| Auto-Apply layout imports                       | Faster           | Violates confidence policy       | Blocked by ADR-0014          |

## Consequences

### Positive

- Real ULB Excel forms become first-class input without abandoning structured templates.
- Shared review wizard and policy constants; no fork of publish flow.

### Negative / costs

- Heuristic errors require operator time in review (mitigated by caps + reject).
- Hybrid workbooks (table on sheet 2, layout on sheet 1) need manual sheet selection in a later slice.

### Neutral / follow-ups

- EN-51 (optional): sheet picker when workbook has multiple candidate tabs.
- EN-40 PDF digital-text heuristics may share label/type inference helpers later.

## Compliance / verification

- Unit tests: layout extractor on committed fixtures; table mode regression unchanged.
- Security smoke: `tests/security/en50-excel-layout-import.spec.ts` (upload layout fixture → proposal → apply blocked/allowed per confidence).
- Operator docs: `docs/runbooks/form-import-excel-layout-fixtures.md`.

## References

- [ADR-0014](./ADR-0014-form-import-product-decisions.md)
- [EN-50 — Excel layout heuristic import](https://ghochangfu.atlassian.net/browse/EN-50)
- `docs/backlog/EN-50-excel-layout-form-import.md`
