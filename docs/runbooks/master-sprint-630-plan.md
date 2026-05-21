# Master Sprint 6.30 Plan — Upload programme exit & Phase 7 gate

**Status:** **Closed — engineering** (2026-05-21) · [`master-sprint-630-exit.md`](./master-sprint-630-exit.md)  
**Programme:** [`object-storage-upload-programme.md`](./object-storage-upload-programme.md)  
**Depends on:** [**6.25–6.29 closed**](./master-sprint-629-exit.md)

## Objective

Close the **object storage & upload programme (6.25–6.30)** with cross-cutting security contracts, documentation, automated smoke replay, and ROADMAP gate update so **Phase 7 KB file ingest** may proceed (Sahayak charter/DPA still apply per `ROADMAP.md`).

## Deliverables

1. `master-sprint-630-exit.md` — verification matrix + programme manual smoke.
2. `tests/security/object-storage-programme.spec.ts` — intent, tenant prefix, path traversal, scan guards.
3. `scripts/smoke-sprint-630-programme.mjs` — replays 6.26/6.29 API smokes + programme checks.
4. Update `ROADMAP.md`, `object-storage-upload-programme.md`, `enagar-database-system-admin.md`.
5. Upload smoke sections in `apps/api/README.md`, `citizen-pwa/README.md`, `mobile/README.md`.

## Verification

```bash
pnpm typecheck
pnpm test:security -- --runTestsByPath tests/security/object-storage-programme.spec.ts
node scripts/smoke-sprint-630-programme.mjs
```
