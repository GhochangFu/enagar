# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

## Current surface

Phase 1 implements the citizen onboarding shell:

- Splash screen.
- Language picker for English, Bengali, and Hindi.
- Mobile OTP login using the API.
- Tenant picker backed by `GET /api/tenants`.
- Empty home screen with selected tenant name, ward count, and runtime theme.

The app uses the shared Tailwind preset (`@enagar/config/tailwind/base`),
`@enagar/i18n`, and `@enagar/tenant-theme` so per-tenant theming works without a
rebuild.

## Run locally

```bash
pnpm --filter @enagar/citizen-pwa dev    # http://localhost:3000
pnpm --filter @enagar/citizen-pwa build
```

## What's coming (per ROADMAP.md)

| Phase | Adds                                               |
| ----- | -------------------------------------------------- |
| 2     | Service catalogue, dynamic forms (`@enagar/forms`) |
| 3     | Payment gateway integration                        |
| 4     | Grievance redressal flow                           |
| 5     | Native mobile parity and offline app shell         |
| 7     | Sahayak AI floating chat (SSE → `apps/api`)        |
