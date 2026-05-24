# Keycloak operations runbook (realm `enagar`)

**Audience:** DevOps, security, backend engineers. **Scope:** staging/production behaviours; local Docker Keycloak follows the same realm **import** shape.

## 1. Artefacts in this repo

| Path                                                                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`infrastructure/keycloak/realm-export.json`](../../infrastructure/keycloak/realm-export.json)     | Partial realm JSON — clients (including **`admin-tenant` password grant enabled for dev smoke only**), realm roles, and **`tenant-claims`** scope with mappers (`audience-enagar-api`, `tenant_*`, `role`, **`sub-username`** maps username → access-token `sub`). It intentionally avoids top-level `userProfileEnabled` / `userProfile` because the local **Keycloak 25** import rejects those fields; configure unmanaged-attribute policy manually in hardened environments if required. Extend when roles/clients change; import via Docker `start-dev --import-realm` or Admin UI / `kcadm.sh`. |
| [`apps/api/src/modules/tenants/tenant.seed.ts`](../../apps/api/src/modules/tenants/tenant.seed.ts) | Canonical **ULB UUIDs** (`tenant_id`) and **`tenant_code`** (e.g. `KMC`, `BMC`) for user attributes and JWT claims.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 2. API runtime (NestJS) environment

Align with [`JwtVerifierService`](../../apps/api/src/common/auth/jwt-verifier.service.ts):

| Variable                | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `KEYCLOAK_ISSUER_URL`   | Issuer URL (must match token `iss`), e.g. `https://keycloak.example.com/realms/enagar`              |
| `KEYCLOAK_API_AUDIENCE` | Expected `aud` for resource access tokens (default in code: `enagar-api`)                           |
| `DEV_JWT_SECRET`        | **Non-production only:** HS256 “dev” JWTs when JWKS verify fails (never enable in prod as a bypass) |
| `DEV_AUTH_ENABLED`      | Set to `false` to disable dev HS256 fallback                                                        |

**Tenant claims:** Mappers SHOULD emit **`tenant_id`** and **`tenant_code`** (ADR-0009). **`JwtVerifierService`** also honours **`tenantId`** / **`tenantCode`** when the snake_case claims are absent. If snake and camel are **both present** but **different**, access is denied (**401**).

Citizen **dev OTP** (`/api/auth/verify-otp`) is separate from Keycloak and is disabled or unused when real IdP backs login.

## 3. Realm roles vs API — grievance staff (Hub H5.1)

**Grievance** staff routes accept any JWT whose `role` claim includes one of:

| Keycloak realm role (typical) | Notes                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `municipality_clerk`          | Preferred label; matches routing/seed **business** role codes  |
| `municipality_admin`          | ULB-level admin for queues / escalation                        |
| `tenant_clerk`                | Legacy export name — **accepted by the API** as alias of clerk |
| `tenant_admin`                | Municipal administrator                                        |
| `state_admin`                 | State operator                                                 |

Implementation: `GRIEVANCE_STAFF_ROLES` in `apps/api/src/modules/grievances/grievance-staff-roles.ts`.

**Admin roles** require MFA evidence in the JWT (`amr` includes `otp` or `acr === 'mfa'`) per verifier rules.

## 4. Operator user attributes (per user)

Set on each **non-citizen** user in Keycloak (User → Attributes):

| Attribute     | Example                                                | Required for                      |
| ------------- | ------------------------------------------------------ | --------------------------------- |
| `tenant_id`   | `11111111-1111-4111-8111-111111111111` (KMC from seed) | All municipal staff/admin tokens  |
| `tenant_code` | `KMC`                                                  | Logging / human-readable context  |
| `ward_id`     | ward UUID if ward-scoped                               | Officers / field staff (optional) |

**State admin** users may use a dedicated tenant or platform convention — align with your deployment policy before go-live.

Mappers for these attributes are in the **`tenant-claims`** client scope (see realm export).

## 5. OIDC clients (summary)

