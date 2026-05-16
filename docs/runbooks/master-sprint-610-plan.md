# Master Sprint 6.10 Plan — Phase 6 P3 Catalogue Governance, Workflow Depth, and Public Transparency

Status: **executed — closed engineering 2026-05-16**. Exit record: `docs/runbooks/master-sprint-610-exit.md`.

## Scope

Deliver the five **P3** rows from `docs/backlog/phase-6-vision-backlog-prioritized.md` as one Phase 6 continuation sprint:

- Tenant tariff / revenue-head UX parity: guided forms over JSON where safe.
- Global / inherited service catalogue governance: adopt, fork, deactivate, and conflict-safe tenant overrides.
- Workflow escalation UX: policy blocks for SLA timeout and escalate-to-role behaviour over the existing workflow designer contracts.
- State analytics v2: time ranges, deltas, and anomaly hints without introducing a metrics warehouse.
- Transparency pack: state-level public CSV/API summaries and lightweight citizen-facing discoverability.

This sprint is about **governance and explainability over existing data/contracts**. It should not introduce a new worker runtime, PDF reporting, SIEM integration, or a full state service-library curator.

## Key Existing Surfaces

- `apps/admin-tenant/app/dashboard/masters/masters-client.tsx` already edits revenue heads and tariffs, but still relies on JSON text areas for structured rate config.
- `apps/api/src/modules/admin-tenant/admin-tenant.controller.ts` exposes revenue-head, tariff, service catalogue, and workflow draft/publish APIs.
- `apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx` already has the React Flow workflow canvas and workflow JSON fallback.
- `packages/workflow/src/index.ts` already supports `sla_timer` and `escalate` effect types, but escalation authoring is not guided.
- `apps/api/src/modules/admin-state/admin-state.service.ts` already exposes state analytics and tenant directory details.
- Public Phase 4 metrics already exist under grievance/public stats patterns; reuse public-safe aggregation conventions rather than leaking tenant internals.
- Security contract patterns live in `tests/security/master-sprint-*.spec.ts`; add one for this sprint during implementation.

## Sub-Sprints

### 6.10A — Tenant Masters UX Parity

Deliverables:

- Replace raw JSON-first tariff authoring with guided controls for common tariff/rate configs:
  - fixed amount.
  - slab tiers.
  - computed/external reference with guarded metadata fields.
- Add guided revenue-head controls for:
  - code.
  - multilingual name.
  - accounting code.
  - active flag.
- Preserve JSON fallback for uncommon tariff config.
- Keep existing `GET/PATCH /admin/tenant/revenue-heads` and `GET/PATCH /admin/tenant/tariffs` contracts unless backend validation gaps require DTO tightening.
- Add clear preview labels for paise/rupees and backend `preview_paise` values.

Non-goals:

- No GL posting redesign.
- No accounting export integration.
- No tax-assessment engine changes.

### 6.10B — Global / Inherited Service Catalogue Governance

Deliverables:

- Add tenant-scoped catalogue governance API(s), likely:
  - `GET /admin/tenant/catalogue/inherited`
  - `POST /admin/tenant/catalogue/:globalCode/adopt`
  - `POST /admin/tenant/catalogue/:serviceCode/fork`
  - `POST /admin/tenant/catalogue/:serviceCode/deactivate`
- Return each service with source classification:
  - global default.
  - tenant override.
  - tenant-only.
  - forked local copy.
- Define conflict rules for fork/adopt/deactivate:
  - cannot silently overwrite an active tenant service with the same code.
  - fork must create a tenant-owned editable service row with inherited form/config defaults.
  - deactivate must affect only the tenant’s visible service, not the global template.
- Add Tenant Admin UI for catalogue governance:
  - filter by category/source/status.
  - compare inherited vs local values.
  - adopt/fork/deactivate actions with confirmation and plain-language impact.

Non-goals:

- No state-wide global service library curator UI in this sprint.
- No citizen runtime contract change beyond reading already-published tenant services.
- No bulk catalogue import.

### 6.10C — Workflow Escalation UX

Deliverables:

- Add guided workflow effect editor for supported transition side effects:
  - `audit`.
  - `notify`.
  - `sla_timer`.
  - `certificate`.
  - `escalate`.
- Add escalation policy controls for `escalate` payloads:
  - trigger stage or transition.
  - timeout hours.
  - target role.
  - notification template code, if available.
- Validate escalation payloads in `@enagar/workflow` and API save paths.
- Surface validation errors in the Tenant Admin workflow canvas before save/publish.
- Preserve raw JSON fallback for advanced workflow definitions.

Non-goals:

- No background escalation worker execution in this sprint.
- No new notification provider sends.
- No BPMN/general workflow engine.

### 6.10D — State Analytics V2

Deliverables:

