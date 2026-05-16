# Master Sprint 6.9 Plan — Phase 6 P2 Reporting, Bulk Ops, and State Visibility

Status: **executed — closed engineering 2026-05-16**. Exit record: `docs/runbooks/master-sprint-69-exit.md`.

## Scope

Deliver the five **P2** rows from `docs/backlog/phase-6-vision-backlog-prioritized.md` as one Phase 6 continuation sprint:

- Tenant dashboard depth: trends, SLA drill-down lists, and breached queue links.
- Tenant operational CSV exports for applications, payments, grievances, and SLA summaries.
- Tenant address master bulk CSV import with validation and partial-failure reporting.
- State audit log search, filters, pagination, and export.
- State tenant directory drill-down with health, config, and warning details.

This sprint is about **operator visibility and bulk workflow**, not new citizen runtime behaviour.

## Key Existing Surfaces

- `apps/admin-tenant/app/dashboard/dashboard-client.tsx` currently shows headline KPI cards from `GET /admin/tenant/dashboard`.
- `apps/admin-tenant/app/dashboard/masters/masters-client.tsx` currently edits one address-master row at a time through `PATCH /admin/tenant/address-master`.
- `apps/api/src/modules/admin-tenant/admin-tenant.controller.ts` already exposes tenant dashboard, services, address master, payments-adjacent, and operations surfaces.
- `apps/admin-state/app/dashboard/state-dashboard-client.tsx` currently shows state KPI cards, a tenant table, recent audit logs, tenant upsert JSON, and impersonation controls.
- `apps/api/src/modules/admin-state/admin-state.service.ts` currently provides state analytics, tenant list, impersonation, tenant upsert, and recent audit logs.
- Security contract patterns live in `tests/security/master-sprint-*.spec.ts`; add one for this sprint.

## Sub-Sprints

### 6.9A — Tenant Dashboard Depth

Deliverables:

- Add a tenant dashboard detail API, likely `GET /admin/tenant/dashboard/deep`, returning:
  - 7/30-day application trend buckets.
  - 7/30-day payment settlement trend buckets.
  - open SLA-breached grievance/application queues with IDs, docket/reference numbers, status, SLA timestamps, and latest update.
  - top services by open applications and recent submissions.
- Extend the Tenant Admin dashboard UI with:
  - trend cards or compact tables, without adding chart-heavy dependencies unless already justified.
  - “View breached queue” sections linking to existing operational entities where URLs exist, or showing stable identifiers when no route exists yet.
  - clear empty states for tenants with no data.

Non-goals:

- No map/heatmap/geo visualization.
- No new SLA engine semantics; use existing application/grievance/payment data.

### 6.9B — Tenant Operational CSV Exports

Deliverables:

- Add tenant-scoped export endpoints, likely:
  - `GET /admin/tenant/exports/applications.csv`
  - `GET /admin/tenant/exports/payments.csv`
  - `GET /admin/tenant/exports/grievances.csv`
  - `GET /admin/tenant/exports/sla-summary.csv`
- Each endpoint must:
  - enforce tenant scope from JWT principal.
  - support bounded date filters where data has timestamps.
  - explicitly list columns, never `SELECT *`.
  - stream or generate CSV safely with formula-injection protection for cells beginning with `=`, `+`, `-`, or `@`.
  - use `text/csv` content type and a sensible `Content-Disposition` filename.
- Add Tenant Admin UI export buttons with filter controls and loading/error states.

Non-goals:

- No PDF reports in this sprint.
- No cross-tenant exports from Tenant Admin.

### 6.9C — Address Master Bulk CSV Import

Deliverables:

- Add a tenant-scoped bulk import endpoint, likely `POST /admin/tenant/address-master/import-csv`.
- CSV columns:
  - `borough_code`
  - `borough_name`
  - `ward_number`
  - `ward_name`
  - `mouza`
  - `locality_name`
  - `pincode`
- Validate each row using the same rules as `UpsertAddressMasterDto`.
- Process rows in bounded chunks and return a structured result:
  - `inserted`
  - `updated`
  - `failed`
  - row-level errors with row number and field.
- Add Tenant Admin Masters UI for paste/upload CSV, dry-run preview, import result summary, and reload.

Non-goals:

- No background job queue unless row volume proves it necessary.
- No geocoding or map boundary validation.

### 6.9D — State Audit Log Search and Export

Deliverables:

- Replace “recent audit log only” with queryable state audit APIs:
  - `GET /admin/state/audit-logs?actor=&action=&tenant_code=&from=&to=&cursor=&limit=`
  - `GET /admin/state/audit-logs.csv?...`
