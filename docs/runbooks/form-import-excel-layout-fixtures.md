# Form import — Excel layout fixtures (EN-50)

Parent: [form-import.md](./form-import.md) · Policy: [ADR-0015](../ADRs/ADR-0015-excel-layout-heuristic-import.md) · Ticket: [EN-50](../backlog/EN-50-excel-layout-form-import.md)

These workbooks simulate **real ULB “Excel forms”** — not the structured column template in [form-import-excel-template.md](./form-import-excel-template.md). They are used to test and demo the **layout heuristic extractor** (EN-50).

## Files

| Fixture                              | Sheet intent               | Expected proposal (EN-50)                          |
| ------------------------------------ | -------------------------- | -------------------------------------------------- |
| `birth-certificate-layout-form.xlsx` | Single “Application” sheet | Section + name, DOB, gender fields                 |
| `trade-licence-grid-form.xlsx`       | Noisy grid with blanks     | Business section, trade name, trade type, turnover |

Committed path: `apps/api/test/fixtures/form-import/`

## `birth-certificate-layout-form.xlsx` layout

```text
     A                          B
1    Birth Certificate Application   (merged A1:C1)
2    (blank)
3    Applicant details               (section heading)
4    Applicant name:
5    Date of birth:
6    Gender:   ☐ Male   ☐ Female   ☐ Other
```

**Expected inference (approximate):**

| Row | Label             | Type      | Confidence cap |
| --- | ----------------- | --------- | -------------- |
| 3   | Applicant details | `section` | 0.68           |
| 4   | Applicant name    | `text`    | 0.70           |
| 5   | Date of birth     | `date`    | 0.75           |
| 6   | Gender            | `radio`   | 0.80           |

## `trade-licence-grid-form.xlsx` layout

```text
     A                          B
1    Trade Licence Application       (merged A1:D1)
2    (blank)
3    (blank)
4    Business details                (section)
5    Trade name:
6    (blank noise row)
7    Trade type:   ☐ Retail   ☐ Food   ☐ Services
8    Annual turnover (INR):
9    Supporting document (attach):
```

**Expected inference:**

| Row | Label                        | Type      | Notes                      |
| --- | ---------------------------- | --------- | -------------------------- |
| 4   | Business details             | `section` |                            |
| 5   | Trade name                   | `text`    |                            |
| 7   | Trade type                   | `radio`   | Options from checkbox text |
| 8   | Annual turnover (INR)        | `number`  | Keyword `INR`              |
| 9   | Supporting document (attach) | `file`    | Low confidence             |

## Regenerate

```bash
pnpm --filter @enagar/api run fixtures:form-import
```

Source: `apps/api/scripts/generate-form-import-fixtures.mjs`

## Manual test (post EN-50)

1. Upload layout fixture on Tenant Service Designer.
2. Expect `extraction_mode: layout` and review banner.
3. Edit/reject low-confidence rows before Apply.
4. Confirm structured templates still import via table mode (regression).

## Not covered (future)

- Multiple worksheets (sheet picker — EN-51)
- Embedded images of paper forms
- Repeating row tables (repeater field type)
