# Unified Portal Option A — local dev (Phase 6)

**Companion to:** [start-the-app-step-by-step.md](../help/start-the-app-step-by-step.md)  
**Plan:** [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md) § Phase 6

Daily feature work does **not** require Caddy, subdomains, or production builds. Use **`pnpm dev:portals`** and open apps directly — or optionally start the static **portal hub**. No reverse proxy needed.

---

## 1. Two ways to open portals locally

| Way                  | Command                             | You open                                                            |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| **Direct (default)** | `pnpm dev:portals`                  | Bookmark `:3000`, `:3002/login`, `:3003/login`                      |
| **Hub (optional)**   | `pnpm dev:portals` + `pnpm dev:hub` | [http://localhost:5500](http://localhost:5500) — three portal cards |

Hub links are defined in [`infrastructure/portal-hub/config.js`](../../infrastructure/portal-hub/config.js). No ingress, no TLS, no VM.

---

## 2. Production URLs are build-time only

Demo/staging hostnames (`*.demosites.co.in`) are **not** detected at runtime in the Next.js apps. They are baked in at **`next build`** via `.env.production.local` (see [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)).

Local `pnpm dev` always uses **localhost** defaults unless you override `.env.local`.

---

## 3. Optional — `*.enagar.local` pre-prod smoke

Use this **only** when you want subdomain-shaped URLs on your laptop (e.g. before VM cutover). Skip it for normal feature development.

### 3.1 Hosts file

Add to **`C:\Windows\System32\drivers\etc\hosts`** (Windows) or **`/etc/hosts`** (Mac/Linux):

```
127.0.0.1 enagar.enagar.local
127.0.0.1 enagarcitizen.enagar.local
127.0.0.1 enagartenant.enagar.local
127.0.0.1 enagarstate.enagar.local
```

### 3.2 Start apps (same ports)

```powershell
pnpm dev:portals
pnpm dev:hub
```

Open **http://enagar.enagar.local:5500** — hub cards link to `enagarcitizen.enagar.local:3000`, etc.

### 3.3 API CORS (if browser blocks API calls)

Add to `infrastructure/.env` and restart the API:

```env
CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:3003,http://localhost:8081,http://enagarcitizen.enagar.local:3000,http://enagartenant.enagar.local:3002,http://enagarstate.enagar.local:3003
```

Adjust list to match the origins you actually use.

### 3.4 Local Caddy (optional)

To mirror VM routing (HTTPS + port 443), install Caddy locally and adapt [`infrastructure/ingress/Caddyfile.demosites`](../../infrastructure/ingress/Caddyfile.demosites) with `.enagar.local` hosts. This is **advanced** — not required for Phase 6 exit.

---

## Related

- [unified-portal-env-matrix.md](./unified-portal-env-matrix.md) — prod env templates
- [infrastructure/portal-hub/README.md](../../infrastructure/portal-hub/README.md) — hub files
