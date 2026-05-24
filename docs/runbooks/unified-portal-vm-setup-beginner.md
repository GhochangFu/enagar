# Unified Portal on demosites.co.in — VM setup (beginner guide)

**Read this on your Azure Windows VM.** Do each step in order.  
**Repo work is already done on your laptop** — you pull from GitHub and follow this guide once.

**When finished:** run the [exit checklist](./unified-portal-option-a-exit.md) and [manual QA script](./unified-portal-manual-qa.md).

---

## What you are building

Six public websites on one VM, all using HTTPS:

| Address                                 | What it is                                        |
| --------------------------------------- | ------------------------------------------------- |
| `https://enagar.demosites.co.in`        | Portal hub (static landing page)                  |
| `https://enagarcitizen.demosites.co.in` | Citizen app                                       |
| `https://enagartenant.demosites.co.in`  | Tenant Admin (staff)                              |
| `https://enagarstate.demosites.co.in`   | State Admin (staff)                               |
| `https://enagarapi.demosites.co.in`     | API                                               |
| `https://enagarauth.demosites.co.in`    | Keycloak login (staff only — not linked from hub) |

**Caddy** listens on port **443** and forwards traffic to apps running on **localhost** inside the VM. Visitors never open ports 3000–3003 directly.

---

## Before you start

### On the VM you need

