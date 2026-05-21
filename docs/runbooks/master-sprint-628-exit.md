# Master Sprint 6.28 Exit — Grievance evidence end-to-end

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.

## Delivered (engineering)

- Grievance evidence `upload-intent` + `register` — `ObjectStorageService` presign + `headObject` guard (confirmed).
- `GET /api/grievances/:id/attachments/:attachmentId/blob` — citizen-scoped preview bytes.
- Desk `getDeskGrievanceAttachmentBlob` — streams MinIO bytes for image/video when storage enabled (no video 404 when storage on).
- PWA — `isStubObjectStorageUploadUrl`; `GrievanceEvidencePreviewGrid` on detail.
- Mobile — `grievanceEvidenceApi.ts`, `expo-image-picker` on composer (max 3), upload after create.
- `grievances.db.spec.ts` — rejects register when storage on but object missing.
- `tests/security/master-sprint-628.spec.ts`.

## Exit criteria

- [x] `pnpm --filter @enagar/api typecheck`
- [x] `pnpm --filter @enagar/api test`
- [x] `pnpm test:security -- --runTestsByPath tests/security/master-sprint-628.spec.ts`
- [x] `pnpm --filter @enagar/citizen-pwa typecheck`
- [x] `pnpm --filter @enagar/mobile typecheck`
- [x] Manual: PWA photo → Desk `:3002` shows real image; mobile photo on Desk — operator verified (2026-05-21)

## Manual smoke

1. `OBJECT_STORAGE_DISABLED=false`, API + MinIO up.
2. Citizen PWA — file grievance with photo → open Tenant Desk grievance → evidence grid shows image (not SVG stub).
3. Mobile composer — add photo → submit → same grievance on Desk.

## Sign-off

| Role        | Notes                                            | Date           |
| ----------- | ------------------------------------------------ | -------------- |
| Engineering | API blob route + PWA/mobile upload + Desk stream | **2026-05-21** |
