# Unified Portal on demosites.co.in — VM setup (beginner guide)

**Read this on your Azure Windows VM.**  
**When finished:** run the [exit checklist](./unified-portal-option-a-exit.md) and [manual QA script](./unified-portal-manual-qa.md).

---

## Paths on this VM (confirmed)

| What                      | Path                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Repo (already cloned)** | `c:\projects\enagar`                                                                |
| **TLS certs**             | e.g. `c:\projects\enagar\certs\` (create if needed)                                 |
| **Caddy config**          | e.g. `c:\projects\enagar\Caddyfile`                                                 |
| **Portal hub**            | `c:\projects\enagar\infrastructure\portal-hub` (serve from repo — no copy required) |

Set a variable in every PowerShell session:

```powershell
$Repo = 'c:\projects\enagar'
cd $Repo
```

---

## Already on the VM? (typical case)

If **yesterday you already**:

- cloned the repo to `c:\projects\enagar`
- ran `pnpm infra:up`, migrate, seed
- started apps with **`pnpm dev`** / **`pnpm dev:portals`** on localhost `:3000–3003` and API `:3001`

…then you are **not starting from zero**. Unified portal cutover adds **HTTPS in front** of what you already have.

| Step      | Action                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | **Do** — `git pull` + `pnpm install` (gets portal hub, Caddy template, env examples)                                               |
| **2**     | **Merge** — add demo `CORS_ORIGIN`, Keycloak public URLs into existing `infrastructure\.env` (do **not** delete working passwords) |
| **3–4**   | **Skip** — if Docker, DB, and seed already OK                                                                                      |
| **5**     | **Skip or run** — MinIO CORS only if using real object storage                                                                     |
| **6**     | **Do** — Keycloak docker override + realm demo URIs                                                                                |
| **7**     | **Do later** — prod builds (required for staff OAuth via `enagarauth`; optional for first routing smoke)                           |
| **8**     | **Keep running** — leave `pnpm dev:portals` as-is; Caddy proxies to the same ports                                                 |
| **9–10**  | **Do** — point Caddy at hub + install/start Caddy                                                                                  |
| **11–12** | **Do** — firewall + browser smoke from your laptop                                                                                 |

**First HTTPS test:** pull → merge env → Keycloak override → Caddy → open `https://enagar.demosites.co.in` while apps still run in dev mode.

---

## What you are building

Six public websites on one VM, all using HTTPS:

| Address                                 | What it is                         |
| --------------------------------------- | ---------------------------------- |
| `https://enagar.demosites.co.in`        | Portal hub (static landing page)   |
| `https://enagarcitizen.demosites.co.in` | Citizen app → `localhost:3000`     |
| `https://enagartenant.demosites.co.in`  | Tenant Admin → `localhost:3002`    |
| `https://enagarstate.demosites.co.in`   | State Admin → `localhost:3003`     |
| `https://enagarapi.demosites.co.in`     | API → `localhost:3001`             |
| `https://enagarauth.demosites.co.in`    | Keycloak → Docker `localhost:8080` |

**Caddy** listens on **443** and forwards to **localhost**. Your apps keep the same ports — no ingress inside Node.

---

## Before you start

### On the VM you need

