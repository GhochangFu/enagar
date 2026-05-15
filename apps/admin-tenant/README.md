# @enagar/admin-tenant — Tenant Admin Portal

Next.js 14 (App Router) operator UI for a single ULB — **dashboard KPIs** and **Postgres-backed service catalogue** edits.

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

JWT must include **`tenant_admin`**, **`municipality_admin`**, or **`state_admin`** with **`tenant_id` / `tenant_code`** claims (`tenant-claims` scope). **`tenant_admin`** tokens must satisfy MFA evidence expected by **`JwtVerifierService`** (`amr` / `acr`) unless you test with **`municipality_admin`** dummy users — see **`docs/runbooks/keycloak.md`**.

## Relation to citizen catalogue API

Public **`GET /api/services/tenants/:tenantCode`** remains **seed-derived** (`ServicesService`). Sprint **6.1** persists edits in **`services`** (Prisma `TenantService`) for operator workflows; aligning citizen intake with DB-backed catalogue is a later sprint.

## Engineering exit record

Master Sprint **6.1**: **`docs/runbooks/master-sprint-61-exit.md`**.
