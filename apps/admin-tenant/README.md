# @enagar/admin-tenant — Tenant Admin Portal

Next.js 14 (App Router) operator UI for a single ULB — **dashboard KPIs**, **Postgres-backed service catalogue** edits, and Phase 6 form/workflow design.

## Dev server

From repo root (after `pnpm install`):

```bash
pnpm --filter @enagar/admin-tenant dev
```

Opens **http://localhost:3002** (matches Keycloak `admin-tenant` redirect URIs in `infrastructure/keycloak/realm-export.json`).

## Configuration

Copy **`apps/admin-tenant/.env.example`** → **`.env.local`** and adjust if your Keycloak/API ports differ.

## Sign-in flow

1. **Login** → `/api/admin-auth/start` generates PKCE, redirects to Keycloak.
2. **Callback** → `/auth/callback` exchanges `authorization_code`, stores tokens in **`sessionStorage`** under `enagar.admin.oauth`, redirects to **`/dashboard`**.
3. Dashboard calls **`GET /api/admin/tenant/dashboard`**, **`GET /api/admin/tenant/dashboard/deep`**, CSV export endpoints, and **`GET/PATCH /api/admin/tenant/services/...`** with `Authorization: Bearer …`.
4. Service **Configure** opens **`/dashboard/services/[serviceId]`** for form schema, workflow, fee, document, and revenue draft/publish/configuration.
5. **Operations** opens **`/dashboard/operations`** for Sprint 6.4 templates, KB, branding, feature flags, staff, role-stage maps, and Sprint 6.8 maintenance banners / notification previews.

JWT must include **`tenant_id` / `tenant_code`** claims (`tenant-claims` scope).

- **Configuration / reporting** (dashboard, Masters, Operations write, service designer): **`tenant_admin`**, **`municipality_admin`**, or **`state_admin`** only (see `assertTenantPortalStaff`).
- **Operator Desk** (**Sprint 6.13**): also **`tenant_clerk`** / **`municipality_clerk`** — clerks land on **`/dashboard/desk`** with role-gated nav; see **`docs/runbooks/master-sprint-613-exit.md`**.

**`tenant_admin`** tokens must satisfy MFA evidence expected by **`JwtVerifierService`** (`amr` / `acr`) unless you test with **`municipality_admin`** or **clerk** dummy users — see **`docs/runbooks/keycloak.md`**.

## Service designer

- **Form draft/publish** persists to **`service_form_versions`** through `PATCH /api/admin/tenant/services/:serviceId/form-draft`.
- **Workflow draft/publish** persists to **`workflows`**, **`workflow_stages`**, and **`workflow_transitions`** through `PATCH /api/admin/tenant/services/:serviceId/workflow-draft`.
- The right-side preview uses **`@enagar/forms/web`** so admin preview and citizen runtime share the renderer.
- Sprint **6.7** adds a drag/drop form palette, field inspector, and `@xyflow/react` workflow canvas while keeping the same draft/publish API and JSON editors as a source-of-truth fallback.
- Sprint **6.8** adds guided fee/document configuration over the same `/config` API and keeps JSON fallback for edge cases.

## Sprint 6.8 operator polish

- **Maintenance banners** persist in tenant-scoped `tenant_banners` rows and surface in citizen municipal workspaces through `GET /api/tenants/:code/banners`.
- **Notification templates** now have channel/locale form controls and live `{{variable}}` preview; actual SMS/email/WhatsApp/push provider sends remain deferred.

## Sprint 6.9 reporting and bulk ops

- Tenant Dashboard shows 30-day trends, SLA-breached drill-down queues, and top active workload.
- Tenant Admin exports applications, payments, grievances, and SLA summaries as bearer-token CSV downloads.
- Tenant Masters supports address-master CSV dry-run/import over the existing single-row address contract.
- Exit: **`docs/runbooks/master-sprint-69-exit.md`**.

## Sprint 6.10 governance and workflow depth

- Tenant Masters adds guided revenue-head and tariff controls while preserving JSON fallback.
- Tenant catalogue governance covers inherited/global service adopt, fork, and deactivate flows.
- Workflow designer adds guided escalation/SLA side-effect authoring over the existing draft/publish contract.
- Exit: **`docs/runbooks/master-sprint-610-exit.md`**.

