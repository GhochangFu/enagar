# Form import — operator guide (EN-49)

Parent epic: [EN-26](https://ghochangfu.atlassian.net/browse/EN-26). Technical runbook: [form-import.md](./form-import.md).

This guide is for **portal operators** (not developers). It covers both admin portals.

## Where to find it

| Portal                 | Path                                                         | Who                                            |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| **Tenant Admin** (ULB) | Service Designer → open a service → **Import form** panel    | Municipality staff configuring a local service |
| **State Admin**        | Global Form Builder → open a service → **Import form** panel | State curators building the standard template  |

Import always targets the **draft** form. Nothing is auto-published.

## Supported file types

| File                          | When to use                                                      | Notes                                                                      |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Excel `.xlsx` (column table)  | You already have a spreadsheet with one row per field            | Best accuracy; see [Excel template guide](./form-import-excel-template.md) |
| Excel `.xlsx` (layout / grid) | Your ULB form is a printable grid (labels in cells, not a table) | System shows a **layout import** banner; review carefully                  |
| Word `.docx` (table)          | Form is a Word table with field rows                             | See [Word template guide](./form-import-word-template.md)                  |
| PDF (AcroForm)                | PDF has fillable form fields                                     | Highest PDF accuracy                                                       |
| PDF (digital text)            | PDF is typed text (no form fields)                               | Labels inferred from text; review required                                 |
| Handwritten scan              | —                                                                | **Rejected** — type or digitise the form first                             |

## Step-by-step (both portals)

1. Open the service in the form builder (Tenant: Service Catalogue → service; State: Service library → form builder).
2. Scroll to **Import form** (or open the import panel if collapsed).
3. Click **Choose file** and select `.xlsx`, `.docx`, or `.pdf`.
4. Click **Upload and analyse**.
5. Wait for status **Completed** (large files may show **Pending** — the page refreshes automatically).
6. Review the **proposal** table: field key, label, type, confidence.
7. Uncheck any wrong rows; edit labels in the review panel if needed.
8. Click **Apply to draft** when satisfied.
9. Open the form builder and fix anything the import missed (sections, conditional rules, Bangla/Hindi labels).
10. **Save** and **Publish** only after manual review — import never publishes for you.

## Confidence and Apply rules

- **Blocked:** overall confidence below 50%, or any accepted field below 65%.
- **Warning:** overall below 85% — you may Apply but must review every field.
- **Replace mode:** Apply replaces all draft fields with accepted import rows (does not merge with old fields).

## Layout Excel (EN-50)

If the upload is detected as a **layout-style** spreadsheet (grid form, not a column template):

- A yellow banner explains that field order and types are **best-effort**.
- Always compare against your paper/PDF form before Apply.
- Prefer a column template when you can prepare one — it is more accurate.

## PDF tips

- **AcroForm PDF:** export from software that creates real form fields (not a flat scan).
- **Digital text PDF:** works for typed certificates; not for handwriting or low-quality scans.
- If upload is **rejected** with a handwritten-scan message, recreate the form in Excel or Word instead.

## After import

- Source file is stored on the import **job** for audit (`source_storage_key`). There is no separate “view source file” link on the draft form yet (EN-46 deferred).
- Re-importing on a published service creates or updates a **draft** only.
- Locales: Excel may include `label_bn` / `label_hi` columns; otherwise English is copied to Bangla and Hindi placeholders — update them in the builder.

## Common problems

| Problem                                 | What to do                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Upload stays **Pending** long time      | Ask IT to confirm Redis + form-import worker are running (production). In local dev, retry — small files usually complete inline. |
| **Rejected** — empty or unreadable file | Check file is not password-protected; re-save as `.xlsx` / `.docx` / PDF.                                                         |
| **Rejected** — handwritten PDF          | Use Excel column template or retype in the form builder.                                                                          |
| Apply button disabled                   | Low confidence — add/fix rows in the source file or manually add fields in the builder.                                           |
| Wrong field types after layout Excel    | Normal for grid forms — change types in the builder after Apply.                                                                  |
| Import panel missing                    | Your role may lack form-builder permission; contact ULB/state admin.                                                              |

## Related docs

- [form-import.md](./form-import.md) — API contract, async queue, storage prefixes
- [form-import-excel-template.md](./form-import-excel-template.md)
- [form-import-word-template.md](./form-import-word-template.md)
- [form-import-pdf.md](./form-import-pdf.md)
- [form-import-excel-layout-fixtures.md](./form-import-excel-layout-fixtures.md)

In-app help: footer **Operator help** → **Importing a form from Excel, Word, or PDF** (Tenant and State manuals).
