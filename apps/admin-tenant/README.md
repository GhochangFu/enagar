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
3. Dashboard calls **`GET /api/admin/tenant/dashboard`** and **`GET/PATCH /api/admin/tenant/services/...`** with `Authorization: Bearer …`.
4. Service **Configure** opens **`/dashboard/services/[serviceId]`** for form schema, workflow, fee, document, and revenue draft/publish/configuration.
5. **Operations** opens **`/dashboard/operations`** for Sprint 6.4 templates, KB, branding, feature flags, staff, and role-stage maps.

JWT must include **`tenant_admin`**, **`municipality_admin`**, or **`state_admin`** with **`tenant_id` / `tenant_code`** claims (`tenant-claims` scope). **`tenant_admin`** tokens must satisfy MFA evidence expected by **`JwtVerifierService`** (`amr` / `acr`) unless you test with **`municipality_admin`** dummy users — see **`docs/runbooks/keycloak.md`**.

## Service designer

- **Form draft/publish** persists to **`service_form_versions`** through `PATCH /api/admin/tenant/services/:serviceId/form-draft`.
- **Workflow draft/publish** persists to **`workflows`**, **`workflow_stages`**, and **`workflow_transitions`** through `PATCH /api/admin/tenant/services/:serviceId/workflow-draft`.
- The right-side preview uses **`@enagar/forms/web`** so admin preview and citizen runtime share the renderer.
- Sprint **6.7** adds a drag/drop form palette, field inspector, and `@xyflow/react` workflow canvas while keeping the same draft/publish API and JSON editors as a source-of-truth fallback.

## Relation to citizen catalogue API

Public **`GET /api/services/tenants/:tenantCode`** now resolves active Postgres `TenantService` rows and latest published `service_form_versions` (Sprint **6.6**). Publishing a form from this designer changes citizen PWA/mobile runtime after refresh without rebuilding clients.

## Engineering exit record

Master Sprint **6.1**: **`docs/runbooks/master-sprint-61-exit.md`**.
Master Sprint **6.2**: **`docs/runbooks/master-sprint-62-exit.md`**.
Master Sprint **6.3**: **`docs/runbooks/master-sprint-63-exit.md`**.
Master Sprint **6.4**: **`docs/runbooks/master-sprint-64-exit.md`**.
Master Sprint **6.7**: **`docs/runbooks/master-sprint-67-exit.md`**.
