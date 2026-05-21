# Master Sprint 6.29 Plan — Branding upload & Desk application documents

**Status:** **Closed — engineering** (2026-05-21) · [`master-sprint-629-exit.md`](./master-sprint-629-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)  
**Depends on:** [**6.28 closed**](./master-sprint-628-exit.md) · [**6.26**](./master-sprint-626-exit.md)

## Objective

Tenant Operations can **upload branding assets** (logo/hero) via presigned PUT; Tenant Desk operators can **preview application attachments** from `application_documents` (not JSON snapshot only).

## Deliverables

1. `POST /admin/tenant/branding-assets/upload-intent` — logo/hero MIME whitelist, 5 MB cap, tenant-prefixed `storage_key`, derived `public_url`.
2. **Tenant Admin Operations** — file picker + PUT + guided save (replaces manual storage_key entry for uploads).
3. `ObjectStorageService.buildPublicObjectUrl` — `OBJECT_STORAGE_PUBLIC_BASE` / public endpoint + bucket path-style URL.
4. **Desk application detail** — Prisma `application_documents` list + `GET …/documents/:documentId/blob` for inline preview/download.
5. `upsertBrandingAsset` — `headObject` guard when storage enabled.
6. `tests/security/master-sprint-629.spec.ts` + `master-sprint-629-exit.md`.

## Verification

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/admin-tenant typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-629.spec.ts
```
