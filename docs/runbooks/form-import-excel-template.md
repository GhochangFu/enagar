# Form import — Excel template (EN-30)

Parent: [form-import.md](./form-import.md) · Policy: [ADR-0014](../ADRs/ADR-0014-form-import-product-decisions.md)

Use this column layout for **Tenant Admin** service forms and **State Admin** global templates. One row per field; first row is the header.

## Required columns

| Column     | Description                                   | Example          |
| ---------- | --------------------------------------------- | ---------------- |
| `field_id` | Stable lowercase id (`a-z`, digits, `_`, `-`) | `applicant_name` |
| `label_en` | English label shown to citizens               | `Applicant name` |
| `type`     | One of supported field types (see below)      | `text`           |

## Optional columns

| Column     | Description                                         | Example                               |
| ---------- | --------------------------------------------------- | ------------------------------------- |
| `label_bn` | Bengali label; copies `label_en` when blank         | `আবেদনকারীর নাম`                      |
| `label_hi` | Hindi label; copies `label_en` when blank           | `आवेदक का नाम`                        |
| `required` | `true` / `false` / `yes` / `no` / `1` / `0`         | `true`                                |
| `options`  | Pipe-separated choices for radio/select/multiselect | `yes\|no` or `a:Option A\|b:Option B` |
| `help_en`  | English help text                                   | `As on Aadhaar card`                  |

## Supported `type` values

`text`, `textarea`, `number`, `date`, `radio`, `select`, `multiselect`, `file`, `section`

## Sample fixtures

Committed under `apps/api/test/fixtures/form-import/`:

- `birth-certificate-template.xlsx` — minimal apply form
- `trade-licence-template.xlsx` — sections + choice field

Regenerate after editing row data:

```bash
pnpm --filter @enagar/api run fixtures:form-import
```

## Limitations (Excel slice)

- No `show_if`, cross-field rules, or workflow linkage from Excel
- Import **replaces** draft fields on Apply (does not merge-append)
- Save draft / Publish unchanged after Apply
