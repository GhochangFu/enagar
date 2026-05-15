# @enagar/api

NestJS backend for eNagarSeba.

## Stack (per ADR-0002)

- **NestJS 10** on **Node 20** with TypeScript strict mode
- **Pino** structured logging via `nestjs-pino`
- **Helmet** for security headers
- **Swagger** at `/docs` (disabled when `SWAGGER_ENABLED=false`)
- **Terminus** for `/healthz` (liveness) and `/ready` (readiness) probes

## Current surface

| Route                                                                                                                       | Purpose                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /healthz`                                                                                                              | Liveness — heap check                                                                                                                                                                                                                 |
| `GET /ready`                                                                                                                | Readiness — RSS check                                                                                                                                                                                                                 |
| `GET /health`                                                                                                               | Plain smoke-test health marker                                                                                                                                                                                                        |
| `GET /docs`                                                                                                                 | Swagger UI                                                                                                                                                                                                                            |
| `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/refresh`, `POST /api/auth/logout`                   | Citizen auth flow                                                                                                                                                                                                                     |
| `GET /api/tenants`, `GET /api/tenants/:id/config`                                                                           | Public tenant picker/config data                                                                                                                                                                                                      |
| `POST /api/citizen/register`, `GET /api/citizen/profile`, `PATCH /api/citizen/profile`                                      | JWT-protected citizen profile API                                                                                                                                                                                                     |
| `PATCH /api/citizen/language`, `POST /api/citizen/select-tenant`                                                            | JWT-protected citizen preference/tenant APIs                                                                                                                                                                                          |
| `GET /api/citizen/preferences`, `PATCH /api/citizen/preferences`                                                            | Sprint 4.16 — ordered pin list (1–15 municipal ULBs, `GET /tenants` operational set) + favourite service pairs (validated against catalogue); separate from `selected_tenant_code`                                                    |
| `GET /api/citizen/dashboard`                                                                                                | Hub snapshot — per-ULB counts + whole-catalogue `distinct_active_service_codes` (lazy PWA service fetches no longer required for KPI)                                                                                                 |
| `GET /api/citizen/notifications`, `PATCH /api/citizen/notifications/:id/read`, `POST /api/citizen/notifications/push-token` | Phase 4 backlog inbox (**SLA breach** rows) + **Sprint 5.4** push target registration (`citizen_push_devices`)                                                                                                                        |
| `GET /api/public/grievances/aggregate-metrics`                                                                              | Phase 4 backlog — **no JWT** — anonymised grievance KPI counts (`tenant_code` + rolling `window_days` optional)                                                                                                                       |
| `POST /api/auth/aadhaar-link`                                                                                               | Placeholder; real DigiLocker is blocked                                                                                                                                                                                               |
| `POST /api/grievances`, `GET /api/grievances`, `GET /api/grievances/:id`                                                    | Sprint 4.1 grievances + timeline (**detail** adds `attachments[]` when registered — Phase 4 backlog); **Sprints 4.2 / 4.3** optional **`X-Enagar-Tenant-Code`** on citizen routes when JWT is portal (`:id` = UUID or `grievance_no`) |
| `POST /api/grievances/:id/attachments/register`                                                                             | Phase 4 backlog — register MinIO-compatible **`storage_key`** after binary upload (**citizen**; scoped like **`GET …/:id`**)                                                                                                          |
| `POST /api/grievances/:id/reopen`, `POST …/feedback`                                                                        | Citizen **reopen resolved** grievances (**Sprint 4.3**) + **`/feedback`** (portal-safe ownership parity with **`getById`**; optional **`X-Enagar-Tenant-Code`**)                                                                      |
| `PATCH /api/grievances/:id/status`, `POST /api/grievances/staff/sweep-sla`                                                  | Staff lifecycle + SLA sweep (**Sprint 4.3 sweep** bumps `routed_role_code`, clears assignee, adds `sla_escalation`, **Phase 4 backlog** inserts **`sla_breach` notification** rows for citizens)                                      |

## Tenant resolution

Protected handlers derive tenant context from the verified JWT claim through
`JwtAuthGuard`. `TenantContextMiddleware` keeps the `X-Tenant-Code` escape hatch
for local tooling only and rejects that header in production.

**JWT tenant claims (Hub H5.1):** Keycloak SHOULD emit **`tenant_id`** / **`tenant_code`**. `JwtVerifierService` also accepts **`tenantId`** / **`tenantCode`** when snake_case is absent; if both forms appear and disagree, verification fails (**401**). See `src/common/auth/enagar-jwt-tenant-resolver.ts`.

[`tenant.seed.ts`](./src/modules/tenants/tenant.seed.ts) includes **`WBPORTAL`** (citizen portal) for future **Keycloak Option A** JWTs. It is seeded in Postgres but **`GET /api/tenants` omits it** so municipality pickers only show operational ULBs. Use `GET /api/tenants/:id/config` with id or code `WBPORTAL` when tooling needs it.

**Dev auth (non-production):** Successful `/api/auth/verify-otp` with the configured `DEV_OTP_CODE` issues a JWT whose `tenant_id` / `tenant_code` are **WBPORTAL** and whose `sub` is **`dev-citizen-{mobile}`** (stable per phone). `tenant_code` in OTP request bodies is optional and defaults to WBPORTAL. Dev `refresh_token` values have the form `dev-refresh-{mobile}-{uuid}`; legacy `dev-refresh-{uuid-only}` tokens must re-authenticate via OTP.

**Citizen hub read scope:** For **portal** JWTs (`tenant_code === WBPORTAL`), optional header **`X-Enagar-Tenant-Code: {ULB}`** selects one municipality; omit it on the **hub** to aggregate citizen-owned rows across ULBs. **`GET/POST …/applications`** and **`documents`** routes accept this header; **`holdings`** require it for portal users (no cross-ULB holdings search). **`payments`** **`grievances`** read routes, and **`GET /api/citizen/dashboard`** use the same semantics. Municipal citizen JWTs ignore the header and remain scoped to the JWT tenant.

**Citizen hub ops (Hub H6.1):** Header troubleshooting, dashboard aggregation, and **`citizen_hub_dashboard` log shape** — **[`docs/runbooks/citizen-unified-hub.md`](../../docs/runbooks/citizen-unified-hub.md)**. Formal programme exit checklist: **[`docs/runbooks/hub-h6-exit-checklist.md`](../../docs/runbooks/hub-h6-exit-checklist.md)**.

**Keycloak operators (staging/prod, Hub H5.1):** Staff and admin portals use OIDC clients defined in [`infrastructure/keycloak/realm-export.json`](../../infrastructure/keycloak/realm-export.json) (`admin-tenant`, `admin-state`, `staff-mobile`, …). Operator users must carry **`tenant_id`** and **`tenant_code`** attributes mapped into the JWT (`tenant-claims` scope). Grievance staff endpoints accept **`municipality_clerk`**, **`municipality_admin`**, **`tenant_clerk`** (realm alias), **`tenant_admin`**, and **`state_admin`** — see [`grievance-staff-roles.ts`](./src/modules/grievances/grievance-staff-roles.ts) and **`docs/runbooks/keycloak.md`**.

**Payment initiate (Phase 3 Sprint 3.2):** With a **portal** JWT, `POST …/payments/initiate` scopes the pending payment row, gateway context, and **`Idempotency-Key`** uniqueness to the **application’s municipal `tenant_id`** (from the application record), not WBPORTAL. Stub settlement and receipt display numbers use that same ULB.

Admin-role JWTs (`tenant_admin`, `state_admin`) must include MFA evidence
through `amr: ["otp"]` or `acr: "mfa"`.

## Run locally

After Postgres is up and `DATABASE_URL` points at it, apply migrations then seed tenant rows (matches `tenant.seed.ts` UUIDs used by dev JWT and smoke tests):

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed                         # from monorepo root — or: pnpm --filter @enagar/api db:seed
pnpm --filter @enagar/api dev      # http://localhost:3001/health
pnpm --filter @enagar/api build
pnpm --filter @enagar/api test
pnpm test:security
```

`PORT=3001` by default; override via env.

### Database URL / “citizens does not exist”

The API loads **`infrastructure/.env`** automatically in **non‑production** for any variable **not already** in `process.env` (IDE / shell env wins) — see `src/load-infra-env.ts`. On startup you should see **`[api] Postgres target: host=… db=enagarseba`** (password is never logged).

If you still see Prisma errors like **`public.citizens` does not exist**:

1. Run migrations against that same database (from repo root, using the Compose URL):

   ```bash
   $env:DATABASE_URL = "postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public"
   pnpm --filter @enagar/api prisma:migrate:deploy
   ```

2. **Restart** `pnpm --filter @enagar/api dev` after migrations.

3. If the log shows the **wrong** `db=` or host, something in your shell or IDE still sets **`DATABASE_URL`** (IDE env wins over `infrastructure/.env`). Temporarily **`Remove-Item Env:DATABASE_URL`** in PowerShell for that session, or fix/remove the conflicting user-level env var — then restart the API.
