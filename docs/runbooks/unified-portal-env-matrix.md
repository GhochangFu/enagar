# Unified Portal Option A — environment matrix (Phase 3)

**Companion to:** [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md) §5  
**Source of truth (hosts):** [`infrastructure/unified-portal/demo-hosts.json`](../../infrastructure/unified-portal/demo-hosts.json)

Production URLs are **build-time** for Next.js apps (`NEXT_PUBLIC_*`). Local dev keeps **localhost** — no runtime hostname detection in app code.

---

## 1. Host map — demo VM (`demosites.co.in`)

| Role             | Public URL                                         | VM upstream         |
| ---------------- | -------------------------------------------------- | ------------------- |
| Portal hub       | `https://enagar.demosites.co.in`                   | Caddy `file_server` |
| Citizen PWA      | `https://enagarcitizen.demosites.co.in`            | `:3000`             |
| Tenant Admin     | `https://enagartenant.demosites.co.in`             | `:3002`             |
| State Admin      | `https://enagarstate.demosites.co.in`              | `:3003`             |
| API              | `https://enagarapi.demosites.co.in/api`            | `:3001`             |
| Keycloak (staff) | `https://enagarauth.demosites.co.in/realms/enagar` | Docker `:8080`      |

**Portal hub links** auto-resolve in [`infrastructure/portal-hub/config.js`](../../infrastructure/portal-hub/config.js) — localhost when previewed locally, demo subdomains on the VM.

---

## 2. Copy-paste files on the VM

| Purpose              | Copy from repo                              | To on VM                                  |
| -------------------- | ------------------------------------------- | ----------------------------------------- |
| Citizen build env    | `apps/citizen-pwa/.env.production.example`  | `apps/citizen-pwa/.env.production.local`  |
| Tenant build env     | `apps/admin-tenant/.env.production.example` | `apps/admin-tenant/.env.production.local` |
| State build env      | `apps/admin-state/.env.production.example`  | `apps/admin-state/.env.production.local`  |
| Docker + API runtime | `infrastructure/.env.production.example`    | `infrastructure/.env`                     |

Then run `next build` in each app folder (or from repo root via pnpm filters). See Phase 4 Keycloak runbook for staff OAuth details.

---

## 3. Local development (unchanged)

| App            | URL                                           |
| -------------- | --------------------------------------------- |
| Hub (optional) | `npx serve infrastructure/portal-hub -p 5500` |
| Citizen        | `http://localhost:3000`                       |
| Tenant         | `http://localhost:3002`                       |
| State          | `http://localhost:3003`                       |
| API            | `http://localhost:3001/api`                   |
| Keycloak       | `http://localhost:8080`                       |

Use `.env.example` / `.env.local` — **not** `.env.production.example`.

---

## 4. CI verification

| Check                         | How                                                                       |
| ----------------------------- | ------------------------------------------------------------------------- |
| Env templates match host JSON | `tests/security/unified-portal-env-matrix.spec.ts`                        |
| Demo builds embed demo URLs   | `pnpm build:portal-demo` + `scripts/verify-unified-portal-demo-build.mjs` |
| Keycloak realm URIs           | `tests/security/unified-portal-keycloak.spec.ts`                          |

CI job **`portal-demo-build`** runs the demo build on every push/PR to `main`.

---

## 5. Related runbooks

- [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md) — realm + staff logout
- [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md) — API + MinIO CORS
- [unified-portal-local-dev-phase6.md](./unified-portal-local-dev-phase6.md) — local dev + optional hub
- [unified-portal-vm-setup-beginner.md](./unified-portal-vm-setup-beginner.md) — **VM cutover (start here on VM)**
- [unified-portal-manual-qa.md](./unified-portal-manual-qa.md) — browser smoke script
- [unified-portal-security-review.md](./unified-portal-security-review.md) — TLS, CORS, exposure
- [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md) — VM sign-off checklist (Phase 7)
- [keycloak.md](./keycloak.md) — general Keycloak operations
