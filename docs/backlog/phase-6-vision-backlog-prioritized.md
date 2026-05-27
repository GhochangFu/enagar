# Phase 6 vision backlog — execution order

**Audience:** sponsor, PMs, engineers planning post–Sprint **6.7** work  
**Authority:** deltas vs **`ROADMAP.md` § Phase 6 — Admin Portals (State + Tenant)** (~lines 1311–1380).  
**Baseline shipped:** Master Sprints **6.1–6.12** (Tenant + State portals, catalogue alignment, designer polish, P1 operator polish, P2 reporting/bulk ops/state visibility, P3 governance/transparency, P4 content/reports/branding/bookings, P5 identity/library/integration hardening).

**Gate before Phase 7:** **Sprint 6.13** (Operator Desk) is **closed (2026-05-18)** — [`master-sprint-613-exit.md`](../runbooks/master-sprint-613-exit.md). **Phase UX (Sprints 6.14–6.19)** is **confirmed and next** — [`phase-ux-revamp-plan.md`](../runbooks/phase-ux-revamp-plan.md) — Tricolor Calm + tenant themes on PWA, Tenant Admin, State Admin, mobile in **6.19**. **Phase 7 starts after 6.19 UX sign-off.**

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

| Order | Priority | Phase 6 vision item (summarized)                                                                                   | Portal                  | Repo today\*                      | Suggested sprint theme                 | Notes                                                                                                                                                                                                                                          |
| :---: | :------: | ------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1   |    P1    | **Maintenance banners / outage notices**                                                                           | Tenant                  | Closed engineering — Sprint 6.8   | _Admin polish_ — tenant-scoped banners | `tenant_banners` + Tenant Admin CRUD + citizen workspace display.                                                                                                                                                                              |
|   2   |    P1    | **Document checklist UX** (guided checklist editor vs raw JSON only)                                               | Tenant                  | Closed engineering — Sprint 6.8   | _Config UX_                            | Guided rows persist to existing `required_documents` service config.                                                                                                                                                                           |
|   3   |    P1    | **Fee-rule guided editor + validation UX**                                                                         | Tenant                  | Closed engineering — Sprint 6.8   | _Config UX_                            | Guided controls preserve safe `FeeRule` JSON and backend preview.                                                                                                                                                                              |
|   4   |    P1    | **Notification template UX** — live variable preview / channel matrix (SMS first; extend to email/WhatsApp)        | Tenant                  | Closed engineering — Sprint 6.8   | _Comms UX_                             | Channel form + placeholder preview; provider sending still deferred.                                                                                                                                                                           |
|   5   |    P2    | **Dashboard depth** — trends, SLA drill-down lists, breached queue links (beyond headline KPI counts)              | Tenant                  | Closed engineering — Sprint 6.9   | _Observability_                        | `dashboard/deep` API + Tenant Admin trend, breached queue, and workload cards.                                                                                                                                                                 |
|   6   |    P2    | **Operational CSV exports** — applications, payments, grievances, SLA summaries per tenant                         | Tenant                  | Closed engineering — Sprint 6.9   | _Reporting v1_                         | Bearer-token CSV downloads with tenant scope and formula-injection hardening.                                                                                                                                                                  |
|   7   |    P2    | **Address master bulk CSV import**                                                                                 | Tenant                  | Closed engineering — Sprint 6.9   | _Masters UX_                           | Dry-run/import UI with header checks, row errors, and valid-row partial import.                                                                                                                                                                |
|   8   |    P2    | **State audit log** — search, filters, pagination, export                                                          | State                   | Closed engineering — Sprint 6.9   | _Governance UX_                        | Filtered audit API/UI, cursor pagination, and CSV export.                                                                                                                                                                                      |
|   9   |    P2    | **Tenant directory drill-down** — tenant detail pane (health, configs, warnings)                                   | State                   | Closed engineering — Sprint 6.9   | _State ops UX_                         | Tenant detail API/pane with health counts, warnings, config, and audit events.                                                                                                                                                                 |
|  10   |    P3    | **Tariff / revenue-head UX parity** — forms over JSON where safe                                                   | Tenant                  | Closed engineering — Sprint 6.10  | _Masters polish_                       | Guided revenue/tariff forms over existing master APIs, JSON fallback retained.                                                                                                                                                                 |
|  11   |    P3    | **Global / inherited service catalogue** — adopt, fork, deactivate patterns                                        | Tenant + API            | Closed engineering — Sprint 6.10  | _Catalogue governance_                 | Conflict-safe tenant adopt/fork/deactivate without global curator scope.                                                                                                                                                                       |
|  12   |    P3    | **Workflow escalation UX** — policy blocks beyond linear transitions (timeouts, escalate-to-role)                  | Tenant                  | Closed engineering — Sprint 6.10  | _Workflow depth_                       | Guided `escalate`/`sla_timer` effect payloads; no background worker execution.                                                                                                                                                                 |
|  13   |    P3    | **State analytics v2** — time ranges, deltas, anomaly hints                                                        | State                   | Closed engineering — Sprint 6.10  | _Executive metrics_                    | Bounded aggregate analytics over existing data; no retained metrics warehouse.                                                                                                                                                                 |
|  14   |    P3    | **Transparency pack** — cross-tenant leaderboards / published CSV summaries for citizen portal                     | State + Citizen surface | Closed engineering — Sprint 6.10  | _Open data slice_                      | Public-safe aggregate APIs/CSV; no PII/operator/audit metadata exposure.                                                                                                                                                                       |
|  15   |    P4    | **Reports PDF** — Playwright or server-rendered PDF for SLA/revenue                                                | Tenant                  | Closed engineering — Sprint 6.11  | _Reporting v2_                         | Tenant PDF exports over aggregate report query contracts; no scheduled emails.                                                                                                                                                                 |
|  16   |    P4    | **Knowledge Base CMS richness** — WYSIWYG, `.docx` import (Mammoth), media                                         | Tenant                  | Closed engineering — Sprint 6.11  | _Content ops_                          | Guided markdown authoring, preview, safe media refs, and JSON fallback.                                                                                                                                                                        |
|  17   |    P4    | **KB publish → RAG indexer trigger** (on-demand / nightly reconcile)                                               | Tenant + svc            | Closed engineering — Sprint 6.11  | _RAG infra_                            | Idempotent `kb_index_jobs` trigger/reconcile contract; embeddings remain Phase 7.                                                                                                                                                              |
|  18   |    P4    | **Branding pipeline** — safe asset uploads (MinIO), presets, WCAG-ish contrast checks                              | Tenant                  | Closed engineering — Sprint 6.11  | _Theming UX_                           | Tenant-scoped logo/hero asset registration and contrast checks.                                                                                                                                                                                |
|  19   |    P4    | **Bookable assets manager + calendars**                                                                            | Tenant                  | Closed engineering — Sprint 6.11  | _New bounded context (bookings)_       | Asset/availability/blackout/reservation MVP with overlap rejection.                                                                                                                                                                            |
|  20   |    P5    | **Staff invite + Keycloak user provisioning UX**                                                                   | Tenant                  | Closed engineering — Sprint 6.12  | _Identity lifecycle_                   | Guided invite/provisioning UX with safe local/dry-run Keycloak boundary.                                                                                                                                                                       |
|  21   |    P5    | **Global Service Library curator** (state-wide template authoring)                                                 | State                   | Closed engineering — Sprint 6.12  | _Library product_                      | State template authoring/publish/deprecate over existing catalogue governance.                                                                                                                                                                 |
|  22   |    P5    | **State integration cockpit** (DigiLocker, PSP, SMS DLT, etc.)                                                     | State                   | Closed engineering — Sprint 6.12  | _Enterprise integrations_              | Metadata/readiness cockpit only; no production secrets or live provider launch.                                                                                                                                                                |
|  23   |    P5    | **Phase 6 “exit prose” verbatim** — every admin mutation audited everywhere; wizard-only onboarding for Nᵗʰ tenant | Both                    | Closed engineering — Sprint 6.12  | _Hardening / audit completeness_       | Measurable audit/onboarding hardening subset; full sponsor acceptance remains broader.                                                                                                                                                         |
|  24   |   Gate   | **Operator Desk** — clerk/admin application workflow inbox + grievance handling in Tenant Admin                    | Tenant (`admin-tenant`) | Closed — Sprint 6.13 (2026-05-18) | _ULB processing workstation_           | Desk on :3002; functional smoke done.                                                                                                                                                                                                          |
|  25   |   Gate   | **Phase UX** — Tricolor Calm revamp; tenant `theme_color` workspaces; citizen → admin → state + mobile             | PWA + admin + mobile    | **Next — 6.14–6.19**              | _Experience layer_                     | Confirmed 2026-05-18; **blocks Phase 7** until 6.19 exit.                                                                                                                                                                                      |
|  26   |  Follow  | **EN-4 — Global form templates + onboarding auto-publish** (follow-up to EN-3)                                     | State + API + Citizen   | **Backlog**                       | _Onboarding completeness_              | [`EN-4-global-form-templates-onboarding.md`](./EN-4-global-form-templates-onboarding.md) — State `form_schema` in library UI, seed backfill, activate publishes v1 tenant forms so citizens see services without mandatory Tenant Admin edits. |

