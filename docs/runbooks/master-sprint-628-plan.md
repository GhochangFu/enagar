# Master Sprint 6.28 Plan — Grievance evidence end-to-end

**Status:** **Closed — engineering** (2026-05-21) · [`master-sprint-628-exit.md`](./master-sprint-628-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)  
**Depends on:** [**6.27 closed**](./master-sprint-627-exit.md)

## Objective

Grievance photo/video evidence flows through **real MinIO bytes** from citizen PWA/mobile to **Tenant Desk preview** (no SVG placeholder when storage is on).

## Deliverables

1. Confirm grievance `upload-intent` + `register` use `ObjectStorageService` + `headObject` guard.
2. `GET /grievances/:id/attachments/:attachmentId/blob` (citizen-scoped).
3. Desk `getDeskGrievanceAttachmentBlob` — real video/image bytes when storage enabled.
4. PWA — real PUT (no `minio://` skip when storage on); thumbnail preview on detail.
5. Mobile — image picker (max 3), upload after create.
6. `grievances.db.spec.ts` — register rejected when storage on but object missing.
7. `tests/security/master-sprint-628.spec.ts` + exit doc.