| Tool                  | Status on typical VM                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| Git, Node 20, pnpm 9+ | Already installed if dev works                                                    |
| Docker Desktop        | Already running if infra works                                                    |
| **Caddy**             | Install if not yet — [caddyserver.com/download](https://caddyserver.com/download) |

### Outside the VM

- **DNS:** six A records → VM public IP
- **TLS:** wildcard `*.demosites.co.in` `.pem` + `.key` on the VM
- **Azure NSG:** inbound **443** only; block **8080**, **3000–3003** from internet

### Folder layout (this VM)

```
c:\projects\enagar\                 ← repo (existing)
  infrastructure\
    portal-hub\                     ← hub static files (in repo)
    ingress\Caddyfile.demosites     ← template to copy
  certs\                            ← create: demosites.co.in.pem + .key
  Caddyfile                         ← copy from ingress template
  infrastructure\.env               ← existing — merge demo settings
```

---

## Step 1 — Pull the latest code

```powershell
cd c:\projects\enagar
git pull
pnpm install
```

**Fresh VM only** (skip if repo already at `c:\projects\enagar`):

```powershell
git clone <your-repo-url> c:\projects\enagar
cd c:\projects\enagar
pnpm install
```

---

## Step 2 — Environment files

### 2a. Docker + API — **merge** into existing `infrastructure\.env`

**Do not overwrite** a working `.env`. Open it and add or update:

```env
CORS_ORIGIN=https://enagarcitizen.demosites.co.in,https://enagartenant.demosites.co.in,https://enagarstate.demosites.co.in
ALLOW_CLIENT_SCAN_SIMULATION=true
KEYCLOAK_ISSUER_URL=https://enagarauth.demosites.co.in/realms/enagar
KEYCLOAK_TOKEN_ENDPOINT=https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/token
KEYCLOAK_LOGOUT_ENDPOINT=https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/logout
MINIO_API_CORS_ALLOW_ORIGIN=https://enagarcitizen.demosites.co.in,https://enagartenant.demosites.co.in,https://enagarstate.demosites.co.in
```

**External demo (recommended):** avoid browser→MinIO PUT until storage proxy exists:

```env
OBJECT_STORAGE_DISABLED=true
```

Reference template: `infrastructure\.env.production.example`  
Details: [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md)

**Restart the API** after saving `.env`.

**New VM only** — no existing `.env`:

```powershell
Copy-Item infrastructure\.env.production.example infrastructure\.env
notepad infrastructure\.env
```

### 2b. App build env (before `next build` — Step 7)

```powershell
cd c:\projects\enagar
Copy-Item apps\citizen-pwa\.env.production.example apps\citizen-pwa\.env.production.local
Copy-Item apps\admin-tenant\.env.production.example apps\admin-tenant\.env.production.local
Copy-Item apps\admin-state\.env.production.example apps\admin-state\.env.production.local
```

Skip until you move off `pnpm dev` for staff HTTPS login.

---

## Step 3 — Docker (database, Keycloak, MinIO)

**Skip if** `pnpm infra:up` already ran and containers are healthy.

```powershell
cd c:\projects\enagar
pnpm infra:up
```

### Keycloak hostname (required for staff login through HTTPS)

```powershell
Copy-Item infrastructure\docker-compose.unified-portal-demo.override.example.yml infrastructure\docker-compose.override.yml
pnpm infra:demo:keycloak
docker exec enagar-keycloak printenv | findstr KC_HOSTNAME
```

`pnpm infra:up` alone does **not** load `docker-compose.override.yml` on all Docker installs — use `infra:up:demo` / `infra:demo:keycloak` on the VM.

Expected after recreate:

```text
KC_HOSTNAME=https://enagarauth.demosites.co.in
KC_HOSTNAME_STRICT_HTTPS=true
KC_PROXY=edge
```

If `KC_HOSTNAME` is missing, the override file is wrong or not merged — do not continue until it appears.

Details: [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md)

---

## Step 4 — Database setup

**Skip if** migrate + seed already done.

```powershell
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed
pnpm infra:seed-keycloak-users
```

---

## Step 5 — MinIO CORS

**Skip if** `OBJECT_STORAGE_DISABLED=true`.

```powershell
pnpm infra:minio-cors
```

---

## Step 6 — Keycloak realm (staff redirect URIs)

Demo URIs are in `infrastructure/keycloak/realm-export.json`.

**Prefer (keeps DB data):** after Caddy is up, patch `admin-tenant` / `admin-state` clients in Admin Console.

**Fresh import** (wipes Keycloak + Postgres volumes):

```powershell
pnpm infra:reset
pnpm infra:up
pnpm infra:seed-keycloak-users
```

### 6b. Keycloak HTTPS behind Caddy (fix “form is not secure”)

If the browser warns **“The information you’re about to submit is not secure”** and the URL shows **`http://enagarauth.demosites.co.in/...`**, Keycloak is not seeing HTTPS from Caddy.

**On the VM:**

1. **`infrastructure\docker-compose.override.yml`** (create from `docker-compose.unified-portal-demo.override.example.yml`):

```yaml
services:
  keycloak:
    environment:
      KC_HOSTNAME: https://enagarauth.demosites.co.in
      KC_HOSTNAME_STRICT_HTTPS: 'true'
      KC_PROXY: edge
      KC_PROXY_HEADERS: xforwarded
```

Use the full `https://` prefix on `KC_HOSTNAME` — not hostname only.

2. **Caddyfile** — `enagarauth` block must forward proxy headers (see `infrastructure/ingress/Caddyfile.demosites`).

3. Restart (must load override — verify with `printenv`):

```powershell
cd c:\projects\enagar
pnpm infra:demo:keycloak
docker exec enagar-keycloak printenv | findstr KC_
# Stop Caddy (Ctrl+C), then:
caddy run --config c:\projects\enagar\Caddyfile
```

4. Verify issuer is HTTPS (from laptop):

```powershell
curl https://enagarauth.demosites.co.in/realms/enagar/.well-known/openid-configuration
```

Look for `"issuer":"https://enagarauth.demosites.co.in/realms/enagar"` (not `http://`).

5. Retry tenant/state login in a **new private/incognito** window.

---

## Step 7 — Production builds

Required for **tenant/state OAuth** through `https://enagarauth.demosites.co.in`.  
**Optional for first pass** if apps stay on `pnpm dev` and you only test hub + citizen + API routing.

**Use Node 20 LTS** on the VM (`node -v` → `v20.x`). Node 24 often breaks ESLint native modules during `next build`.

```powershell
cd c:\projects\enagar
$env:NODE_OPTIONS = "--max-old-space-size=4096"
pnpm build:portal-demo
```

Then use `pnpm --filter @enagar/... start` instead of `dev` (Step 8b).

### If build fails with `Cannot find native binding` / `unrs-resolver`

This is an **ESLint tooling** issue on the VM, not missing `@enagar/ui`. Dev (`pnpm dev`) can work while prod build fails.

**Fix A — clean reinstall (try first):**

```powershell
cd c:\projects\enagar
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
pnpm install
pnpm build:portal-demo
```

**Fix B — skip Step 7 for now:** keep `pnpm dev:portals`, do Caddy (Steps 9–10), return to builds later.

**Fix C — repo update:** recent `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` (lint still runs in CI). After `git pull`, retry `pnpm build:portal-demo`.

---

## Step 8 — Run the apps

### 8a. Already running (your current setup)

If **`pnpm dev:portals`** (or separate `dev` terminals) is up on `:3000–3003` / `:3001`:

- **Leave it running** — proceed to Step 9 (Caddy).
- Quick check: `curl http://localhost:3001/health`

### 8b. After production builds (Step 7)

```powershell
# Separate windows — or use a process manager
pnpm --filter @enagar/api start
pnpm --filter @enagar/citizen-pwa start
pnpm --filter @enagar/admin-tenant start
pnpm --filter @enagar/admin-state start
```

| App          | localhost |
| ------------ | --------- |
| Citizen      | `:3000`   |
| API          | `:3001`   |
| Tenant Admin | `:3002`   |
| State Admin  | `:3003`   |

---

## Step 9 — Portal hub

Hub files live in the repo. **No copy required** if Caddy points at:

```text
c:\projects\enagar\infrastructure\portal-hub
```

Optional copy elsewhere:

```powershell
Copy-Item -Recurse -Force infrastructure\portal-hub c:\projects\enagar\deploy\portal-hub
```

On `enagar.demosites.co.in`, hub links auto-target the HTTPS subdomains.

Local preview on VM (optional): `pnpm dev:hub` → `http://localhost:5500`

---

## Step 10 — Install and run Caddy

1. Install Caddy for Windows (PATH).
2. Copy and edit config:

```powershell
cd c:\projects\enagar
Copy-Item infrastructure\ingress\Caddyfile.demosites C:\projects\enagar\Caddyfile
notepad c:\projects\enagar\Caddyfile
```

3. Set paths in the Caddyfile:

| Setting  | Example for this VM                                   |
| -------- | ----------------------------------------------------- |
| TLS cert | `c:\projects\enagar\certs\demosites.co.in.pem`        |
| TLS key  | `c:\projects\enagar\certs\demosites.co.in.key`        |
| Hub root | `root * c:\projects\enagar\infrastructure\portal-hub` |

4. Run (apps + Docker must still be up):

```powershell
caddy run --config c:\projects\enagar\Caddyfile
```

Install as a Windows service when ready for always-on demo.

---

## Step 11 — Lock down the firewall

**Azure NSG:** allow **443**; remove public **8080**, **3000–3003**.

Test **from your laptop**:

```powershell
curl -I https://enagarapi.demosites.co.in/health
curl -I http://<vm-public-ip>:3000
```

First should succeed; second should fail or timeout.

---

## Step 12 — Smoke test in the browser

1. `https://enagar.demosites.co.in` — three portal cards
2. **Citizen** → OTP login
3. **Municipal staff** → Keycloak → Desk
4. **State** → Keycloak → grievance library
5. Logout on tenant/state → `/login` on same subdomain

Full script: [unified-portal-manual-qa.md](./unified-portal-manual-qa.md)  
Sign-off: [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md)

---

## Troubleshooting

| Problem                     | What to try                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| **502 Bad Gateway**         | App not on expected port — confirm `pnpm dev:portals` or `start` is running              |
| **Redirect URI mismatch**   | Realm needs `https://enagartenant.demosites.co.in/*` — see Step 6                        |
| **CORS error**              | `CORS_ORIGIN` in `infrastructure\.env`; restart API                                      |
| **Staff login loops**       | Keycloak `KC_HOSTNAME` + `KC_PROXY=edge` in docker override                              |
| **Login form “not secure”** | Keycloak posting to `http://enagarauth...` — see Step 6b below                           |
| **Callback → localhost**    | Caddy must send `Host {host}` to apps — update Caddyfile `proxy_headers`                 |
| **token_exchange_failed**   | VM hosts file for `enagarauth` + tenant/state `.env.local` HTTPS URLs                    |
| **Callback HTTP 500**       | `KEYCLOAK_INTERNAL_ISSUER_URL=http://localhost:8080/realms/enagar` in staff `.env.local` |
| **Certificate error**       | Cert paths in Caddyfile under `c:\projects\enagar\certs\`                                |
| **Citizen upload fails**    | `OBJECT_STORAGE_DISABLED=true` + scan simulation — Phase 5 runbook                       |
| **Works on VM, not laptop** | Expected for `127.0.0.1` MinIO — use stub storage profile                                |
| **Build: native binding**   | ESLint `unrs-resolver` on VM — Step 7; Node 20; or skip build, use `pnpm dev`            |

---

## Related docs

| Doc                                                                        | Purpose                   |
| -------------------------------------------------------------------------- | ------------------------- |
| [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)             | All env variables         |
| [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md)   | Staff OAuth               |
| [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md)           | API + MinIO CORS          |
| [unified-portal-local-dev-phase6.md](./unified-portal-local-dev-phase6.md) | Laptop dev (hub optional) |
| [unified-portal-security-review.md](./unified-portal-security-review.md)   | TLS, cookies, CSP         |
| [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md)       | Full architecture plan    |
