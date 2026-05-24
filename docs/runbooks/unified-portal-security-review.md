# Unified Portal Option A — security review (Phase 7)

**Scope:** Demo VM on `demosites.co.in` — Option A subdomain architecture  
**Companion:** [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md) (E10, E12)

This is a **checklist for operators**, not a penetration test report.

---

## 1. TLS and HSTS

| Check        | Demo VM expectation                                                                 |
| ------------ | ----------------------------------------------------------------------------------- |
| TLS          | Wildcard cert on all six subdomains via Caddy                                       |
| TLS version  | TLS 1.2+ only (Caddy default)                                                       |
| HTTP → HTTPS | Port 80 redirects to 443 (optional)                                                 |
| HSTS         | Add when state policy requires — example for Caddyfile (commented in repo template) |

**Verify:** browser padlock on hub, citizen, tenant, state, api, auth.

---

## 2. Exposure surface

| Rule                            | Status                                         |
| ------------------------------- | ---------------------------------------------- |
| Public **443** only             | NSG + Windows Firewall                         |
| **8080** (Keycloak) not public  | Reachable only via `enagarauth` through Caddy  |
| **3000–3003** not public        | Caddy reverse proxy only                       |
| **5432, 6379, 9000** not public | Docker internal                                |
| MinIO                           | No public subdomain; internal `127.0.0.1:9000` |

**Verify from outside VM:** `curl http://<vm-ip>:8080` fails; `https://enagarapi.demosites.co.in/health` succeeds.

---

## 3. Cookies and session isolation

| Portal  | Auth                        | Cookie domain                                 |
| ------- | --------------------------- | --------------------------------------------- |
| Citizen | OTP / portal JWT            | `enagarcitizen.demosites.co.in`               |
| Tenant  | Keycloak (via `enagarauth`) | Staff session on tenant origin after callback |
| State   | Keycloak                    | Staff session on state origin after callback  |

**Design intent:** citizen OTP and staff Keycloak do **not** share an origin — reduces cross-role session bleed.

**Verify:** login on citizen does not auto-login tenant admin; logout on tenant clears tenant session only.

---

## 4. CORS

| Layer | Config                                                     |
| ----- | ---------------------------------------------------------- |
| API   | Explicit `CORS_ORIGIN` list — no wildcard (`origin: true`) |
| MinIO | `MINIO_API_CORS_ALLOW_ORIGIN` — portal HTTPS origins only  |

**Verify:** DevTools Console — no CORS errors during citizen apply and tenant Desk.

See [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md).

---

## 5. Content Security Policy

| Component    | Notes                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Nest API     | `helmet()` enabled in `apps/api/src/main.ts`                                      |
| Next.js apps | Default Next headers; review if adding third-party scripts                        |
| Static hub   | No inline secrets; Google Fonts from CDN — note `fonts.googleapis.com` dependency |

**Verify:** no mixed-content warnings (all portal pages HTTPS).

---

## 6. Keycloak

| Check         | Expectation                               |
| ------------- | ----------------------------------------- |
| Hub           | No public link to `enagarauth`            |
| Redirect URIs | Exact subdomain + `/*` per client         |
| Post-logout   | Returns to `{portal}/login`               |
| Dev OTP       | `DEV_AUTH_ENABLED=false` on external demo |

See [unified-portal-keycloak-phase4.md](./unified-portal-keycloak-phase4.md).

---

## 7. Object storage (demo pilot)

External browsers cannot PUT to `127.0.0.1:9000` presigned URLs. Approved demo profile:

```env
OBJECT_STORAGE_DISABLED=true
ALLOW_CLIENT_SCAN_SIMULATION=true
```

Document any exception if enabling real MinIO before a storage proxy exists.

---

## 8. CI regression (repo)

Before VM cutover, on laptop:

```powershell
pnpm test:security
pnpm build:portal-demo
pnpm verify:portal-demo
```

Keycloak realm and env matrix specs must pass.

---

## Sign-off

| Reviewer | Date | E12 TLS | E10 CORS | NSG 443-only | Notes |
| -------- | ---- | ------- | -------- | ------------ | ----- |
|          |      |         |          |              |       |
