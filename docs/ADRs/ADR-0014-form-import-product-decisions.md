# ADR-0014 — Form import product decisions (EN-26 / EN-27)

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **Status**          | Accepted (2026-06-21)                                                 |
| **Date**            | 2026-06-21                                                            |
| **Decision-makers** | Project Technical Lead (engineering default pending sponsor override) |
| **Related**         | EN-26, EN-27–EN-49, `@enagar/forms`, `docs/runbooks/form-import.md`   |

## Context

[EN-26](https://ghochangfu.atlassian.net/browse/EN-26) adds municipal form import (Excel → Word → PDF) into the existing Service Designer (**Tenant Admin**) and Global Form Builder (**State Admin**). Implementation must not fork validation or publish contracts. Five product questions were open before coding.

## Decision

### 1. Apply mode — **replace draft fields**

When an operator clicks **Apply to draft** after review, the import **replaces the entire `fields` array** in the current draft with accepted candidates (in review order). It does **not** merge-append alongside existing manual fields.

Rejected candidates are dropped. Section ordering follows the reviewed proposal order. Title, description, and `cross_field_rules` on the draft are preserved unless a later slice explicitly edits them.

**Rationale:** Replace matches the mental model of “this file defines the form” and mirrors `resyncFormDraftFromGlobal`. Merge-append creates duplicate IDs and ambiguous precedence.

### 2. Re-import policy — **draft only, never auto-publish**

Import always targets the **current draft** (`service_form_versions.status = draft` for tenant services; unpublished global template row for state library).

- If only a published form exists, import creates/updates a **new draft version** (same as manual edit).
- Import **never** publishes or retires published versions.
- Operators must still run existing **Save draft** / **Publish** flows.

### 3. Confidence gates — block Apply below thresholds

Constants live in `@enagar/forms/form-import` as `FORM_IMPORT_POLICY`:

| Gate                          | Threshold  | Effect                                     |
| ----------------------------- | ---------- | ------------------------------------------ |
| Overall proposal confidence   | **≥ 0.50** | Block Apply; show rejection reason         |
| Per accepted field confidence | **≥ 0.65** | Block Apply until field rejected or fixed  |
| Field warning badge           | **< 0.85** | Warn in review UI; Apply allowed if ≥ 0.65 |
| Handwritten / no structure    | —          | Block Apply (Slice 3; message in EN-41)    |

Overall confidence is the arithmetic mean of **accepted** field confidences (empty accepted set → 0).

### 4. Source-file audit — **job record in MVP; draft metadata in MVP+**

- **MVP (Phase 0–1):** Store source file reference on the **import job** (`source_storage_key`, filename, MIME). Jobs are tenant-scoped or state-scoped.
- **MVP+ (EN-46):** Optional link on draft metadata (`import_source` on form version / global template) for “imported from …” in the designer.

Do not block Phase 1 Excel demo on draft metadata.

### 5. Bengali / Hindi — **optional Excel columns in MVP**

Excel template supports optional `label_bn` and `label_hi` columns (alongside required `label_en`). When omitted, `@enagar/forms` `completeLocaleMap` copies English into `bn` and `hi` (same as manual builder).

Word/PDF auto-translation remains **out of scope** for EN-26; operators edit labels in the review wizard.

## Alternatives considered

| Option                        | Pros                     | Cons                          | Rejected because              |
| ----------------------------- | ------------------------ | ----------------------------- | ----------------------------- |
| Merge-append on Apply         | Keeps manual fields      | Duplicate IDs, unclear UX     | Replace is simpler and safer  |
| Auto-publish after import     | Faster go-live           | Bypasses review/publish gates | Violates existing workflow    |
| Single 0.80 overall threshold | Simple                   | Hides weak individual fields  | Per-field gate catches errors |
| Draft metadata audit in MVP   | Traceability in designer | Needs schema migration        | Deferred to EN-46             |
| bn/hi only post-MVP           | Smaller Excel template   | West Bengal pilots need bn    | Optional columns are low cost |

## Consequences

### Positive

- Shared policy constants consumed by API, worker, and both admin portals.
- Replace + draft-only aligns with existing designer and publish flows.
- Optional locale columns unblock bn/hi without translation services.

### Negative / costs

- Operators lose manual fields not present in the import file when applying (mitigated by review + Save draft before import).
- Low-confidence PDFs remain blocked until Slice 3 heuristics land.

### Neutral / follow-ups

- EN-28 implements HTTP contract; EN-29 shared types; EN-32 wires Excel extractor.
- EN-46 adds draft metadata audit if sponsor confirms.

## Compliance / verification

- `FORM_IMPORT_POLICY` exported from `@enagar/forms/form-import`; API DTOs reference the same status/confidence enums.
- `tests/security/en26-form-import-phase0.spec.ts` guards route + export contracts.
- Operator runbook: `docs/runbooks/form-import.md`.

## References

- [EN-26 parent ticket](https://ghochangfu.atlassian.net/browse/EN-26)
- `docs/runbooks/en5-state-global-form-builder-plan.md`
- `packages/forms/src/form-import/policy.ts`
