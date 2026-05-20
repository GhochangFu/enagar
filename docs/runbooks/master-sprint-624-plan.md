# Master Sprint 6.24 Plan — State Grievance Library & Programme Exit

**Status:** **closed — engineering** (2026-05-20)  
**Parent:** [`grievance-taxonomy-programme.md`](./grievance-taxonomy-programme.md)  
**Prerequisite:** Sprints **6.21–6.23** closed.

## Goal

Complete the **statewide reference library** and **adopt/fork/deactivate** flows; finish documentation, regression smoke, and **programme exit** so **Phase 7** can proceed.

## Deliverables

### D1 — State admin API

- `GET/POST/PATCH /api/admin/state/grievance-library/categories` (+ subtypes)
- `POST /api/admin/state/tenants/:tenantCode/grievance-catalogue/adopt` (bulk or selective)
- Read-only tenant catalogue view for state oversight

### D2 — State admin UI

- `apps/admin-state`: **Grievance library** nav item
- CRUD global categories/subtypes (mirror service library UX from 6.12)
- Tenant detail: adopted vs available global rows

### D3 — Adopt / fork / deactivate (tenant)

- Reuse patterns from `forkCatalogueService` / catalogue governance (6.10)
- Tenant Admin buttons: **Adopt**, **Fork**, **Deactivate** on catalogue list

### D4 — Metrics & legacy mapping

- `aggregate-metrics`: map unknown `grievances.category` to `other` bucket with `legacy_unmapped` count in metadata (documented)
- Desk + exports show both code and label

### D5 — Optional docket format (flagged)

- Tenant config `grievance_docket_category_segment: boolean` (default `false`)
- When true: `GRV-{TENANT}-{YEAR}-{DOCKET_CODE}-{seq}` using `docket_code` from category row
- Migration does **not** rewrite existing `grievance_no` values

### D6 — Programme documentation

- Update `docs/glossary.md`, `ARCHITECTURE.md`, `docs/reference/enagar-database-system-admin.md`
- `docs/help/start-the-app-step-by-step.md` — operator “add grievance type” section
- Close all four exit runbooks; update `ROADMAP.md` gate

### D7 — Security & CI

- `tests/security/master-sprint-624.spec.ts`
- Programme grep check: no `GRIEVANCE_CATEGORY_CODES` in citizen filing paths

## Exit criteria

See [`master-sprint-624-exit.md`](./master-sprint-624-exit.md) and programme §9.

## Manual smoke (programme matrix)

| #   | Scenario                                                  | Actor               |
| --- | --------------------------------------------------------- | ------------------- |
| 1   | State creates global category + 3 subtypes                | State admin `:3003` |
| 2   | KMC adopts; HMC does not → only KMC picker shows it       | Two tenants         |
| 3   | KMC forks global row; label change visible to citizens    | KMC admin           |
| 4   | Deactivate hides from picker; old grievance still in Desk | KMC admin           |
| 5   | Citizen PWA files with new type + subtype                 | Citizen `:3000`     |
| 6   | Mobile files same                                         | Expo device         |
| 7   | SLA + routing apply per Operations config                 | API timestamps      |
| 8   | Public aggregate-metrics includes new category bucket     | curl                |

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:security
# Run specs 621–624
```
