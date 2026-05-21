# Master Sprint 6.29 Exit — Branding upload & Desk application documents

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.

## Delivered (engineering)

- `POST /admin/tenant/branding-assets/upload-intent` — logo/hero MIME whitelist, 5 MB cap, tenant-prefixed `storage_key`, `public_url` via `ObjectStorageService.buildPublicObjectUrl`.
- `upsertBrandingAsset` — `headObject` guard when object storage enabled.
- **Tenant Admin Operations** — file picker → PUT → guided PATCH (storage_key + public_url).
- **Desk** — `application_documents` from Prisma on dossier; `GET …/desk/applications/:id/documents/:documentId/blob` for image/PDF preview + download.
- `OBJECT_STORAGE_PUBLIC_BASE` in `infrastructure/.env.example`.
- `tests/security/master-sprint-629.spec.ts`.

## Exit criteria

- [x] `pnpm --filter @enagar/api typecheck`
- [x] `pnpm --filter @enagar/api test`
- [x] `pnpm --filter @enagar/admin-tenant typecheck`
- [x] `pnpm test:security -- --runTestsByPath tests/security/master-sprint-629.spec.ts`
- [x] Manual: Operations branding PNG upload → `settings.branding.logo_url` + `tenants.logo_url` (DB) — `node scripts/smoke-sprint-629.mjs` (2026-05-21)
- [x] Manual: Desk application with clean scan → PDF blob (not SVG) — same script, docket `WBM/KMC/birth-cert/2026/00006`

## Manual smoke

1. `OBJECT_STORAGE_DISABLED=false`, MinIO + API up.
2. Tenant Operations → Branding → upload logo → Save asset → set settings `logo_url` to `public_url`.
3. Desk → open application with uploaded birth-certificate scan (`scan_status=clean`) → preview + download.

**Automated replay (2026-05-21):** `node scripts/smoke-sprint-629.mjs` — Keycloak `kmc-municipality-admin-dummy` branding PUT + settings; `kmc-tenant-clerk-dummy` desk blob `%PDF` for docket from `scripts/.smoke-626-state.json`.

**Note:** `GET /api/tenants` still serves in-memory `tenantSeeds` (`logo_url: null`); Operations `PATCH /admin/tenant/settings` updates **`tenants.logo_url`** in Postgres. PWA hub pickers use `/tenants` until that route merges DB branding (follow-up, not 6.29 blocker).

## Sign-off

| Role        | Notes                                                                       | Date           |
| ----------- | --------------------------------------------------------------------------- | -------------- |
| Engineering | Branding upload-intent + Desk document blob preview; API smoke script green | **2026-05-21** |