| Client ID      | Use                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `citizen-pwa`  | Citizen PWA — PKCE, direct grant for OTP-style flows as configured                                                                                                                                                                                                                                                                                                          |
| `citizen-rn`   | React Native                                                                                                                                                                                                                                                                                                                                                                |
| `admin-tenant` | Tenant Admin portal — dev `http://localhost:3002/*`; demo **`https://enagartenant.demosites.co.in/*`** ([Phase 4 runbook](./unified-portal-keycloak-phase4.md)). **Direct access grants** are **on** in this repo’s export so local **password-grant** smoke scripts work; **turn off** for hardened / production-style portals and use **Authorization Code + PKCE** only. |
| `admin-state`  | State Admin portal — dev `http://localhost:3003/*`; demo **`https://enagarstate.demosites.co.in/*`** ([Phase 4 runbook](./unified-portal-keycloak-phase4.md)).                                                                                                                                                                                                              |
| `staff-mobile` | Staff mobile app                                                                                                                                                                                                                                                                                                                                                            |
| `enagar-api`   | Bearer-only resource server reference                                                                                                                                                                                                                                                                                                                                       |

## 6. Bootstrap checklist (staging / pilot)

1. Import or merge [`realm-export.json`](../../infrastructure/keycloak/realm-export.json) (or equivalent Terraform).
2. Create **≥1** user per pilot ULB with **`tenant_id` / `tenant_code`** from `tenant.seed.ts` — **until then**, [`§7`](#7-dummy-users-local--staging-qa) dummy ULB operators (clerk/admin patterns) suffice for QA / API smoke (**Hub H5.1 engineering validation**).
3. Assign realm roles: e.g. **`tenant_clerk`** or **`municipality_clerk`**, **`tenant_admin`** as needed.
4. Enrol **TOTP** for `tenant_admin` / `state_admin` (realm role attributes mark `otp_required` where used).
5. Confirm **Authorization Code + PKCE** from `admin-tenant` / `staff-mobile` yields an access token whose payload includes `sub` (via **`sub-username`** mapper = Keycloak username), `tenant_id`, `tenant_code`, `role` (multivalued), `exp`, `iss`, `aud` (resource audience **`enagar-api`** from **`audience-enagar-api`** mapper). If `aud` still mismatches your verifier, set `KEYCLOAK_API_AUDIENCE=enagar-api,account` in API env (see `infrastructure/.env.example`).
6. Call API: `PATCH /api/grievances/{id}/status` or `POST /api/grievances/staff/sweep-sla` with **Bearer** token — expect **200** when tenant matches grievance row.

**Naming:** Do not commit passwords, client secrets, or recovery codes. Store bootstrap accounts in a sealed break-glass inventory (redacted in docs).

## 7. Dummy users (local / staging QA)

Script: [`infrastructure/scripts/seed-keycloak-dummy-users.mjs`](../../infrastructure/scripts/seed-keycloak-dummy-users.mjs) (idempotent).

```bash
pnpm infra:up   # Keycloak + realm import
pnpm infra:seed-keycloak-users
```

**Env (from `infrastructure/.env` or override):**

| Variable                                     | Purpose                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `KEYCLOAK_ISSUER_URL` or `KEYCLOAK_BASE`     | Keycloak base `http://localhost:8080` (script strips `/realms/...` if issuer URL is supplied) |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Master-realm admin (`admin-cli` password grant)                                               |
| `KEYCLOAK_REALM`                             | Default `enagar`                                                                              |
| `KEYCLOAK_DUMMY_USER_PASSWORD`               | Optional; default `DummyDev_2026!ChangeMe`                                                    |

**Created users (41 total):**

- **1 × portal:** `portal-citizen-dummy` — realm role `citizen`, attributes `tenant_id`/`tenant_code` = **WBPORTAL** (matches `tenant.seed.ts`).
- **8 ULBs × 5 operator roles** (KMC, HMC, CMC, BMC, SMC, AMC, DMC, SDDM): one user per combination, **single** realm role each, attributes set to that ULB’s id/code from `tenant.seed.ts`.

| Username pattern                 | Roles (one per user) |
| -------------------------------- | -------------------- |
| `{ulb}-tenant-clerk-dummy`       | `tenant_clerk`       |
| `{ulb}-municipality-clerk-dummy` | `municipality_clerk` |
| `{ulb}-municipality-admin-dummy` | `municipality_admin` |
| `{ulb}-tenant-admin-dummy`       | `tenant_admin`       |
| `{ulb}-state-admin-dummy`        | `state_admin`        |

**MFA:** `tenant_admin` and `state_admin` dummy users need **TOTP** before the Nest API will accept their JWTs for admin-role checks. Clerk-level dummies work for grievance staff endpoints without MFA.

**Security:** Rotate or delete dummy users before any shared/staging URL is exposed; passwords are **dev-only**.

**Legacy realms:** Older experiments sometimes used **`tenant:{mobile}`** as the Keycloak username. This repo relies on **`sub-username`** (username → `sub`) plus portal **`tenant_*`** mapper claims instead; migrate away from `tenant:{mobile}` if it still appears in ageing environments.

### 7.1 Applying `realm-export.json` changes locally

Compose mounts the file read-only (`infrastructure/docker-compose.yml`). Keycloak merges on **first import** into an empty realm DB; an **already-populated** `keycloak-db` volume keeps older clients/profile/mappers until you reset or patch manually.

- **Destructive refresh (drops Keycloak Postgres volume):** from repo root, `pnpm infra:reset` then `pnpm infra:up`, then **`pnpm infra:seed-keycloak-users`** again (dummy users live only in Keycloak, not in the realm JSON).
- **Non-destructive:** edit clients/scopes/profile in Admin Console to match [`realm-export.json`](../../infrastructure/keycloak/realm-export.json), or use `kcadm.sh` partial updates.

**User profile:** local Keycloak 25 rejects top-level `userProfileEnabled` / `userProfile` during `--import-realm`, so this repo does not declare that block in `realm-export.json`. The dummy-user seed script patches the local declarative user profile with `tenant_id`, `tenant_code`, and `ward_id` before it upserts users. If your hardened Keycloak requires a different unmanaged-attribute policy, set it under **Realm settings → User profile**, then re-run **`pnpm infra:seed-keycloak-users`**.

### 7.2 Local API smoke — grievances (`admin-tenant` + `citizen-pwa`)

Assumptions: `pnpm infra:up`; API on `http://localhost:3001` (see `apps/api` `PORT`); Postgres migrated + **`pnpm db:seed`**; `infrastructure/.env` Keycloak vars; dummy users seeded.

**API env (minimal):**

- `KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/enagar`
- `KEYCLOAK_API_AUDIENCE=enagar-api` — or `enagar-api,account` if tokens still omit the resource audience

**Issuer:** `GET /.well-known/openid-configuration` on the realm → `issuer` must match `KEYCLOAK_ISSUER_URL`.

**Staff token (password grant):** `grant_type=password`, `client_id=admin-tenant`, username e.g. `bmc-tenant-clerk-dummy`, password from `KEYCLOAK_DUMMY_USER_PASSWORD` or default `DummyDev_2026!ChangeMe`. Expect `access_token` non-empty. **401 from Nest** with a fresh token usually means missing `sub` / `aud` / `tenant_id` on the access token — this repo’s export adds **`sub-username`**, **`audience-enagar-api`**, and profile policy for operator `tenant_*` attributes.

**Citizen token:** same against `client_id=citizen-pwa`, user `portal-citizen-dummy`.

**Before `POST /api/grievances`:** `POST /api/citizen/register` with a valid Indian mobile (`^[6-9]\d{9}$`) and Bearer citizen token — required so filing is not rejected as unregistered.

**Portal filing header:** send **`X-Enagar-Tenant-Code`** with the target ULB code (e.g. `BMC`) when the JWT is the WBPORTAL citizen.

**Staff status transition:** not `submitted → resolved` in one step. Examples: `submitted → under_review → resolved` or `submitted → in_progress → resolved` (see [`grievance-lifecycle.ts`](../../apps/api/src/modules/grievances/grievance-lifecycle.ts)).

**Health:** `GET http://localhost:3001/health` — path is **not** under `/api`.

**Note:** `GET /api/tenants` is **public** in dev — **not** a substitute for verifying Bearer auth.

## 8. Rotation and drift

- Rotate Keycloak client secrets on a regular cycle if using confidential clients.
- Re-export realm periodically and **diff** against `infrastructure/keycloak/realm-export.json` (ADR-0009 speaks to CI drift checks).
- After realm changes, rerun security tests: `pnpm test:security` (includes [`keycloak-realm.spec.ts`](../../tests/security/keycloak-realm.spec.ts), [`keycloak-h51-role-parity.spec.ts`](../../tests/security/keycloak-h51-role-parity.spec.ts)).
- Citizen **hub** ops (headers, dashboard): [`citizen-unified-hub.md`](./citizen-unified-hub.md) (Hub **H6.1**).

## 9. References

- [ADR-0009 — Identity Keycloak](../ADRs/ADR-0009-identity-keycloak.md)
- `apps/api/README.md` — dev OTP vs production Keycloak
- Hub **H5.1** delivery note in `ROADMAP.md`
