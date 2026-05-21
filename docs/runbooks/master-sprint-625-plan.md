# Master Sprint 6.25 Plan — Object storage platform foundation

**Status:** **Closed** (engineering) · 2026-05-21 — exit: [`master-sprint-625-exit.md`](./master-sprint-625-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)

## Objective

Introduce a shared **S3-compatible** adapter in `@enagar/api` so document and grievance modules issue **real presigned URLs** when MinIO is configured, while preserving **`minio://` stubs** when storage is disabled (default CI).

## Tasks

1. `ObjectStorageModule` + `ObjectStorageService` (`presignUpload`, `presignDownload`, `headObject`, `getObjectBuffer`, key guards).
2. Env contract in `infrastructure/.env.example` (`OBJECT_STORAGE_*`).
3. Wire `DocumentsService`, `GrievancesService`, `AdminTenantService`.
4. `POST /api/documents/:id/confirm-upload`.
5. Auto-create bucket on API boot when storage enabled.
6. `pnpm infra:minio-cors` script for browser PUT from PWA.
7. Tests: unit, security fingerprint, optional `RUN_STORAGE_TESTS=1` integration.

## Out of scope (6.26+)

- Prisma persistence for `application_documents`
- Real PWA file pickers and client PUT flows
- ClamAV worker

## Verification

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-625.spec.ts
```

Optional (MinIO running, `OBJECT_STORAGE_DISABLED=false` in `infrastructure/.env`):

```bash
set RUN_STORAGE_TESTS=1
pnpm --filter @enagar/api test -- --runTestsByPath src/common/object-storage/object-storage.integration.spec.ts
```
