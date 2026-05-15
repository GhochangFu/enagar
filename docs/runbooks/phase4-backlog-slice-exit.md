# Master Phase 4 — backlog slice exit (locked queue **#3**)

**Status: closed — engineering (repo)** · **2026-05-14**  
_ROADMAP pointer: [`ROADMAP.md` § Locked queue](../../ROADMAP.md#locked-sprint-queue-priority-order-114)._

Full CI on closure: **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`**.

## Deliverables (scope)

| Area                       | What landed                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Citizen SLA “push” MVP** | `POST …/staff/sweep-sla` inserts **`notifications`** rows (`type: sla_breach`, body = docket only) + **`GET/PATCH /api/citizen/notifications`** inbox |
| **GPS polish**             | Validated **`location.latitude` / `location.longitude`** on **`POST /api/grievances`**; citizen PWA optional pin fields                               |
| **Attachments polish**     | **`POST /api/grievances/:id/attachments/register`** + **`attachments[]`** on grievance detail                                                         |
| **Anonymised aggregates**  | **`GET /api/public/grievances/aggregate-metrics`** (counts only — optional **`tenant_code`**, rolling **`window_days`**)                              |
| **200 routing regression** | `grievance-routing-bake-off.spec.ts` — deterministic **200-row** permutation check vs oracle                                                          |

**Explicit deferrals:** Browser / FCM-native **silent push**, rate limiting on **`/public/*`**, richer attachment UX (thumbnail pipeline, VirusTotal), full **Phase 12** Open Data tenancy.

## Exit criteria

- [x] Engineering artefacts above merged with automated tests (**unit + DB where `RUN_DB_TESTS=1` + security fingerprints**).
- [x] `ARCHITECTURE.md`, `apps/api/README.md`, `apps/citizen-pwa/README.md`, and **`ROADMAP.md`** refreshed.
- [x] Smoke guidance added under **Citizen PWA README — Phase 4 backlog slice**.

### Sign-off

| Role          | Notes                                | Date           |
| ------------- | ------------------------------------ | -------------- |
| Product owner | _(optional sponsor acknowledgement)_ |                |
| Engineering   | Repo CI verification                 | **2026-05-14** |
