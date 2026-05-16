# @enagar/admin-state — State Super-Admin Portal

Sprint 6.5 turns this package into the State Super-Admin portal on **http://localhost:3003**.

## What It Does

- Tenant onboarding wizard JSON editor backed by `PATCH /api/admin/state/tenants`
- Tenant directory + cross-tenant KPI dashboard from `GET /api/admin/state/*`
- Audited 15-minute tenant impersonation token creation
- State-admin audit log search, cursor pagination, and CSV export
- Sprint 6.9 tenant directory drill-down with health counts, warnings, config highlights, and tenant audit events

## Local Run

```bash
pnpm --filter @enagar/admin-state dev
```

Copy `.env.example` to `.env.local` only if you need to override defaults.

## Sign-In Flow

The portal uses the Keycloak `admin-state` public client and Authorization Code + PKCE.
The JWT must include the `state_admin` role and tenant claims from the `tenant-claims`
scope. Local dummy users come from `pnpm infra:seed-keycloak-users`; enroll MFA for
`state_admin` accounts when the API verifier requires it.

## Engineering Exit Record

- `docs/runbooks/master-sprint-65-exit.md`
- `docs/runbooks/master-sprint-69-exit.md`

## Explicit Non-Goals

- No live Keycloak user provisioning from the onboarding wizard.
- No production support-session handoff UI; this sprint generates and audits the short-lived token.
- No global service library curator UI; inherited defaults use the existing catalogue seeds.
- No audit SIEM integration or tenant onboarding redesign in Sprint 6.9.
