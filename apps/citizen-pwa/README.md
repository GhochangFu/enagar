# @enagar/citizen-pwa

Citizen-facing **Progressive Web App** built on **Next.js 14** App Router (per ADR-0003).

## Current surface

- **Onboarding (Phase 1 + 4.1 hub):** splash → language → mobile OTP (**`tenant_code: WBPORTAL`** on OTP requests per Option A) → **Citizen hub** (`GET /citizen/dashboard` + `GET /tenants`, **no** `X-Enagar-Tenant-Code`) → pick a municipality → **workspace** (scoped APIs send `x-enagar-tenant-code` via `authHeaders`).
- **Hub ↔ workspace:** **Back to hub** clears workspace selection and resets branding to defaults; dashboard cards show per‑ULB application / payment / grievance counts and theme badges.
- **Services & applications (Phase 2):** tenant catalogue, `@enagar/forms` apply flow, draft → document scan simulation → submit, **My Applications** with detail + comments (writes include scope header when in workspace).
- **Payments (Phase 3 stub rail):** initiate stub payment, simulate PSP capture, list payments, receipt metadata preview (**receipt GET** scoped in workspace).
- **Grievances (Phase 4 — Sprint 4.2):** **Grievances** tab — profile gate (`/citizen/register` when needed), category + priority + description, optional location notes, list/detail with SLA chips, timeline, comments, and **rating after resolved** (closes to `closed` per API).

Shared: Tailwind preset (`@enagar/config/tailwind/base`), `@enagar/i18n`, `@enagar/tenant-theme`.

### Manual smoke — Sprint 4.1 (hub + scope)

1. Run API (`@enagar/api`) and PWA; set `NEXT_PUBLIC_API_BASE_URL` if needed.
2. Complete OTP login (dev OTP code). Confirm you land on **Your municipalities** (hub), not directly on a single-ULB workspace.
3. In browser devtools **Network**, select a hub request to **`/citizen/dashboard`**: request headers must **not** include `x-enagar-tenant-code`.
4. Open a municipality (e.g. KMC). Confirm subsequent **`/applications`**, **`/payments`**, **`/grievances`**, draft create, etc. **do** include `x-enagar-tenant-code: KMC` (or chosen code).
5. Use **← Back to hub**: theme returns to default; hub cards refresh (or tap **Refresh hub**); opening another ULB shows only that ULB’s scoped lists.
6. (Optional) File in two ULBs and confirm hub cards show distinct non‑zero counts per row.

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
