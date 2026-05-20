# Master Sprint 6.22 Plan — Tenant Admin Grievance Configuration

**Status:** **closed — engineering** (2026-05-20)  
**Exit:** [`master-sprint-622-exit.md`](./master-sprint-622-exit.md)  
**Parent:** [`grievance-taxonomy-programme.md`](./grievance-taxonomy-programme.md)  
**Prerequisite:** Sprint **6.21** closed (read APIs + validation live).

## Goal

Give **municipality administrators** self-service control over grievance categories, sub-types, **SLA policies**, and **routing rules** — replacing seed/SQL edits.

## Deliverables

### D1 — Admin tenant API extensions

- `GET/POST/PATCH/DELETE /api/admin/tenant/grievance-catalogue/categories`
- `GET/POST/PATCH/DELETE …/categories/:code/subtypes`
- `GET/PUT /api/admin/tenant/sla-policies` (ordered list replace or CRUD)
- `GET/PUT /api/admin/tenant/grievance-routing-rules`
- RBAC: `municipality_admin` write; `tenant_clerk` / `municipality_clerk` read-only on catalogue config.

### D2 — Masters UI — Grievance catalogue

- Route: `/dashboard/masters` → section **Grievance catalogue** (alongside address/tariff).
- List categories; drawer for en/bn/hi names, icon, sort, active flag.
- Nested sub-type editor; drag reorder optional (stretch: up/down buttons minimum).

### D3 — Operations UI — SLA & routing

- Section tabs or cards in Operations client.
- SLA: category match (dropdown from catalogue codes), priority, hours.
- Routing: category, priority, ward (optional), target role, assign user (optional).
- Orphan rule warning when `category_match` not in active catalogue.

### D4 — Desk integration

- Resolve display labels via catalogue cache (locale-aware).
- Triage dropdown (stretch): reclassify category/subtype on open grievance — **optional**; minimum is read-only correct labels.

### D5 — Audit & docs

- Audit log entries on catalogue mutations (reuse Sprint 6.9 pattern if present).
- Tenant Admin README section.

### D6 — Security

- `tests/security/master-sprint-622.spec.ts`

## Exit criteria

See [`master-sprint-622-exit.md`](./master-sprint-622-exit.md) — admin can add `noise_pollution` end-to-end without code deploy.

## Verification

```bash
pnpm --filter @enagar/admin-tenant typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-622.spec.ts
```

Manual: Tenant Admin `:3002` → Masters → Grievance catalogue → Operations → SLA/Routing → Desk label check.
