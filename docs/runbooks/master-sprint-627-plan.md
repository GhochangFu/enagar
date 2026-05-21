# Master Sprint 6.27 Plan — Virus scan pipeline & citizen download

**Status:** **Closed — engineering** (2026-05-21) · [`master-sprint-627-exit.md`](./master-sprint-627-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)  
**Depends on:** [**6.26 closed**](./master-sprint-626-exit.md)

## Objective

Replace client-trusted `scan-result` with a **BullMQ document-scan worker** (ClamAV optional, dev stub), enforce submit until **worker-clean**, and expose **citizen download** when scan-clean.

## Deliverables

1. `services/document-scan-worker` — BullMQ consumer, MinIO fetch, stub/EICAR/optional ClamAV.
2. API `DocumentScanQueueService` — enqueue on `confirm-upload`; guard `POST scan-result` unless `ALLOW_CLIENT_SCAN_SIMULATION=true`.
3. `GET /documents/:id` — poll scan status; existing `GET …/download` when clean + object exists.
4. Upload-intent rate limit per application per hour.
5. Citizen PWA + mobile — poll until clean (or simulation path); download button on detail.
6. Docker Compose **`clamav`** profile (optional); env in `infrastructure/.env.example`.
7. `tests/security/master-sprint-627.spec.ts` + `master-sprint-627-exit.md`.

## Verification

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/document-scan-worker typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-627.spec.ts
```
