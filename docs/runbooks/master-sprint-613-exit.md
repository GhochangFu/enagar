# Master Sprint 6.13 Exit — Operator Desk in Tenant Admin

Status: **closed — engineering and manual smoke 2026-05-18**. **Next programme:** Phase UX (**6.14–6.19**) gates Phase 7 — [`phase-ux-revamp-plan.md`](./phase-ux-revamp-plan.md).

## Delivered

- Tenant Admin now includes a **Desk** route at `/dashboard/desk` for clerk/admin processing of application dockets and grievances.
- Clerk roles (`tenant_clerk`, `municipality_clerk`) can use `/admin/tenant/desk/*` APIs while existing configuration routes remain admin-only.
- Dashboard login fallback redirects clerk-only users to Desk when config APIs return 403.
- Desk application APIs expose my/all queues, dossier detail, allowed workflow transitions, and transition execution through `@enagar/workflow` `evaluateTransition`.
- Application draft submission now prefers the latest published DB workflow definition for the service, falling back to fixture patterns only when no published workflow exists.
- Desk grievance APIs expose my/all/breached queues, detail, status updates, comments, admin assignment, and admin-only SLA sweep.
- Desk mutations write audit events (`desk.application.transition`, `desk.grievance.*`) through the Sprint 6.12 audit pattern.
- Security contract `tests/security/master-sprint-613.spec.ts` documents clerk access, application transition, grievance action, UI, and Phase 7 gate expectations.
- **Citizen PWA (post-smoke):** hub **Apply** picker lists `/tenants` directly (no disabled hub/dashboard join); choosing a ULB opens workspace **Services**. Birth-cert dev defaults align with published schema (`applicant_dob` via `defaultFormValuesForSchema`).

## Non-goals preserved

- No separate operator PWA app.
- No Phase 7 Sahayak/RAG work in this sprint.
- No field `staff-mobile` app.
- No background SLA auto-escalation worker.

## Verification

Completed:

```bash
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/admin-tenant typecheck
pnpm test:security -- --runTestsByPath tests/security/master-sprint-613.spec.ts
```

Full exit verification:

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant lint
pnpm --filter @enagar/admin-tenant build
pnpm test:security -- --runTestsByPath tests/security/master-sprint-613.spec.ts
pnpm test:security
graphify update .
```

## Manual smoke

**Signed off 2026-05-18** — local stack: API **:3001**, Citizen PWA **:3000**, Tenant Admin **:3002**, Keycloak dummy users (`docs/runbooks/keycloak.md`).

| #   | Scenario                                                                        | Result |
| --- | ------------------------------------------------------------------------------- | ------ |
| 1   | Infra up, migrate, seed, API, Tenant Admin, Citizen PWA, Keycloak dummy users   | Pass   |
| 2   | Citizen: submit application (`tenant_clerk` pending) + file grievance (PWA)     | Pass   |
| 3   | Clerk: Tenant Admin → Desk → both in **My queue**                               | Pass   |
| 4   | Clerk: application workflow action + timeline                                   | Pass   |
| 5   | Clerk: grievance in progress → resolved + comment                               | Pass   |
| 6   | Citizen: PWA refresh shows updated status/timeline                              | Pass   |
| 7   | Admin: Desk **All open**, SLA sweep, Dashboard → Desk; assign when staff seeded | Pass   |
| 8   | Clerk: `/dashboard/masters` — config APIs blocked (403)                         | Pass   |
| 9   | Regression: Sprint 6.11/6.12 exports + staff invite (Operations)                | Pass   |

**Operators:** `kmc-tenant-clerk-dummy` / `kmc-municipality-clerk-dummy` (Desk); `kmc-municipality-admin-dummy` (Desk + Dashboard/Masters/Operations). Password: `DummyDev_2026!ChangeMe` (or `KEYCLOAK_DUMMY_USER_PASSWORD`). Citizen dev OTP: mobile + OTP `12345` when `DEV_AUTH_ENABLED`.
