# Hub programme — Sprint **H6.1** exit checklist

**Status: closed — engineering (repo)** · **2026-05-14**  
_CI: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security` green on closure commit._  
_Product owner initials optional below if sponsor wants a parallel paper trail._

---

**Audience:** Product owner / Tech lead signing off **Hub Phase H6** polish.  
**ROADMAP:** [Sprint H6.1](../ROADMAP.md#sprint-h61--docs-observability-spot-check-backlog-triage).

Archived as the **completed** H6.1 record; deferred hub polish lives in [citizen-unified-hub §6](./citizen-unified-hub.md#6-backlog-pointers-triaged-under-h61).

## Documentation

- [x] [`docs/runbooks/citizen-unified-hub.md`](./citizen-unified-hub.md) reviewed for hub vs workspace headers and dashboard behaviour.
- [x] [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md) manual smoke sections (**4.1–4.16**) reproducible locally with current API/PWA (**2026-05-14** verification); regressions tracked via smoke headings + linked runbook.
- [x] [`ADR-0003` References](../ADRs/ADR-0003-mobile-pwa-parallel.md#references) include hub runbook pointer (PWA-first hub ≠ Phase 5 RN).

## Observability & performance

- [x] API logs: at least one successful **`citizen_hub_dashboard`** log line inspected (includes `jwt_tenant_code`, row counts, **`distinct_active_service_codes`** numeric count, `duration_ms`). _Verified via `pnpm test` Nest log from `CitizenHubDashboardService` unit test (**2026-05-14**)._
- [x] No open **severity-high** regression on **`GET /citizen/dashboard`** (latency or error rate) versus prior sprint baseline — or documented + ticket filed. _Bucket path remains **three parallel lists** + Map aggregation (see runbook §3); no per-ULB DB N+1._

## Quality

- [x] **CI green** on branch intended for hub exit (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security` as per repo norms). **2026-05-14**

## Backlog hygiene

- [x] Items deferred from hub scope remain listed under **[citizen-unified-hub §6 — Backlog pointers](./citizen-unified-hub.md#6-backlog-pointers-triaged-under-h61)** (`E2E`/`k6`, etc.); **file discrete GitHub / ADO issues when your tracker is available.**

## Sign-off

| Role          | Name                 | Date       |
| ------------- | -------------------- | ---------- |
| Product owner | _(optional)_         |            |
| Engineering   | Repo CI verification | 2026-05-14 |