| Tool               | Why                                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| **Git**            | Pull the project                                                          |
| **Node.js 20**     | Run API and web apps                                                      |
| **pnpm 9+**        | `npm install -g pnpm@9`                                                   |
| **Docker Desktop** | Postgres, Keycloak, Redis, MinIO                                          |
| **Caddy**          | HTTPS reverse proxy ([caddyserver.com](https://caddyserver.com/download)) |

### You already need (outside the VM)

- **DNS:** six A records pointing to the VM public IP (see table above).
- **TLS certificate:** wildcard `*.demosites.co.in` files (`.pem` + `.key`) copied to the VM, e.g. `C:\enagar\certs\`.
- **Azure NSG:** inbound **443** allowed; **8080, 3000–3003** not open to the internet.

### Folder layout (suggested)

```
C:\enagar\
  certs\                    ← TLS certificate files
  portal-hub\               ← copy from repo infrastructure/portal-hub
  MunicipalServices\        ← git clone of the repo
  Caddyfile                 ← copy from repo infrastructure/ingress/Caddyfile.demosites
```

---

## Step 1 — Pull the latest code

Open **PowerShell** on the VM:

```powershell
cd C:\enagar
git clone <your-repo-url> MunicipalServices
# Or, if already cloned:
cd C:\enagar\MunicipalServices
git pull
pnpm install
```

---

## Step 2 — Create environment files

Copy the **production example** files and edit passwords.

### 2a. Docker + API (`infrastructure/.env`)

```powershell
cd C:\enagar\MunicipalServices
Copy-Item infrastructure\.env.production.example infrastructure\.env
notepad infrastructure\.env
```

Change every `CHANGE_ME_ON_VM` to strong passwords. Keep:

- `CORS_ORIGIN` — three HTTPS portal origins (already in the example file)
- `ALLOW_CLIENT_SCAN_SIMULATION=true`
- Keycloak URLs pointing at `https://enagarauth.demosites.co.in`
- For **external demo without MinIO browser PUT**, you may set `OBJECT_STORAGE_DISABLED=true` (see [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md))

### 2b. App build env (before `next build`)

```powershell
Copy-Item apps\citizen-pwa\.env.production.example apps\citizen-pwa\.env.production.local
Copy-Item apps\admin-tenant\.env.production.example apps\admin-tenant\.env.production.local
Copy-Item apps\admin-state\.env.production.example apps\admin-state\.env.production.local
```

No edits needed if the example files already list `demosites.co.in` URLs.

---

## Step 3 — Start Docker (database, Keycloak, MinIO)

From repo root:

```powershell
pnpm infra:up
```

Wait until containers are healthy in Docker Desktop.

### Keycloak hostname (required for staff login through HTTPS)

Copy the demo override file:

```powershell
Copy-Item infrastructure\docker-compose.unified-portal-demo.override.example.yml infrastructure\docker-compose.override.yml
```

Then restart Keycloak:

```powershell
docker compose -f infrastructure/docker-compose.yml --env-file infrastructure/.env up -d keycloak
```

Details: [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md)

---

## Step 4 — Database setup

```powershell
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed
pnpm infra:seed-keycloak-users
```

---

## Step 5 — MinIO CORS (if using real object storage)

Skip if `OBJECT_STORAGE_DISABLED=true`.

```powershell
pnpm infra:minio-cors
```

See [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md).

---

## Step 6 — Apply Keycloak realm (staff redirect URIs)

The repo already includes demo URIs in `infrastructure/keycloak/realm-export.json`.

**Fresh import** (destroys Keycloak data):

```powershell
pnpm infra:reset
pnpm infra:up
pnpm infra:seed-keycloak-users
```

**Or** patch clients in Keycloak Admin Console (`https://enagarauth.demosites.co.in` after Caddy is up).

---

## Step 7 — Build the web apps

Production builds embed the public URLs. From repo root:

```powershell
pnpm build:portal-demo
```

Or build individually:

```powershell
pnpm --filter @enagar/citizen-pwa build
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/admin-state build
pnpm --filter @enagar/api build
```

**Interim option:** use `pnpm dev:portals` to test routing before builds — staff OAuth through HTTPS still needs production builds.

---

## Step 8 — Start the apps

Open **separate PowerShell windows** (or use a process manager later):

```powershell
# Window 1 — API
pnpm --filter @enagar/api start

# Window 2 — Citizen
pnpm --filter @enagar/citizen-pwa start

# Window 3 — Tenant Admin
pnpm --filter @enagar/admin-tenant start

# Window 4 — State Admin
pnpm --filter @enagar/admin-state start
```

Quick check on the VM itself:

```powershell
curl http://localhost:3001/health
```

---

## Step 9 — Deploy the portal hub

Copy static files (no build step):

```powershell
Copy-Item -Recurse -Force infrastructure\portal-hub C:\enagar\portal-hub
```

When served through Caddy at `enagar.demosites.co.in`, hub links automatically point to the HTTPS subdomains.

---

## Step 10 — Install and run Caddy

1. Download Caddy for Windows and add it to your PATH.
2. Copy the config:

```powershell
Copy-Item infrastructure\ingress\Caddyfile.demosites C:\enagar\Caddyfile
notepad C:\enagar\Caddyfile
```

3. Fix paths if needed:
   - Certificate paths under `(tls_demo)`
   - Hub folder: `root * C:\enagar\portal-hub`

4. Run Caddy:

```powershell
caddy run --config C:\enagar\Caddyfile
```

For production, install Caddy as a Windows service pointing at the same config.

---

## Step 11 — Lock down the firewall

**Azure NSG:** allow **443** (and optional **80** redirect). Remove public rules for **8080**, **3000–3003**.

**Windows Firewall:** same rules.

Test **from your laptop** (not the VM):

```powershell
curl -I https://enagarapi.demosites.co.in/health
# Should return 200

curl -I http://<vm-public-ip>:3000
# Should fail or timeout
```

---

## Step 12 — Smoke test in the browser

1. Open `https://enagar.demosites.co.in` — three portal cards.
2. Click **Citizen** → OTP login (disable `DEV_AUTH_ENABLED` on demo; use real OTP or re-enable dev OTP only for internal test).
3. Click **Municipal staff** → Keycloak → Tenant Desk.
4. Click **State administration** → Keycloak → grievance library.
5. Logout on tenant and state — should return to `/login` on the same subdomain.

Full script: [unified-portal-manual-qa.md](./unified-portal-manual-qa.md)  
Sign-off: [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md)

---

## Troubleshooting

| Problem                              | What to try                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| **502 Bad Gateway** from Caddy       | App not running on the expected localhost port — restart that app                  |
| **Redirect URI mismatch** (Keycloak) | Realm URIs must include `https://enagartenant.demosites.co.in/*` — re-import realm |
| **CORS error** in browser console    | Check `CORS_ORIGIN` in `infrastructure/.env`; restart API                          |
| **Staff login loops**                | Keycloak needs `KC_HOSTNAME` + `KC_PROXY=edge` in docker override                  |
| **Certificate error**                | Check `.pem`/`.key` paths in Caddyfile                                             |
| **Citizen upload fails**             | Use `OBJECT_STORAGE_DISABLED=true` + scan simulation for demo; see Phase 5 runbook |
| **Only works on VM, not laptop**     | Expected for `127.0.0.1` MinIO URLs — use stub storage profile                     |

---

## Related docs

| Doc                                                                      | Purpose                |
| ------------------------------------------------------------------------ | ---------------------- |
| [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)           | All env variables      |
| [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md) | Staff OAuth            |
| [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md)         | API + MinIO CORS       |
| [unified-portal-security-review.md](./unified-portal-security-review.md) | TLS, cookies, CSP      |
| [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md)     | Full architecture plan |
