# Form import — operator guide (Phase 0 contract)

Parent epic: [EN-26](https://ghochangfu.atlassian.net/browse/EN-26). Product defaults: [ADR-0014](../ADRs/ADR-0014-form-import-product-decisions.md).

## Portals

| Portal       | Surface             | API prefix (Phase 0 stub)                                           |
| ------------ | ------------------- | ------------------------------------------------------------------- |
| Tenant Admin | Service Designer    | `POST/GET …/admin/tenant/services/:serviceId/form-import/…`         |
| State Admin  | Global Form Builder | `POST/GET …/admin/state/global-service-library/:code/form-import/…` |

Extractors and UI land in EN-30+. Phase 0 locks decisions, shared types, and HTTP contract only.

## Apply behaviour (EN-27)

1. **Replace** — Apply replaces all draft `fields` with accepted import candidates.
2. **Draft only** — Never auto-publishes; re-import on a published service edits/creates draft.
3. **Confidence** — Block Apply when overall &lt; 0.50 or any accepted field &lt; 0.65; warn below 0.85.
4. **Audit** — Source file stored on import job (draft link is MVP+ / EN-46).
5. **Locales** — Excel may include `label_bn` / `label_hi`; otherwise English is copied to bn/hi.

## Supported sources (roadmap)

| Phase | Format                           | Status                                                                                                                           |
| ----- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 4     | Async queue + object storage     | EN-43–EN-45 (shipped) — `form-import` BullMQ worker when `REDIS_URL` + MinIO enabled; inline fallback in dev/CI                  |
| 1     | Excel column template `.xlsx`    | EN-30+ (shipped)                                                                                                                 |
| 2     | Word table template `.docx`      | EN-37+ (shipped)                                                                                                                 |
| 1b    | Excel layout / grid form `.xlsx` | [EN-50](https://ghochangfu.atlassian.net/browse/EN-50) (backlog) — [ADR-0015](../ADRs/ADR-0015-excel-layout-heuristic-import.md) |
| 3     | PDF (AcroForm / digital / OCR)   | EN-39+ (shipped)                                                                                                                 |

Handwritten scans are rejected (EN-41).

## Async processing (EN-43–EN-45)

1. API stores the uploaded source file in object storage (`source_storage_key` on the job).
2. Job row is created in Postgres (`form_import_jobs`) with status `pending`.
3. When `REDIS_URL` is set and `OBJECT_STORAGE_DISABLED` is not `true`, the API enqueues BullMQ job `form-import` and returns `pending`; run `pnpm --filter @enagar/form-import-worker dev` to process.
4. Otherwise (typical local dev / CI), the API processes inline and returns `completed` / `rejected` on the POST response.
5. Portals poll `GET …/form-import/:jobId` while status is `pending` or `processing`.

Object key prefixes:

| Scope  | Prefix                               |
| ------ | ------------------------------------ |
| Tenant | `tenants/{tenantCode}/form-import/…` |
| State  | `state/form-import/{serviceCode}/…`  |

- Structured Excel template: [form-import-excel-template.md](./form-import-excel-template.md)
- Structured Word template: [form-import-word-template.md](./form-import-word-template.md)
- PDF import modes: [form-import-pdf.md](./form-import-pdf.md)
- Layout-style fixtures (messy ULB forms): [form-import-excel-layout-fixtures.md](./form-import-excel-layout-fixtures.md)

## Explicitly out of scope (EN-26)

Auto-publish, auto `show_if` / cross-field rules, separate import studio, table/repeater field type, LLM vision OCR, Word/PDF auto-translation.
