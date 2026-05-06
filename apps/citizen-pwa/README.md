# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

## Phase-0 surface

A single landing page styled with the shared Tailwind preset (`@enagar/config/tailwind/base`) and the brand-CSS-var system (`--brand-rgb`) so per-tenant theming works without a rebuild.

## Run locally

```bash
pnpm --filter @enagar/citizen-pwa dev    # http://localhost:3000
pnpm --filter @enagar/citizen-pwa build
```

## What's coming (per ROADMAP.md)

| Phase | Adds                                                       |
| ----- | ---------------------------------------------------------- |
| 1     | Auth flow (Keycloak), tenant resolution, language switcher |
| 2     | Service catalogue, dynamic forms (`@enagar/forms`)         |
| 3     | Payment gateway integration                                |
| 4     | Grievance redressal flow                                   |
| 5     | Bookings & venue calendar                                  |
| 7     | Sahayak AI floating chat (SSE → `apps/api`)                |
