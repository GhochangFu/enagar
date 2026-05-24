# Unified Portal Option A — Keycloak Phase 4 runbook

**Companion to:** [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md) § Phase 4  
**Realm artefact:** [`infrastructure/keycloak/realm-export.json`](../../infrastructure/keycloak/realm-export.json)  
**General Keycloak ops:** [keycloak.md](./keycloak.md)

Phase 4 adds **demo/staging** staff portal URIs while **keeping localhost** for daily dev on your laptop.

---

## 1. What changed in `realm-export.json`

| Client         | Redirect URIs                                                       | Web origins            | Post-logout → `/login`  |
| -------------- | ------------------------------------------------------------------- | ---------------------- | ----------------------- |
| `admin-tenant` | `http://localhost:3002/*`, `https://enagartenant.demosites.co.in/*` | same origins (no path) | localhost + demo tenant |
| `admin-state`  | `http://localhost:3003/*`, `https://enagarstate.demosites.co.in/*`  | same origins (no path) | localhost + demo state  |

**Not in scope:** `enagarauth` is the Keycloak **issuer** URL, not a client redirect. Citizens use OTP — no citizen Keycloak redirect URIs in this phase.

**CI contract:** [`tests/security/unified-portal-keycloak.spec.ts`](../../tests/security/unified-portal-keycloak.spec.ts)

---

## 2. App env (build-time on VM)

### Tenant Admin — `apps/admin-tenant/.env.production.local`

```env
NEXT_PUBLIC_KEYCLOAK_ISSUER_URL=https://enagarauth.demosites.co.in/realms/enagar
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=admin-tenant
NEXT_PUBLIC_ADMIN_APP_ORIGIN=https://enagartenant.demosites.co.in
NEXT_PUBLIC_API_BASE_URL=https://enagarapi.demosites.co.in/api
```

### State Admin — `apps/admin-state/.env.production.local`

```env
NEXT_PUBLIC_KEYCLOAK_ISSUER_URL=https://enagarauth.demosites.co.in/realms/enagar
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=admin-state
NEXT_PUBLIC_STATE_APP_ORIGIN=https://enagarstate.demosites.co.in
NEXT_PUBLIC_API_BASE_URL=https://enagarapi.demosites.co.in/api
```

### API + Docker infra — VM `infrastructure/.env`

```env
KEYCLOAK_ISSUER_URL=https://enagarauth.demosites.co.in/realms/enagar
KEYCLOAK_TOKEN_ENDPOINT=https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/token
KEYCLOAK_LOGOUT_ENDPOINT=https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/logout
```

---

## 3. Keycloak container hostname (VM only)

Keycloak must advertise the public issuer through Caddy. Add to **`docker-compose.override.yml`** on the VM (git-ignored):

```yaml
services:
  keycloak:
    environment:
      KC_HOSTNAME: https://enagarauth.demosites.co.in
      KC_PROXY: edge
```

Template: [`infrastructure/docker-compose.keycloak-demo.override.example.yml`](../../infrastructure/docker-compose.keycloak-demo.override.example.yml)

Restart Keycloak after applying: `docker compose up -d keycloak`

---

## 4. Apply realm changes

### Option A — Fresh import (local laptop or VM reset)

```powershell
pnpm infra:reset   # destroys Keycloak DB volume
pnpm infra:up
pnpm infra:seed-keycloak-users
```

### Option B — Non-destructive (existing VM realm DB)

1. Open Keycloak Admin → **Clients** → `admin-tenant` / `admin-state`.
2. **Valid redirect URIs:** add `https://enagartenant.demosites.co.in/*` (or state host).
3. **Web origins:** add `https://enagartenant.demosites.co.in` (exact, no trailing slash).
4. **Valid post logout redirect URIs:** add `https://enagartenant.demosites.co.in/login`.
5. Save each client.

Or patch via `kcadm.sh` using values from `realm-export.json`.

---

## 5. Smoke test (after Caddy + prod builds on VM)

| #   | Flow                                                                | Pass                     |
| --- | ------------------------------------------------------------------- | ------------------------ |
| 1   | `https://enagartenant.demosites.co.in/login` → Keycloak → dashboard | Lands on tenant host     |
| 2   | `https://enagarstate.demosites.co.in/login` → Keycloak → dashboard  | Lands on state host      |
| 3   | Tenant **Sign out** → `/login` on tenant host                       | Session cleared          |
| 4   | State **Sign out** → `/login` on state host                         | Session cleared          |
| 5   | OAuth cancel on tenant/state `/login`                               | Error query on same host |

**Local dev unchanged:** `http://localhost:3002` / `:3003` with `http://localhost:8080` issuer.

---

## 6. Logout routes (apps)

| App          | Route                        | Post-logout target                     |
| ------------ | ---------------------------- | -------------------------------------- |
| Tenant Admin | `GET /api/admin-auth/logout` | `{NEXT_PUBLIC_ADMIN_APP_ORIGIN}/login` |
| State Admin  | `GET /api/admin-auth/logout` | `{NEXT_PUBLIC_STATE_APP_ORIGIN}/login` |

Both clear PKCE cookies; Tenant Admin also clears `sessionStorage` before Keycloak end-session redirect.

---

## 7. Phase 4 exit checklist

- [ ] Realm export updated and CI green (`pnpm test:security` → `unified-portal-keycloak.spec.ts`)
- [ ] VM realm patched or re-imported
- [ ] `KC_HOSTNAME` + `KC_PROXY=edge` on VM Keycloak
- [ ] Admin apps built with demo `NEXT_PUBLIC_*` URLs
- [ ] Tenant + State PKCE login on demo subdomains
- [ ] Logout returns to `/login` on same subdomain

Full portal gate: [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md)