\* **Repo today** legend: aligned with **`apps/admin-tenant`** + **`apps/admin-state`** dashboards as of backlog authoring; APIs may expose more than the portal surfaces.

---

## Cross-reference

- **`ROADMAP.md`** — full Phase‑6 ambition and sprint slice (**6.1–6.7**).
- **`docs/runbooks/master-sprint-61-exit.md`** … **`master-sprint-69-exit.md`** — what landed in-queue.
- **`docs/runbooks/master-sprint-69-plan.md`** / **`master-sprint-69-exit.md`** — P2 sprint plan and engineering exit record.
- **`docs/runbooks/master-sprint-610-plan.md`** / **`master-sprint-610-exit.md`** — P3 sprint plan and engineering exit record.
- **`docs/runbooks/master-sprint-611-plan.md`** / **`master-sprint-611-exit.md`** — P4 sprint plan and engineering exit record.
- **`docs/runbooks/master-sprint-612-plan.md`** / **`master-sprint-612-exit.md`** — P5 sprint plan and engineering exit record.
- **`docs/runbooks/master-sprint-613-plan.md`** / **`master-sprint-613-exit.md`** — Operator Desk (functional gate, closed).
- **`docs/runbooks/phase-ux-revamp-plan.md`** / **`master-sprint-614-plan.md`** — Phase UX programme (gate before Phase 7).
- **`docs/help/start-the-app-step-by-step.md`** — how to smoke local portals.

---

## Using this backlog in a sprint

1. Confirm sponsor **must-have slice** vs this default order or pick rows by **`Order`**.
2. For each slice: write **definition of ready** — API endpoints, tenancy rules, rollback, QA data.
3. Add `tests/security` or domain contract specs when touching cross-cutting behaviour (patterns in `tests/security/`).
4. When a slice **closes**, append a **`docs/runbooks/master-sprint-*.md`** (or backlog row update) linking **Order** IDs.

_Last updated: 2026-05-27 (added EN-4 follow-up to EN-3 onboarding / global form templates)._
