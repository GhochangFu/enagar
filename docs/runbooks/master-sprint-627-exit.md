# Master Sprint 6.27 Exit — Virus scan pipeline & citizen download

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.

## Delivered (engineering)

- `services/document-scan-worker` — BullMQ consumer on queue `document-scan`; fetches MinIO object; stub/EICAR verdict; updates `application_documents`.
- API `DocumentScanQueueService` — enqueues on `confirm-upload` when `ALLOW_CLIENT_SCAN_SIMULATION` is not `true`.
- `POST /documents/:id/scan-result` — **403** for citizens when simulation disabled (worker-only).
- `GET /documents/:id` — poll `scan_status` (`pending` / `processing` / `clean` / …).
- `GET /documents/:id/download` — presigned GET when clean + object `head` OK.
- Upload-intent rate limit (`DOCUMENT_UPLOAD_INTENT_LIMIT_PER_HOUR`, default 30).
- Migration: `scan_status` includes **`processing`**.
- PWA: `waitForDocumentScan` or simulation path; **Download** on application detail when clean.
- Mobile: worker poll or `EXPO_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION`.
- Optional Compose profile **`clamav`**; `tests/security/master-sprint-627.spec.ts`.

## Exit criteria

- [x] `pnpm --filter @enagar/api typecheck`
- [x] `pnpm --filter @enagar/api test`
- [x] `pnpm test:security -- --runTestsByPath tests/security/master-sprint-627.spec.ts`
- [x] `pnpm --filter @enagar/document-scan-worker test`
- [ ] Manual: EICAR → infected/blocked; clean file → submit → download _(local: worker + MinIO)_

## Local run (queue mode)

1. `infrastructure/.env`: `REDIS_URL`, `ALLOW_CLIENT_SCAN_SIMULATION=false` (or unset), `OBJECT_STORAGE_DISABLED=false`.
2. `pnpm infra:up` · `pnpm --filter @enagar/api prisma:migrate:deploy`
3. Terminal A: `pnpm --filter @enagar/api dev`
4. Terminal B: `pnpm --filter @enagar/document-scan-worker dev`
5. Apply flow on PWA (`NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION` unset) — upload waits for worker; detail panel **Download** when clean.

**Fast local dev (simulation):** `ALLOW_CLIENT_SCAN_SIMULATION=true` + `NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION=true` — client `scan-result` unchanged from 6.26.

## Sign-off

| Role        | Notes                                          | Date           |
| ----------- | ---------------------------------------------- | -------------- |
| Engineering | CI + worker package; queue guard + download UX | **2026-05-21** |
