# Form import — Word template (EN-37)

Parent: [form-import.md](./form-import.md) · Policy: [ADR-0014](../ADRs/ADR-0014-form-import-product-decisions.md)

Use a **Word table** with the same columns as the [Excel template](./form-import-excel-template.md). One row per field; first row is the header.

## Required columns

| Column     | Description                                   | Example          |
| ---------- | --------------------------------------------- | ---------------- |
| `field_id` | Stable lowercase id (`a-z`, digits, `_`, `-`) | `applicant_name` |
| `label_en` | English label shown to citizens               | `Applicant name` |
| `type`     | One of supported field types (see Excel spec) | `text`           |

## Optional columns

Same as Excel: `label_bn`, `label_hi`, `required`, `options`, `help_en`.

## Sample fixtures

Committed under `apps/api/test/fixtures/form-import/`:

- `birth-certificate-template.docx`
- `trade-licence-template.docx`

Regenerate:

```bash
pnpm --filter @enagar/api run fixtures:form-import
```

## Limitations (Word slice)

- Structured **table only** — freeform municipal Word forms without the column table are not supported yet (future heuristic slice).
- Confidence is **0.90** per field (Excel structured template uses 0.95).
- Same Apply / draft-only / replace semantics as ADR-0014.
