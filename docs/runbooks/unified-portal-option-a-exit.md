# Unified portal Option A — exit checklist

**Companion to:** [unified-portal-option-a-plan.md](./unified-portal-option-a-plan.md)  
**Use when:** Demo VM sign-off on `demosites.co.in` (and later production cutover).

**First time on the VM?** Follow [unified-portal-vm-setup-beginner.md](./unified-portal-vm-setup-beginner.md) step by step, then run [unified-portal-manual-qa.md](./unified-portal-manual-qa.md) and check boxes below.

**Demo hosts:** `enagar`, `enagarcitizen`, `enagartenant`, `enagarstate`, `enagarapi`, `enagarauth` `.demosites.co.in`

Mark each item on the **VM** before sharing the demo externally.

---

## Pre-flight (laptop — before VM cutover)

- [ ] `pnpm test:security` — unified portal specs pass
- [ ] `pnpm build:portal-demo && pnpm verify:portal-demo` — demo URLs embedded in builds
- [ ] Changes pushed to GitHub; VM can `git pull`

---

## Demo VM sign-off (`demosites.co.in`)

### Portal hub

- [ ] E1 — `https://enagar.demosites.co.in` loads; three portal cards visible
- [ ] Hub links: Citizen, Tenant `/login`, State `/login` — correct hosts
- [ ] **No** public link to `enagarauth` from hub
- [ ] Mobile layout (320px) usable
- [ ] E14 — Maintenance banner tested once (`maintenance.json`)

### Citizen (`enagarcitizen.demosites.co.in`)

- [ ] E3 — OTP login, pin ULB, hub/workspace navigation
- [ ] E5 — Apply service (e.g. birth-cert); docket in UI
- [ ] E11 — File upload + submit; DB row `submitted` (scan simulation on; see [unified-portal-cors-phase5.md](./unified-portal-cors-phase5.md) pilot profile)
- [ ] E7 — Hard refresh on workspace routes — no 404
- [ ] E8 — `/_next/static/*` loads
- [ ] E10 — No CORS errors in console

### Tenant Admin (`enagartenant.demosites.co.in`)

- [ ] E4 — Keycloak login → Desk or dashboard
- [ ] Open one application from Desk
- [ ] E6 — Logout → `/login` on tenant host
- [ ] E13 — Cancel OAuth → `/login?error=...` on tenant host
- [ ] E7 / E8 — Refresh deep routes; static assets OK

### State Admin (`enagarstate.demosites.co.in`)

- [ ] E5 — Keycloak login; grievance library loads
- [ ] E6 — Logout → `/login` on state host
- [ ] E13 — OAuth error path on state host
- [ ] E7 / E8 — Refresh deep routes; static assets OK

### API & infra (`enagarapi`, `enagarauth`)

- [ ] E9 — `GET https://enagarapi.demosites.co.in/health` → 200
- [ ] E10 — CORS from citizen + tenant + state origins
- [ ] E11 — MinIO upload from citizen apply (internal MinIO; CORS on citizen origin)
- [ ] Scan policy: **`ALLOW_CLIENT_SCAN_SIMULATION=true`** on demo VM
- [ ] E12 — TLS valid (wildcard cert)
- [ ] Keycloak issuer URL matches admin `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL`
- [ ] Direct port access blocked from internet (3000–3003, 8080)

### Operations

- [ ] NSG: inbound **443** only verified
- [ ] Caddy service running; hub path correct
- [ ] [Security review](./unified-portal-security-review.md) checklist completed
- [ ] Rollback: stop Caddy or revert DNS documented

---

## Staging sign-off (generic — future production domain)

### Portal hub

- [ ] E1 — `https://www.<domain>` loads; three portal cards visible
- [ ] E2 — Apex `https://<domain>` 301 → www (if applicable)
- [ ] Hub links: Citizen, Tenant `/login`, State `/login` — correct hosts
- [ ] Mobile layout (320px) usable
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95

### Citizen (`citizen.<domain>`)

- [ ] E3 — OTP login, pin ULB, hub/workspace navigation
- [ ] E5 — Apply service (e.g. birth-cert); docket in UI
- [ ] E11 — File upload + submit; DB row `submitted`
- [ ] E7 — Hard refresh on workspace routes — no 404
- [ ] E8 — `/_next/static/*` loads
- [ ] E10 — No CORS errors in console
- [ ] PWA install/smoke from citizen host (if required for pilot)

### Tenant Admin (`tenant.<domain>`)

- [ ] E4 — Keycloak login → Desk or dashboard
- [ ] Open one application from Desk
- [ ] E6 — Logout → `/login` on tenant host
- [ ] E13 — Cancel OAuth → `/login?error=...` on tenant host
- [ ] E7 / E8 — Refresh deep routes; static assets OK

### State Admin (`state.<domain>`)

- [ ] E5 — Keycloak login; grievance library loads
- [ ] E6 — Logout → `/login` on state host
- [ ] E13 — OAuth error path on state host
- [ ] E7 / E8 — Refresh deep routes; static assets OK

### API & infra (`api.<domain>`, `auth.<domain>`)

- [ ] E9 — `GET https://api.<domain>/health` → 200
- [ ] E10 — CORS from all three portal origins
- [ ] E11 — MinIO upload from citizen apply (no CORS on storage PUT)
- [ ] Scan policy: simulation off + worker running (or documented pilot exception)
- [ ] E12 — TLS valid; HSTS per state policy
- [ ] Keycloak issuer URL matches `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL` in admin builds

### Operations

- [ ] E14 — Maintenance banner on hub tested once
- [ ] Runbook: cert renewal owner documented
- [ ] Runbook: DNS change procedure documented
- [ ] CI: no `localhost` in production build artifacts

---

## Production cutover (after staging)

- [ ] DNS A/CNAME records live for all subdomains
- [ ] TLS certificates installed for all SANs
- [ ] Re-run all staging checks on production URLs
- [ ] Keycloak production redirect URIs active
- [ ] Rollback DNS targets documented and reachable

---

## Sign-off

| Role           | Name | Date |
| -------------- | ---- | ---- |
| Product        |      |      |
| Engineering    |      |      |
| Ops / State IT |      |      |