- Add state analytics v2 API, likely `GET /admin/state/analytics/v2?from=&to=&compare_to=`.
- Return:
  - time-window KPI totals.
  - deltas vs previous equivalent window.
  - top/bottom tenant slices by applications, grievances, payments, and SLA breach indicators.
  - anomaly hints from simple thresholds over existing data.
- Add State Super-Admin UI controls for date range and compare mode.
- Keep queries bounded and explicit-column/aggregate only.
- Reuse existing tenant/state role checks.

Non-goals:

- No retained metrics warehouse.
- No ML anomaly detection.
- No charting dependency unless existing UI patterns are insufficient.

### 6.10E — Transparency Pack

Deliverables:

- Add public-safe transparency endpoints, likely:
  - `GET /public/transparency/summary`
  - `GET /public/transparency/tenants.csv`
  - `GET /public/transparency/services.csv`
  - `GET /public/transparency/sla.csv`
- Return only aggregate, non-PII, non-operator data.
- Add CSV formula-injection hardening for public CSV outputs.
- Add a lightweight citizen PWA link/section to discover published state transparency summaries.
- Document which fields are public-safe and which are explicitly excluded.

Non-goals:

- No individual application/grievance records.
- No personal data, operator names, payment identifiers, or audit metadata.
- No cross-tenant leaderboard that ranks sensitive operational failures without sponsor approval; start with transparent aggregate summaries.

### 6.10F — Docs, Tests, Verification

Deliverables:

- Add `docs/runbooks/master-sprint-610-exit.md` during execution with deliverables, non-goals, verification commands, and smoke steps.
- Update `docs/backlog/phase-6-vision-backlog-prioritized.md` from “planned” to “closed engineering” only after implementation and verification.
- Update `README.md`, `ROADMAP.md`, `apps/admin-tenant/README.md`, `apps/admin-state/README.md`, `docs/help/start-the-app-step-by-step.md`, and `tests/security/README.md` after implementation.
- Add `tests/security/master-sprint-610.spec.ts` covering:
  - guided tariff/revenue-head UX keeps backend validation as source of truth.
  - catalogue governance never mutates global templates from tenant actions.
  - workflow escalation payload validation rejects unsafe/unknown effect payloads.
  - state analytics v2 is state-admin only and uses bounded ranges.
  - transparency endpoints expose aggregates only and CSV-safe output.
- Extend focused API/UI tests where existing service specs make this practical.

## Exit Criteria

- Tenant admin can edit revenue heads and common tariffs through guided controls without losing JSON fallback.
- Tenant admin can distinguish inherited, overridden, forked, and tenant-only services.
- Tenant admin can adopt, fork, or deactivate catalogue services with conflict-safe confirmations.
- Tenant admin can author workflow escalation metadata through guided controls and see validation errors before publish.
- State super-admin can view analytics v2 with time ranges, deltas, tenant slices, and simple anomaly hints.
- Public transparency APIs/CSV expose aggregate non-PII data only.
- Existing Sprint 6.6 citizen catalogue alignment, Sprint 6.7 designer contracts, Sprint 6.9 reporting, and full security contracts remain valid.
- No background worker, SIEM, PDF, global curator, or citizen personal-data exposure is introduced.

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
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa lint
pnpm test:security -- --runTestsByPath tests/security/master-sprint-610.spec.ts tests/security/master-sprint-66.spec.ts tests/security/master-sprint-67.spec.ts tests/security/master-sprint-69.spec.ts
pnpm test:security
graphify update .
```

## Manual Smoke After Completion

1. Start infra, migrate, seed, API, Tenant Admin, State Super-Admin, and Citizen PWA.
2. Sign into Tenant Admin as a KMC/HMC municipality admin.
3. Open Masters and edit a revenue head plus a fixed/slab tariff through guided controls; reload and confirm persistence/preview.
4. Open catalogue governance and adopt/fork/deactivate a low-risk service; confirm citizen catalogue still shows the intended active service.
5. Open Configure for a low-risk service and add an escalation effect to a workflow transition; save, reload, publish, and confirm validation.
6. Sign into State Super-Admin and open analytics v2 with a custom date range; confirm deltas and tenant slices render.
7. Open public transparency summary/CSV endpoints and confirm no PII/operator/audit metadata appears.
8. Confirm existing Sprint 6.9 exports and State audit search still work.

## Decision Defaults

- Sprint name: `Master Sprint 6.10 — Phase 6 P3 Catalogue Governance, Workflow Depth, and Public Transparency`.
- Keep all five P3 rows together only if implementation remains within existing tables/contracts; split before execution if catalogue governance or transparency requires new schema.
- Prefer guided UI over replacing backend contracts.
- Prefer aggregate SQL over retained analytics infrastructure.
- Prefer CSV/API transparency over PDF/report rendering.
- Do not add new npm dependencies unless the implementation review proves existing parsing/rendering helpers insufficient.
