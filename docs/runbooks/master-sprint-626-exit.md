# Master Sprint 6.26 Exit — Application documents (real upload + DB)

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.

## Delivered (engineering)

- `DocumentsService` persists to **`application_documents`** via Prisma (in-memory `Map` removed).
- `application-document.mapper.ts` maps rows ↔ API DTOs; `DocumentsModule` imports `DatabaseModule` + `ObjectStorageModule`.
- `ApplicationsService.withPersistedDocuments()` hydrates `documents[]` on application reads when Prisma is available.
- `@enagar/forms/upload` — `putFileToUploadUrl`, `confirmDocumentUpload` (separate export so API does not load ESM subpath); web `DynamicFormFields` real `<input type="file">`.
- Citizen PWA apply flow — file blobs → PUT presigned URL → `confirm-upload` → simulated clean scan.
- Mobile — `expo-document-picker`, `documentsApi.ts` PUT + confirm, `ApplicationComposerScreen` pending files.
- `tests/security/master-sprint-626.spec.ts`; integration specs updated (`phase2`, `payment-portal`, `hub-scope`).

## Exit criteria

- [x] `pnpm --filter @enagar/api typecheck`
- [x] `pnpm --filter @enagar/api test`
- [x] `pnpm test:security -- --runTestsByPath tests/security/master-sprint-626.spec.ts`
- [x] `pnpm --filter @enagar/citizen-pwa typecheck`
- [x] `pnpm --filter @enagar/mobile typecheck`
- [x] Manual: real file on birth-cert → object in MinIO → API restart → document metadata still on docket _(2026-05-21 — `node scripts/smoke-sprint-626.mjs` + restart script; docket `WBM/KMC/birth-cert/2026/00006`)_

## Manual smoke (PWA + MinIO)

Prerequisites: Sprint **6.25** MinIO (`OBJECT_STORAGE_DISABLED=false`, `pnpm infra:up`, `pnpm infra:minio-cors`), API + Postgres (`DATABASE_URL`, `APPLICATION_STORE_PROVIDER=postgres`).

**Automated (2026-05-21):**

```bash
pnpm --filter @enagar/api dev
node scripts/smoke-sprint-626.mjs
# restart API, then:
node scripts/smoke-sprint-626-restart.mjs
```

**Recorded run:** docket `WBM/KMC/birth-cert/2026/00006`, object key `tenants/kmc/applications/.../birth-proof.pdf`, `documents[].scan_status=clean` before and after API restart.

**Browser (optional):** same sequence in PWA network tab — `upload-intent` → PUT → `confirm-upload` → `scan-result`.

**Note:** Scan is still **simulated** (`pwa-simulated-clamav`) until Sprint **6.27**.

## Sign-off

| Role        | Notes                                                               | Date           |
| ----------- | ------------------------------------------------------------------- | -------------- |
| Engineering | CI green; manual HTTP smoke + MinIO head + post-restart docket read | **2026-05-21** |
