# Phase 6 vision backlog — execution order

**Audience:** sponsor, PMs, engineers planning post–Sprint **6.7** work  
**Authority:** deltas vs **`ROADMAP.md` § Phase 6 — Admin Portals (State + Tenant)** (~lines 1311–1380).  
**Baseline shipped:** Master Sprints **6.1–6.9** (Tenant + State portals, catalogue alignment, designer polish, P1 operator polish, P2 reporting/bulk ops/state visibility).

This backlog is **not** a commitment to dates; use it when opening new sprints (**6.8+**, Phase **6.x hardening**, or Phase **7-adjacent** slices).

---

## How this order was chosen

Each row blends:

- **Implementation probability** — builds on JSON/API patterns already present vs net-new subsystem.
- **Urgency** — operator throughput, citizen experience, governance, unblock for pilot/production.

Rough **waves**:

| Wave              | Meaning                                     |
| ----------------- | ------------------------------------------- |
| **P1**            | Highest leverage polish on existing portals |
| **P2**            | Reporting, bulk ops, readable analytics     |
| **P3–P4**         | Larger product bets or new bounded contexts |
| **P5 / deferred** | Heavy integration / env / procurement       |

Reorder when sponsor priorities shift (example: PSP live before PDF reports).

---

## Prioritized backlog (execute top → bottom unless replanned)

