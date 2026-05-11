# Phase 1 Sprint 1.4 Security Review

## Scope

- i18n catalogues for English, Bengali, and Hindi.
- Runtime tenant theming from tenant metadata.
- Tenant onboarding CLI and seed registry.
- DigiLocker remains blocked because access / permission is unavailable.

## Findings

- No new PII sink was added. Mobile numbers are still redacted in API logs.
- Browser token storage remains scoped to the current session and uses Web Crypto when available.
- CORS is explicit for local citizen PWA development through `CORS_ORIGIN`.
- Tenant onboarding writes data into `infrastructure/seed/tenants/tenant-seeds.json`; it does not require code changes.
- DigiLocker / Aadhaar linking is intentionally not implemented beyond a placeholder response.
- OWASP ZAP auth scan passed with `FAIL-NEW: 0`, `WARN-NEW: 0`, and 119 passing checks.

## Required Gates

- `@enagar/i18n` test must fail when any locale is missing a message key.
- Security tests must confirm the DigiLocker route is still marked blocked in `ROADMAP.md`.
- Tenant seed registry: **nine** seeded tenants in code (`tenant.seed.ts`) — **eight municipal ULBs** plus **`WBPORTAL`** (citizen portal, Keycloak Option A). `GET /api/tenants` returns **eight ULBs only** (portal omitted from pickers). New onboarding ULB records remain the eight-city rule unless Sponsor extends catalogue.
- `pnpm security:zap:auth` must complete without high/critical findings before Phase 1 is closed.
