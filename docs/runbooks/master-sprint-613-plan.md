# Master Sprint 6.13 Plan — Operator Desk in Tenant Admin (Applications + Grievances)

Status: **executed — engineering verification in progress** (gate before **Phase 7**).

## Decision (locked)

- **No separate clerk PWA.** Operator processing lives in **`apps/admin-tenant`** on port **3002**.
- **Clerks and municipality admins** use the **same Keycloak login**; **role-gated navigation** separates Desk from configuration.
- **Phase 7 (Sahayak AI / RAG)** does not start until this sprint’s engineering exit + manual smoke are closed — **both closed 2026-05-18** ([`master-sprint-613-exit.md`](./master-sprint-613-exit.md)).

## Problem

Citizens can submit **applications** and **grievances**, and Tenant Admin can **design** workflows — but there is no ULB workstation for:

- Clerks to see **what is pending at their role** (and optional ward).
- Clerks/admins to **approve / reject / forward** dockets per published workflow verbs.
- Clerks/admins to **manage grievances** (status, assign, comment) without Swagger/SQL.

Today:

- `tenant_clerk` / `municipality_clerk` are **blocked** from `/admin/tenant/*` config APIs.
- `ApplicationsService.canAccess` allows only the **citizen owner** — staff cannot read/act on dockets via `/applications`.
- Submit uses **`workflowForPattern()`** fixtures; published DB workflows may **diverge** from runtime transitions.
- Grievance **staff APIs** exist on `/grievances` but **no Tenant Admin UI**.

## Scope

Deliver an **Operator Desk** inside Tenant Admin:

1. **Desk APIs** under `/admin/tenant/desk/*` (clerk + admin roles).
2. **Desk UI** at `/dashboard/desk` (applications + grievances inbox, detail, actions).
3. **Application workflow execution** — `POST …/desk/applications/:id/transitions` using `@enagar/workflow` `evaluateTransition`.
4. **Grievance desk** — inbox + detail wrapping existing grievance staff semantics.
5. **Align submit** with **published workflow** when present (fallback to pattern).
6. **Audit** desk mutations; security contracts; runbook smoke.

## Role model

| Role                                 | Desk access           | Config (Masters, designer, Operations write) |
| ------------------------------------ | --------------------- | -------------------------------------------- |
| `tenant_clerk`, `municipality_clerk` | Yes — default landing | **No** (403 + hidden nav)                    |
| `tenant_admin`, `municipality_admin` | Yes — full queues     | Yes (existing)                               |
| `state_admin`                        | Yes (support)         | Yes (existing)                               |

Normalize role aliases in one helper (mirror `grievance-staff-roles.ts`): accept `tenant_clerk` ↔ `municipality_clerk` for transition `actor_role` matching.

## Sub-Sprints

### 6.13A — Desk API foundation

Deliverables:

- `assertDeskAccess(principal)` — clerk + admin roles; tenant JWT required.
- Keep `assertTenantPortalStaff()` on existing **config** routes (admin-only).
- `GET /admin/tenant/desk/me` — roles, ward scopes from `user_roles`, display hints.
- `GET /admin/tenant/desk/inbox/summary` — counts (applications pending my role, grievances my queue, SLA breached).
- `GET /admin/tenant/desk/inbox/applications` — filters: `queue=my|all`, `status`, pagination; match `pending_role` to operator roles; optional ward filter via citizen `ward_id`.
- `GET /admin/tenant/desk/applications/:docketNo` — dossier: application, citizen summary (policy-masked), documents, timeline, payment status, **allowed_transitions[]**.
- `POST /admin/tenant/desk/applications/:id/transitions` — body `{ verb, comment? }`; load **published workflow** for service (`workflows` + stages + transitions) or fallback `workflowForPattern`; `evaluateTransition`; update `applications`, `application_timeline`, `pending_role`, `current_stage_id`; apply v1 effects (`notify`, `audit`, `escalate` payload → `pending_role`, `sla_timer` → `runtime_snapshot`).
- Respect **`role_stage_map.can_act`** when rows exist for current stage + role.
- `submitDraft` / new submissions: prefer published workflow initial stage when published workflow exists.
- Desk audit events: `desk.application.transition`, etc. (tenant-scoped; extend Sprint 6.12 audit patterns).

Non-goals:

- No background SLA escalation worker.
- No finance/refund/challan desk in this sprint.
- No `staff-mobile` field app.

### 6.13B — Desk grievance surface

Deliverables:

