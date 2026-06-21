# Form import — PDF (EN-39–EN-42)

Parent: [form-import.md](./form-import.md) · Policy: [ADR-0014](../ADRs/ADR-0014-form-import-product-decisions.md)

Phase 3 adds PDF import with four extraction modes, tried in order:

| Order | Mode                    | Ticket | Confidence | Notes                                |
| ----- | ----------------------- | ------ | ---------- | ------------------------------------ |
| 1     | AcroForm fields         | EN-39  | ~0.88      | Fillable PDF with named fields       |
| 2     | Digital text heuristics | EN-40  | 0.68–0.78  | Typed PDF labels (`Applicant name:`) |
| 3     | Basic OCR               | EN-42  | ≤0.72      | Scanned typed PDFs (first page OCR)  |
| —     | Handwritten gate        | EN-41  | blocked    | Empty/low OCR → rejection message    |

## Sample fixtures

Path: `apps/api/test/fixtures/form-import/`

| File                                 | Mode                         |
| ------------------------------------ | ---------------------------- |
| `birth-certificate-acroform.pdf`     | AcroForm                     |
| `birth-certificate-digital-text.pdf` | Digital text                 |
| `handwritten-scan-placeholder.pdf`   | EN-41 rejection (blank scan) |

Regenerate:

```bash
pnpm --filter @enagar/api run fixtures:form-import
```

## Operator notes

- Review wizard shows **warnings** for digital-text and OCR imports.
- **Apply** stays blocked when EN-41 handwritten rejection applies (ADR-0014 message).
- AcroForm field names become `field_id` slugs; edit in review if needed.

## Limitations

- OCR: first page only, English (`eng`), no LLM vision
- Handwritten cursive scans rejected (EN-41)
- No auto `show_if` / cross-field rules from PDF
