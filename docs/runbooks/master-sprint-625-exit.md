# Master Sprint 6.25 Exit — Object storage platform foundation

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.

## Delivered (engineering)

- `apps/api/src/common/object-storage/` — config loader, `ObjectStorageService`, global `ObjectStorageModule`.
- Presigned PUT/GET when `OBJECT_STORAGE_DISABLED=false` and MinIO credentials are set; `minio://` stubs otherwise.
- `POST /api/documents/:id/confirm-upload` — marks `upload_status: uploaded`; `headObject` when storage enabled.
- Documents, grievances evidence intents, and desk grievance `download_url` / blob preview use the adapter.
- `infrastructure/.env.example` object-storage block; `pnpm infra:minio-cors`.
- `tests/security/master-sprint-625.spec.ts`.

## Exit criteria

- [x] `pnpm --filter @enagar/api typecheck`
- [x] `pnpm --filter @enagar/api test`
- [x] `pnpm test:security -- --runTestsByPath tests/security/master-sprint-625.spec.ts`
- [x] Optional: `RUN_STORAGE_TESTS=1` integration PUT/head against local MinIO _(skipped in CI; local bucket verified)_
- [x] Manual: `OBJECT_STORAGE_DISABLED=false`, `pnpm infra:up`, `pnpm infra:minio-cors` — bucket **`enagar-local`** exists; global CORS via compose `MINIO_API_CORS_ALLOW_ORIGIN`

## Manual smoke (real MinIO)

1. Set `OBJECT_STORAGE_DISABLED=false` in `infrastructure/.env` (keep endpoint/credentials as example).
2. `pnpm infra:up` then `pnpm infra:minio-cors` (creates `enagar-local` bucket if missing, then CORS).
3. Start API: `pnpm --filter @enagar/api dev`.
4. `POST /api/documents/upload-intent` (authenticated) → copy `upload_url` → `curl -X PUT -T small.pdf "<upload_url>"`.
5. `POST /api/documents/{id}/confirm-upload` → `upload_status` is `uploaded`.
6. MinIO console (`http://localhost:9001`) shows object under `tenants/...`.

## Sign-off

| Role        | Notes                                | Date           |
| ----------- | ------------------------------------ | -------------- |
| Engineering | CI + MinIO bucket bootstrap verified | **2026-05-21** |
