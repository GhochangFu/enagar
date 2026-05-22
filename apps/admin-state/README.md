# @enagar/admin-state — State Super-Admin Portal

Sprint 6.5 turns this package into the State Super-Admin portal on **http://localhost:3003**.

## What It Does

- Tenant onboarding wizard JSON editor backed by `PATCH /api/admin/state/tenants`
- Tenant directory + cross-tenant KPI dashboard from `GET /api/admin/state/*`
- Audited 15-minute tenant impersonation token creation
- State-admin audit log search, cursor pagination, and CSV export
- Sprint 6.9 tenant directory drill-down with health counts, warnings, config highlights, and tenant audit events
- Sprint 6.10 analytics v2 with date ranges/deltas/anomaly hints and public transparency pack support
- Sprint 6.12 P5 surfaces: global service library curator, integration cockpit metadata/readiness, and onboarding/audit hardening

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

## Phase UX — Sprint 6.19 (closed)

- Platform **teal** accent via `applyStateAdminTheme()` (`#0E7490`) — distinct from tenant Warm Coral.
- Login, **`StateAdminShell`** (sidebar + icon nav, shared **`OperatorAppFooter`**), dashboard guided forms, KPI strip, tenant drawer.
- Typography: **DM Sans** across operator surfaces; icon+label **`@enagar/ui`** buttons on primary actions.
- Plan / previews: **`docs/runbooks/typography-dm-sans-ux-plan.md`**, **`docs/design-previews/citizen-pwa-shell-preview.html`** (citizen chrome reference).
- Exit: `docs/runbooks/master-sprint-619-exit.md`
- **Next programme gate:** Citizen mobile PWA parity — `docs/runbooks/master-sprint-620-plan.md`

## Engineering Exit Record

- `docs/runbooks/master-sprint-65-exit.md`
- `docs/runbooks/master-sprint-69-exit.md`
- `docs/runbooks/master-sprint-610-exit.md`
- `docs/runbooks/master-sprint-612-exit.md`

## Explicit Non-Goals

- No live Keycloak user provisioning from the onboarding wizard.
- No production support-session handoff UI; this sprint generates and audits the short-lived token.
- No automatic tenant migration when a global service template is published or deprecated.
- No audit SIEM integration or tenant onboarding redesign in Sprint 6.9.
- No retained metrics warehouse, SIEM integration, or PII-bearing transparency feed in Sprint 6.10.
- No live provider secrets, procurement workflow, or production integration launch in Sprint 6.12.
