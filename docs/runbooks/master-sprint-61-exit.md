# Master Sprint 6.1 — engineering exit record

**Goal (ROADMAP queue #8):** Tenant Admin Portal **shell**, **dashboard**, **service catalogue list/edit**.

## Deliverables shipped in-repo

| Area      | Artefact                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API       | `AdminTenantModule` — `GET /api/admin/tenant/dashboard`, `GET /api/admin/tenant/services`, `PATCH /api/admin/tenant/services/:serviceId` |
| RBAC      | `tenant_admin`, `state_admin`, `municipality_admin` (`tenant-admin-portal-roles.ts`)                                                     |
| Portal    | `apps/admin-tenant` Next.js 14 app — port **3002**, PKCE login via **`admin-tenant`** Keycloak client                                    |
| KPIs      | Dashboard aggregates from Postgres (`applications`, `grievances`, `citizens`, `payments`) scoped to JWT tenant                           |
| Catalogue | List + toggle **`is_active`** + **`effective_sla_days`** PATCH against Prisma `TenantService` (`services` table)                         |
| Tests     | `admin-tenant.service.spec.ts`, `tenant-admin-portal-roles.spec.ts`, `lib/oauth/pkce.spec.ts`, `tests/security/master-sprint-61.spec.ts` |
| Ops       | API **CORS** default allow-list extended with **`http://localhost:3002`**                                                                |

## Exit criteria (this sprint slice)

1. **`pnpm --filter @enagar/admin-tenant build`** succeeds.
2. **`pnpm --filter @enagar/api test`** includes passing admin-tenant unit specs.
3. **`pnpm test:security`** includes **`master-sprint-61`** fingerprint checks.
4. With infra up + seeded Postgres + Keycloak dummy **`municipality_admin`** (or MFA-complete **`tenant_admin`**), operator can open **`/dashboard`**, see KPIs, list services, PATCH SLA/active flag successfully.

## Explicit non-goals (defer)

- Replacing seed-backed **`GET /services/tenants/:code`** with DB-backed resolution for citizens.
- Form-schema builder, workflow designer, fee engine (later Sprint **6.2+**).

## Manual smoke checklist

1. `pnpm infra:up` · `pnpm db:seed` · optional `pnpm infra:seed-keycloak-users`.
2. `pnpm --filter @enagar/api dev` (3001).
3. `pnpm --filter @enagar/admin-tenant dev` (3002).
4. Browse **`http://localhost:3002/login`** → Continue to Keycloak → complete login → **`/dashboard`** loads KPIs + catalogue table.

_Status: closed — engineering (2026-05-15); CI-equivalent scripts verified in-session._