- Add filters, pagination, and CSV export in State Super-Admin UI.
- Preserve newest-first ordering and stable cursor pagination.
- Include actor, role, action, target tenant code, timestamp, and metadata summary in the UI.

Non-goals:

- No immutable external audit sink.
- No SIEM integration.

### 6.9E — State Tenant Directory Drill-Down

Deliverables:

- Add a state tenant detail API, likely `GET /admin/state/tenants/:code`, returning:
  - tenant profile and config highlights.
  - counts for services, active services, citizens, applications, open grievances, payments, banners, staff assignments where available.
  - warning flags for missing config, inactive services, no enabled languages, missing tenant config, no recent activity, or expired/inactive tenant.
- Add a tenant detail pane or route in State Super-Admin:
  - click a tenant from the directory table.
  - show health counts, warnings, latest audit entries for that tenant, and quick actions such as impersonation prefill.
- Keep tenant upsert/onboarding flow intact.

Non-goals:

- No new onboarding wizard redesign.
- No state-level mutation beyond existing upsert and impersonation.

### 6.9F — Docs, Tests, Verification

Deliverables:

- Add `docs/runbooks/master-sprint-69-exit.md` during execution with deliverables, non-goals, verification commands, and smoke steps.
- Update `docs/backlog/phase-6-vision-backlog-prioritized.md` from “planned” to “closed engineering” only after implementation and verification.
- Update `README.md`, `ROADMAP.md`, `apps/admin-tenant/README.md`, and `docs/help/start-the-app-step-by-step.md` after implementation.
- Add `tests/security/master-sprint-69.spec.ts` covering:
  - tenant export endpoints are tenant-scoped and CSV-safe.
  - dashboard depth exposes drill-down queues without cross-tenant leakage.
  - address import validates row-level failures and does not partially corrupt invalid rows.
  - state audit search/export is state-admin only and paginated.
  - state tenant detail does not expose secrets.
- Extend API service specs for dashboard depth, exports, address import, audit search, and tenant detail.

## Exit Criteria

- Tenant admin can see dashboard trends and SLA-breached queues beyond headline KPI counts.
- Tenant admin can export applications, payments, grievances, and SLA summaries as tenant-scoped CSV.
- Tenant admin can bulk import address master rows from CSV, see row-level validation errors, and reload imported rows.
- State super-admin can search, filter, paginate, and export audit logs.
- State super-admin can open a tenant drill-down panel/detail view with health counts, config highlights, warnings, and tenant-specific recent audit entries.
- All new reads and exports are principal-scoped and do not leak tenant data.
- CSV outputs are formula-injection hardened.
- Existing Sprint 6.3, 6.5, 6.8, and full security contracts remain valid.
- No PDF generation, SIEM integration, geo heatmaps, or background workers are introduced.

## Verification Plan

Run, at minimum, after implementation:

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- admin-tenant.service.spec.ts admin-state.service.spec.ts
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/admin-state typecheck
pnpm --filter @enagar/admin-state lint
pnpm --filter @enagar/admin-state build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-69.spec.ts tests/security/master-sprint-63.spec.ts tests/security/master-sprint-65.spec.ts tests/security/master-sprint-68.spec.ts
pnpm test:security
graphify update .
```

## Manual Smoke After Completion

1. Start infra, migrate, seed, API, Tenant Admin, and State Super-Admin.
2. Sign into Tenant Admin as KMC/HMC municipality admin.
3. Open Tenant Dashboard and confirm trends plus SLA-breached queues render.
4. Export applications, payments, grievances, and SLA summary CSV; confirm files contain tenant rows only and safe headers.
5. Open Masters, dry-run an address CSV with one valid and one invalid row, confirm row-level errors, then import valid rows and reload.
6. Sign into State Super-Admin.
7. Search audit logs by action, actor, tenant, and date range; page through results.
8. Export filtered audit logs as CSV.
9. Open a tenant detail pane for KMC/HMC and confirm health counts, warnings, and latest tenant audit entries.
10. Confirm no citizen PWA behaviour changed.

## Decision Defaults

- Sprint name: `Master Sprint 6.9 — Phase 6 P2 Reporting, Bulk Ops, and State Visibility`.
- Keep P2 rows together because they share reporting/query contracts and admin portal surfaces.
- Prefer simple server-generated CSV over PDF or chart-heavy visualization.
- Prefer cursor/limit pagination for audit logs.
- Do not add new npm dependencies for CSV parsing/generation unless existing platform APIs are insufficient after implementation review.