| Order | Priority | Phase 6 vision item (summarized)                                                                                   | Portal                  | Repo today\*                          | Suggested sprint theme                 | Notes                                                                           |
| :---: | :------: | ------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
|   1   |    P1    | **Maintenance banners / outage notices**                                                                           | Tenant                  | Closed engineering — Sprint 6.8       | _Admin polish_ — tenant-scoped banners | `tenant_banners` + Tenant Admin CRUD + citizen workspace display.               |
|   2   |    P1    | **Document checklist UX** (guided checklist editor vs raw JSON only)                                               | Tenant                  | Closed engineering — Sprint 6.8       | _Config UX_                            | Guided rows persist to existing `required_documents` service config.            |
|   3   |    P1    | **Fee-rule guided editor + validation UX**                                                                         | Tenant                  | Closed engineering — Sprint 6.8       | _Config UX_                            | Guided controls preserve safe `FeeRule` JSON and backend preview.               |
|   4   |    P1    | **Notification template UX** — live variable preview / channel matrix (SMS first; extend to email/WhatsApp)        | Tenant                  | Closed engineering — Sprint 6.8       | _Comms UX_                             | Channel form + placeholder preview; provider sending still deferred.            |
|   5   |    P2    | **Dashboard depth** — trends, SLA drill-down lists, breached queue links (beyond headline KPI counts)              | Tenant                  | Closed engineering — Sprint 6.9       | _Observability_                        | `dashboard/deep` API + Tenant Admin trend, breached queue, and workload cards.  |
|   6   |    P2    | **Operational CSV exports** — applications, payments, grievances, SLA summaries per tenant                         | Tenant                  | Closed engineering — Sprint 6.9       | _Reporting v1_                         | Bearer-token CSV downloads with tenant scope and formula-injection hardening.   |
|   7   |    P2    | **Address master bulk CSV import**                                                                                 | Tenant                  | Closed engineering — Sprint 6.9       | _Masters UX_                           | Dry-run/import UI with header checks, row errors, and valid-row partial import. |
|   8   |    P2    | **State audit log** — search, filters, pagination, export                                                          | State                   | Closed engineering — Sprint 6.9       | _Governance UX_                        | Filtered audit API/UI, cursor pagination, and CSV export.                       |
|   9   |    P2    | **Tenant directory drill-down** — tenant detail pane (health, configs, warnings)                                   | State                   | Closed engineering — Sprint 6.9       | _State ops UX_                         | Tenant detail API/pane with health counts, warnings, config, and audit events.  |
|  10   |    P3    | **Tariff / revenue-head UX parity** — forms over JSON where safe                                                   | Tenant                  | Mixed JSON/UI                         | _Masters polish_                       | Mirrors checklist/fee rationale.                                                |
|  11   |    P3    | **Global / inherited service catalogue** — adopt, fork, deactivate patterns                                        | Tenant + API            | Row edit only                         | _Catalogue governance_                 | Needs product rules (source of truth, conflicts). Larger than “UI-only”.        |
|  12   |    P3    | **Workflow escalation UX** — policy blocks beyond linear transitions (timeouts, escalate-to-role)                  | Tenant                  | Canvas v1 exists                      | _Workflow depth_                       | Validates against `@enagar/workflow` + worker execution semantics.              |
|  13   |    P3    | **State analytics v2** — time ranges, deltas, anomaly hints                                                        | State                   | KPI cards                             | _Executive metrics_                    | Depends on retained metrics warehouse or heavier SQL.                           |
|  14   |    P3    | **Transparency pack** — cross-tenant leaderboards / published CSV summaries for citizen portal                     | State + Citizen surface | Minimal                               | _Open data slice_                      | Separate from Sprint 7 RAG; may be CSV-only MVP.                                |
|  15   |    P4    | **Reports PDF** — Playwright or server-rendered PDF for SLA/revenue                                                | Tenant                  | Absent                                | _Reporting v2_                         | Ship after CSV proves query contracts.                                          |
|  16   |    P4    | **Knowledge Base CMS richness** — WYSIWYG, `.docx` import (Mammoth), media                                         | Tenant                  | JSON locales                          | _Content ops_                          | Tie-break with Phase **7** RAG indexer milestones.                              |
|  17   |    P4    | **KB publish → RAG indexer trigger** (on-demand / nightly reconcile)                                               | Tenant + svc            | Deferred by design toward Phase **7** | _RAG infra_                            | Depends on indexer service + tenancy policies.                                  |
|  18   |    P4    | **Branding pipeline** — safe asset uploads (MinIO), presets, WCAG-ish contrast checks                              | Tenant                  | URLs in JSON                          | _Theming UX_                           | Larger than swapping hex in JSON; links to CDN/object policy.                   |
|  19   |    P4    | **Bookable assets manager + calendars**                                                                            | Tenant                  | Greenfield UI                         | _New bounded context (bookings)_       | Highest net-new modeling cost in Phase‑6 prose; prefer after catalogue stable.  |
|  20   |    P5    | **Staff invite + Keycloak user provisioning UX**                                                                   | Tenant                  | Upsert-by-subject-ID                  | _Identity lifecycle_                   | Deferred in runbooks; needs secure ops + realms.                                |
|  21   |    P5    | **Global Service Library curator** (state-wide template authoring)                                                 | State                   | Absent                                | _Library product_                      | Depends on catalogue inheritance/product model (see row **11**).                |
|  22   |    P5    | **State integration cockpit** (DigiLocker, PSP, SMS DLT, etc.)                                                     | State                   | Absent                                | _Enterprise integrations_              | Procurement + secrets + compliance; pilot-gated.                                |
|  23   |    P5    | **Phase 6 “exit prose” verbatim** — every admin mutation audited everywhere; wizard-only onboarding for Nᵗʰ tenant | Both                    | Partial                               | _Hardening / audit completeness_       | Sponsor acceptance program, not single dev sprint; define measurable subset.    |

\* **Repo today** legend: aligned with **`apps/admin-tenant`** + **`apps/admin-state`** dashboards as of backlog authoring; APIs may expose more than the portal surfaces.

---

## Cross-reference

- **`ROADMAP.md`** — full Phase‑6 ambition and sprint slice (**6.1–6.7**).
- **`docs/runbooks/master-sprint-61-exit.md`** … **`master-sprint-68-exit.md`** — what landed in-queue.
- **`docs/runbooks/master-sprint-69-plan.md`** / **`master-sprint-69-exit.md`** — P2 sprint plan and engineering exit record.
- **`docs/help/start-the-app-step-by-step.md`** — how to smoke local portals.

---

## Using this backlog in a sprint

1. Confirm sponsor **must-have slice** vs this default order or pick rows by **`Order`**.
2. For each slice: write **definition of ready** — API endpoints, tenancy rules, rollback, QA data.
3. Add `tests/security` or domain contract specs when touching cross-cutting behaviour (patterns in `tests/security/`).
4. When a slice **closes**, append a **`docs/runbooks/master-sprint-*.md`** (or backlog row update) linking **Order** IDs.

_Last updated: 2026-05-16 (P1 rows closed engineering in Master Sprint 6.8; P2 rows closed engineering in Master Sprint 6.9)._