## Sprint 6.11 P4 content, reports, and bookings

- Tenant Dashboard/Reports adds PDF downloads over existing CSV/report query contracts.
- Operations adds richer KB authoring, preview, safe media references, and KB index trigger/reconcile controls.
- Operations branding adds tenant-scoped logo/hero asset registration and contrast checks.
- Tenant Admin adds a bounded bookable assets/calendar MVP for services using the `booking` workflow pattern.
- Exit: **`docs/runbooks/master-sprint-611-exit.md`**.

## Sprint 6.12 P5 identity and hardening

- Operations adds guided staff invite/provisioning records over the current upsert-by-subject-ID fallback.
- Staff lifecycle actions have tenant-scoped audit coverage and safe local/dry-run Keycloak provisioning boundaries.
- Tenant Admin staff/invite mutation coverage is included in the Sprint 6.12 audit matrix.
- Exit: **`docs/runbooks/master-sprint-612-exit.md`**.

## Sprint 6.13 Operator Desk

- **Clerks and municipality admins** both sign in here (**`:3002`**); no separate clerk PWA.
- New **`/dashboard/desk`**: application inbox (workflow approve/reject/forward) + grievance inbox (status, assign, comment).
- Desk APIs: **`/admin/tenant/desk/*`**; existing configure APIs stay admin-only.
- Exit: **`docs/runbooks/master-sprint-613-exit.md`** — closed (2026-05-18).

## Sprint 6.17 — Tenant Admin shell, dashboard & Desk (Phase UX)

- **Closed** (2026-05-19) — shared **Warm Coral B+ Pro** operator shell (sidebar, role-aware nav), login polish, dashboard KPI/deep-link tiles, Desk inbox/detail styling, `@enagar/ui` buttons.
- Exit: **`docs/runbooks/master-sprint-617-exit.md`** · plan: **`docs/runbooks/master-sprint-617-plan.md`**

## Sprint 6.18 — Masters, Operations & designer chrome (Phase UX)

- **Closed** (2026-05-19) — guided Masters/Operations (list edit, JSON fallback panels), service designer toolbar/publish bar, Desk detail field summary, catalogue B+ Pro cards, `AdminOnlyPanel` for clerks; shared `useTenantAdminSession`; **no API changes**.
- Plan: **`docs/runbooks/master-sprint-618-plan.md`** · exit: **`docs/runbooks/master-sprint-618-exit.md`**
- **Next:** Sprint **6.19** (State Admin + mobile) — [`phase-ux-revamp-plan.md`](../../docs/runbooks/phase-ux-revamp-plan.md) §6.19.
- **Phase UX (6.14–6.19)** — gates Phase 7 after **6.19** sign-off.

## Relation to citizen catalogue API

Public **`GET /api/services/tenants/:tenantCode`** now resolves active Postgres `TenantService` rows and latest published `service_form_versions` (Sprint **6.6**). Publishing a form from this designer changes citizen PWA/mobile runtime after refresh without rebuilding clients.

## Engineering exit record

Master Sprint **6.1**: **`docs/runbooks/master-sprint-61-exit.md`**.
Master Sprint **6.2**: **`docs/runbooks/master-sprint-62-exit.md`**.
Master Sprint **6.3**: **`docs/runbooks/master-sprint-63-exit.md`**.
Master Sprint **6.4**: **`docs/runbooks/master-sprint-64-exit.md`**.
Master Sprint **6.7**: **`docs/runbooks/master-sprint-67-exit.md`**.
Master Sprint **6.8**: **`docs/runbooks/master-sprint-68-exit.md`**.
Master Sprint **6.9**: **`docs/runbooks/master-sprint-69-exit.md`**.
Master Sprint **6.10**: **`docs/runbooks/master-sprint-610-exit.md`**.
Master Sprint **6.11**: **`docs/runbooks/master-sprint-611-exit.md`**.
Master Sprint **6.12**: **`docs/runbooks/master-sprint-612-exit.md`**.