- `GET /admin/tenant/desk/inbox/grievances` — `queue=my|assigned|breached|all` (all = admin).
- `GET /admin/tenant/desk/grievances/:id` — detail + timeline + **allowed_statuses[]** from lifecycle rules.
- Desk proxies (or thin wrappers) for:
  - `PATCH` status
  - `POST` assign (admin; optional clerk policy in v1)
  - `POST` comment
  - `POST staff/sweep-sla` (**admin only**)
- Reuse `GrievancesService` where possible; enforce desk auth at controller.

Non-goals:

- No citizen-facing UI changes required for v1.
- No native push on status change.

### 6.13C — Tenant Admin Desk UI

Deliverables:

- Route **`/dashboard/desk`** with tabs **Applications** | **Grievances**.
- **Clerk post-login redirect** to `/dashboard/desk` (not `/dashboard` config home).
- **Role-gated layout**: hide Dashboard configure links, Masters, Operations (write), service designer URLs for clerk-only JWTs; route guard returns 403 or redirect to Desk.
- **Applications list** — docket, service, stage, pending role, SLA chip; filter My queue / (admin) All open / Breached.
- **Application detail** — read-only form summary, documents, timeline; action buttons from `allowed_transitions`; comment modal when `requires_comment`.
- **Grievances list + detail** — status actions, assign (admin), comment, timeline.
- **Admin**: link from existing dashboard breached queue cards → Desk detail deep link (`?docket=` / `?grievance=`).
- i18n for desk labels (en/bn/hi) via `@enagar/i18n` where practical.

Non-goals:

- No PWA manifest separate from admin-tenant.
- No offline mode.

### 6.13D — Tests, docs, verification

Deliverables:

- `docs/runbooks/master-sprint-613-exit.md`
- Update `ROADMAP.md`, `README.md`, `apps/admin-tenant/README.md`, `docs/help/start-the-app-step-by-step.md`, `tests/security/README.md`
- `tests/security/master-sprint-613.spec.ts`:
  - clerk can access desk routes; clerk blocked on `PATCH /admin/tenant/services/...`
  - cross-tenant desk denial
  - transition role matrix (wrong role cannot act)
  - grievance desk admin-only sweep
- API unit tests for transition + published-workflow loader
- `graphify update .` after code changes

## Exit criteria

- Clerk dummy user (`kmc-tenant-clerk-dummy` or `kmc-municipality-clerk-dummy`) signs into **Tenant Admin :3002** and lands on **Desk**.
- Clerk **My queue** shows applications with `pending_role` matching clerk role and grievances routed/assigned appropriately.
- Clerk can **transition** a seeded docket through at least one forward verb; timeline and `pending_role` update.
- Municipality admin can act on **admin-stage** transitions, **assign** grievances, and run **SLA sweep**.
- Citizen PWA shows updated application/grievance status after clerk action (existing read APIs).
- Config routes remain **inaccessible** to clerk-only tokens.
- Phase 7 work does not start until this exit record is **closed engineering** + manual smoke passed — **complete 2026-05-18**.

## Verification plan

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- admin-tenant desk
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-613.spec.ts
pnpm test:security
graphify update .
```

## Manual smoke (after implementation)

1. Infra up, migrate, seed, API, Tenant Admin, Citizen PWA, Keycloak dummy users.
2. **Citizen:** submit an application for a service whose workflow pending stage is `tenant_clerk`; file a grievance.
3. **Clerk:** sign in to Tenant Admin → Desk → see both in **My queue**.
4. **Clerk:** open application → run workflow action (e.g. verify/approve) with comment if required; confirm timeline.
5. **Clerk:** open grievance → set in progress → resolved; add comment.
6. **Citizen:** refresh PWA — confirm status/timeline reflects clerk actions.
7. **Admin:** sign in → Desk **All open** + assign grievance; run SLA sweep; open breached card from Dashboard → Desk deep link.
8. **Clerk:** attempt `/dashboard/masters` or service designer URL — blocked.
9. Re-run a subset of Sprint 6.11/6.12 smoke (exports, staff invite) for regression.

## Non-goals (preserved)

- Phase 7 RAG/LLM/chatbot.
- Sprint 3.1B live PSP.
- `apps/staff-mobile` field workflows.
- Live Keycloak provisioning automation (stay dry-run).
- Certificate PDF / DigiLocker push.

## Decision defaults

- Sprint name: **Master Sprint 6.13 — Operator Desk in Tenant Admin**.
- Single portal URL for ULB operators: **`http://localhost:3002`**.
- Desk API prefix: **`/admin/tenant/desk`**; config remains **`/admin/tenant`** with admin-only guard.
