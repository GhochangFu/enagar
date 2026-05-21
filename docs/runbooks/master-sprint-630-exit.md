# Master Sprint 6.30 Exit — Object storage upload programme

**Status:** **closed — engineering** (2026-05-21). Sponsor sign-off optional.  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md) → **Closed — engineering**

## Programme summary (6.25–6.30)

| Sprint | Focus                                           | Exit                                                       |
| ------ | ----------------------------------------------- | ---------------------------------------------------------- |
| 6.25   | `ObjectStorageModule`, presigned PUT/GET, MinIO | [`master-sprint-625-exit.md`](./master-sprint-625-exit.md) |
| 6.26   | `application_documents`, PWA/mobile real upload | [`master-sprint-626-exit.md`](./master-sprint-626-exit.md) |
| 6.27   | BullMQ `document-scan-worker`, download guards  | [`master-sprint-627-exit.md`](./master-sprint-627-exit.md) |
| 6.28   | Grievance evidence E2E, Desk/PWA/mobile preview | [`master-sprint-628-exit.md`](./master-sprint-628-exit.md) |
| 6.29   | Branding upload-intent, Desk application docs   | [`master-sprint-629-exit.md`](./master-sprint-629-exit.md) |
| 6.30   | Programme exit + Phase 7 file-ingest gate       | **this doc**                                               |

## Delivered (6.30)

- [`tests/security/object-storage-programme.spec.ts`](../../tests/security/object-storage-programme.spec.ts) — cross-cutting storage contracts.
- [`scripts/smoke-sprint-630-programme.mjs`](../../scripts/smoke-sprint-630-programme.mjs) — replays 6.26 + 6.29 API smokes, citizen download, desk grievance blob check.
- `ROADMAP.md` locked queue **6.25–6.30** closed; Phase 7 note updated for KB ingest gate.
- `docs/reference/enagar-database-system-admin.md` — upload/scan runtime section expanded.
- README upload smoke pointers: `apps/api`, `citizen-pwa`, `mobile`.

## Programme exit criteria

- [x] Sprint exit checklists **6.25–6.29** engineering closed (see table above).
- [x] `pnpm typecheck` (monorepo)
- [x] `pnpm test:security -- --runTestsByPath tests/security/object-storage-programme.spec.ts`
- [x] `node scripts/smoke-sprint-630-programme.mjs` (KMC, `OBJECT_STORAGE_DISABLED=false`)
- [x] Client `scan-result` gated by `allowsClientScanSimulation()` / `ALLOW_CLIENT_SCAN_SIMULATION` (see programme security spec + 6.27 exit).
- [ ] Sponsor optional sign-off

## Verification commands

```bash
pnpm typecheck
pnpm test:security -- --runTestsByPath tests/security/object-storage-programme.spec.ts
node scripts/smoke-sprint-630-programme.mjs
```

Scoped replay:

```bash
node scripts/smoke-sprint-626.mjs
node scripts/smoke-sprint-629.mjs
```

## Programme manual smoke (KMC)

| #   | Step                                | Port / tool        | Status                                                           |
| --- | ----------------------------------- | ------------------ | ---------------------------------------------------------------- |
| 1   | Apply service with PDF upload       | PWA `:3000`        | Covered by `smoke-sprint-626.mjs`                                |
| 2   | Desk view application attachment    | Tenant `:3002`     | `smoke-sprint-629.mjs` (PDF blob)                                |
| 3   | File grievance with photo + map pin | PWA `:3000`        | Operator verified (6.28 exit)                                    |
| 4   | Desk view grievance evidence        | `:3002`            | Operator verified (6.28 exit); API blob check in `630-programme` |
| 5   | Upload branding logo                | Operations `:3002` | `smoke-sprint-629.mjs`                                           |
| 6   | Mobile grievance with photo         | Expo               | Shipped 6.28 (engineering); native UI smoke optional             |

**Prerequisites:** `pnpm infra:up`, `OBJECT_STORAGE_DISABLED=false`, `pnpm infra:minio-cors`, API + Keycloak dummy users seeded.

## Phase 7 handoff

After this exit, **KB `.docx` ingest** and RAG object fetch may use `ObjectStorageService` namespace `kb/` (see programme §7). **Sahayak AI** charter, DPA, and remaining `ROADMAP.md` open items still apply before production AI features.

## Sign-off

| Role        | Notes                                         | Date           |
| ----------- | --------------------------------------------- | -------------- |
| Engineering | Programme security spec + smoke script + docs | **2026-05-21** |
