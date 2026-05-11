# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

## Current surface

- **Onboarding (Phase 1):** splash → language → mobile OTP → tenant picker → authenticated workspace.
- **Services & applications (Phase 2):** tenant catalogue, `@enagar/forms` apply flow, draft → document scan simulation → submit, **My Applications** with detail + comments.
- **Payments (Phase 3 stub rail):** initiate stub payment, simulate PSP capture, list payments, receipt metadata preview.
- **Grievances (Phase 4 — Sprint 4.2):** **Grievances** tab — profile gate (`/citizen/register` when needed), category + priority + description, optional location notes, list/detail with SLA chips, timeline, comments, and **rating after resolved** (closes to `closed` per API).

Shared: Tailwind preset (`@enagar/config/tailwind/base`), `@enagar/i18n`, `@enagar/tenant-theme`.

## Run locally

```bash
pnpm --filter @enagar/citizen-pwa dev    # http://localhost:3000
pnpm --filter @enagar/citizen-pwa build
```

Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001/api`) to point at `@enagar/api`.

## What's coming (per ROADMAP.md)

| Phase | Adds                                                        |
| ----- | ----------------------------------------------------------- |
| 4.3+  | Grievance escalations, reopen, attachments, pushes          |
| 5     | Native mobile parity, offline shell, installable PWA polish |
| 7     | Sahayak AI floating chat (SSE → `apps/api`)                 |
