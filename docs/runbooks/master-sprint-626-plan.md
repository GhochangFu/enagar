# Master Sprint 6.26 Plan — Application documents (real upload + DB)

**Status:** **Closed — engineering** (2026-05-21) · [`master-sprint-626-exit.md`](./master-sprint-626-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)  
**Depends on:** [**6.25 closed**](./master-sprint-625-exit.md) — `ObjectStorageModule` + MinIO bucket

## Objective

Replace the in-memory `DocumentsService` map with **Postgres `application_documents`**, and wire **citizen PWA + mobile** to pick real files, **PUT** to presigned URLs, **confirm-upload**, then simulated or worker scan before submit.

## Deliverables

1. Prisma repository for `application_documents`; remove `Map` from `DocumentsService`.
2. Sync document rows onto application detail reads (`GET /applications/:docket`).
3. `@enagar/forms/web` — real `<input type="file">` (replace filename simulation).
4. Mobile file picker for `type: file` fields.
5. Citizen PWA `createDocumentIntents` — PUT bytes → `confirm-upload` → scan.
6. `master-sprint-626-exit.md` + `tests/security/master-sprint-626.spec.ts`.

## Exit criteria (preview)

- Real PDF/image upload on a file-required service; object visible in MinIO; metadata survives API restart.
- Submit blocked until required documents are scan-clean (existing rule).

## Verification (when complete)

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-626.spec.ts
```
