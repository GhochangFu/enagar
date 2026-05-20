# Master Sprint 6.21 Plan — Grievance Taxonomy Foundation

**Status:** **closed** — engineering 2026-05-19. Exit: [`master-sprint-621-exit.md`](./master-sprint-621-exit.md).  
**Parent:** [`grievance-taxonomy-programme.md`](./grievance-taxonomy-programme.md) · **Blocks:** 6.22, 6.23, 6.24  
**Prerequisite:** Sprint **6.20** closed.

## Goal

Introduce **database-backed** grievance categories and sub-types with **read APIs** and **server-side validation** on create — without changing citizen UI yet (hardcoded pickers remain until 6.23).

## Deliverables

### D1 — Schema & RLS

- Prisma models: `GlobalGrievanceCategory`, `GlobalGrievanceSubtype`, `TenantGrievanceCategory`, `TenantGrievanceSubtype`.
- Alter `Grievance`: optional `subtypeCode` (`subtype_code` column).
- RLS policies on tenant tables; migration in `apps/api/prisma/migrations/`.

### D2 — Seed & backfill

- Global reference set aligned with glossary (10 categories + starter sub-types).
- Map legacy 11 PWA/mobile slugs → tenant adopted rows for `KMC`, `HMC`.
- Idempotent `seedGrievanceCatalogue()` in `apps/api/prisma/seed.ts`.

### D3 — Catalogue read service

- `GrievanceCatalogueService.getActiveCatalogue(tenantId)` → sorted tree.
- `GET /api/public/grievances/catalogue?tenant_code=`
- `GET /api/grievances/catalogue` (citizen + tenant header).

### D4 — Create validation

- On `POST /grievances`: resolve tenant; verify `category` active; verify `subtype_code` when category has subtypes.
- **400** with clear message on mismatch (no silent accept of unknown codes).

### D5 — Tests

- Unit: validation matrix, seed idempotency, routing unchanged for `roads`.
- `tests/security/master-sprint-621.spec.ts`: public endpoint; no cross-tenant leakage.

## Suggested order

1. Migration + Prisma client
2. Seed + manual curl catalogue
3. Public + scoped read endpoints
4. Create validation + regression on existing grievance tests
5. Security spec + docs stub in programme doc

## Exit criteria

See [`master-sprint-621-exit.md`](./master-sprint-621-exit.md) and programme §5.

## Verification

```bash
pnpm db:migrate && pnpm db:seed
pnpm --filter @enagar/api test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-621.spec.ts
curl "http://localhost:3001/api/public/grievances/catalogue?tenant_code=KMC"
```
