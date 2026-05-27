# Demo VM — deploy current stage (logout hub + EN-3 onboarding)

**Audience:** Operator updating the **enagar** demo VM.  
**Hub:** `https://enagar.demosites.co.in`  
**Repo on VM (typical):** `c:\projects\enagar`

**Baseline (first-time VM):** [unified-portal-vm-setup-beginner.md](./unified-portal-vm-setup-beginner.md)  
**Env matrix:** [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)

This is the **single** runbook for everything you built after the last `origin/main` push on your dev machine:

| Track                 | What it delivers                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Portal logout** | Tenant/State sign-out → `/logout` → **Home** → `https://enagar.demosites.co.in`                                                                                     |
| **B — EN-3**          | State multi-step onboarding wizard, live citizen tenant catalogue, Keycloak `tenant_admin` on activate, demo MFA bypass for `{ulb}-tenant-admin`, `pnpm verify:en3` |

---

## Demo URLs (reference)

| Role         | URL                                                |
| ------------ | -------------------------------------------------- |
| Portal hub   | `https://enagar.demosites.co.in`                   |
| Citizen PWA  | `https://enagarcitizen.demosites.co.in`            |
| Tenant Admin | `https://enagartenant.demosites.co.in`             |
| State Admin  | `https://enagarstate.demosites.co.in`              |
| API          | `https://enagarapi.demosites.co.in/api`            |
| Keycloak     | `https://enagarauth.demosites.co.in/realms/enagar` |

Local upstream ports (Caddy → loopback): Citizen `:3000`, API `:3001`, Tenant `:3002`, State `:3003`.

---

## Part 0 — Dev machine: commit and push **before** the VM pull

On your laptop (`d:\UDProjects\MunicipalServices`), you need **both** batches on `main` and pushed:

1. **Logout / hub** (already committed locally as `0e50604`, `1c6a16e` — push if not on remote).
2. **EN-3 batch** — must be committed and pushed too. The VM cannot run EN-3 from logout commits alone.

```powershell
cd d:\UDProjects\MunicipalServices
git status
git push origin main
```

### 0.1 — After push, verify EN-3 files exist on `main`

On the VM (or laptop), after `git pull`, these paths **must** exist. If any are missing, stop — commit EN-3 on the dev machine first.

| Path                                                                 | Purpose                                            |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/admin-state/components/tenant-onboarding-wizard.tsx`           | Multi-step State onboarding UI                     |
| `docs/runbooks/state-tenant-onboarding.md`                           | EN-3 operator notes                                |
| `scripts/verify-en3-state-onboarding.mjs`                            | Automated smoke                                    |
| `package.json` → script `"verify:en3"`                               | Runs the smoke script                              |
| `apps/api/src/modules/tenants/tenants.service.ts`                    | `GET /api/tenants` from Postgres (not seed-only)   |
| `apps/api/src/common/keycloak/keycloak-admin-provisioner.service.ts` | Creates `{code}-tenant-admin` on activate          |
| `apps/api/src/common/auth/jwt-verifier.service.ts`                   | `ENAGAR_DEMO_VM_MFA_BYPASS` for demo tenant admins |
| `infrastructure/.env.production.example`                             | Documents `ENAGAR_DEMO_VM_MFA_BYPASS=true`         |

Quick check on VM:

```powershell
cd c:\projects\enagar
Test-Path apps\admin-state\components\tenant-onboarding-wizard.tsx
pnpm verify:en3 --help 2>$null; if (-not $?) { node -e "require('./package.json').scripts['verify:en3']" }
```

---

## Part 1 — Sync code on the VM

```powershell
cd c:\projects\enagar
git fetch origin
git pull origin main
git log -3 --oneline
pnpm install
```

`pnpm install` runs API `prisma generate` via `postinstall`.

**Node:** use **20 LTS** (`node -v` → `v20.x`) for production builds.

---

## Part 2 — Runtime environment (`infrastructure\.env`)

Edit `c:\projects\enagar\infrastructure\.env` (copy from `.env.production.example` if the VM was never merged).

### 2.1 — Required for demo VM (existing)

Keep your VM secrets; ensure these are set (see [unified-portal-env-matrix.md](./unified-portal-env-matrix.md)):

- `DATABASE_URL`, `CORS_ORIGIN` (all three portal HTTPS origins)
- `KEYCLOAK_ISSUER_URL=https://enagarauth.demosites.co.in/realms/enagar`
- `KEYCLOAK_JWKS_URL=http://127.0.0.1:8080/realms/enagar/protocol/openid-connect/certs`
- `DEV_AUTH_ENABLED=false` (public demo — no dev OTP shortcuts)

### 2.2 — EN-3: demo tenant-admin login (no TOTP loop)

Add for **demo VM only** (from EN-3 batch):

```env
# Demo VM: allow password-only JWT for Keycloak users matching {ulb}-tenant-admin (not *-dummy)
ENAGAR_DEMO_VM_MFA_BYPASS=true
```

**Do not** set this on production or shared staging without explicit approval.

### 2.3 — EN-3: Keycloak Admin API (provision tenant admin on activate)

Provisioner uses master-realm admin credentials (usually already on VM):

```env
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<your-vm-secret>
KEYCLOAK_REALM=enagar
```

`KEYCLOAK_ISSUER_URL` or `KEYCLOAK_BASE` must reach Keycloak (loopback `http://127.0.0.1:8080` is fine for Admin API from the API container/host).

### 2.4 — EN-3: optional RAG on activate

If Sahayak indexer runs on the VM:

```env
RAG_INDEXER_URL=http://127.0.0.1:8100
```

After `.env` changes, **restart the API** (and `pnpm rag:dev` if used).

---

## Part 3 — Admin app build env (production builds)

If the VM uses **`pnpm build:portal-demo`** / `next start`:

```powershell
Copy-Item apps\admin-tenant\.env.production.example apps\admin-tenant\.env.production.local -Force
Copy-Item apps\admin-state\.env.production.example apps\admin-state\.env.production.local -Force
```

Confirm both include:

```env
NEXT_PUBLIC_PORTAL_HUB_URL=https://enagar.demosites.co.in
```

Plus demo Keycloak/API origins per the examples.

**If the VM uses `pnpm dev:portals` only:** hub URL is optional on `*.demosites.co.in` (code defaults to `https://enagar.demosites.co.in`). Restart dev after pull.

---

## Part 4 — Keycloak (logout + staff MFA)

### 4.1 — Post-logout URIs (Track A — required)

Realm **enagar** → **Clients**:

**admin-tenant** — **Valid post logout redirect URIs:**

```text
https://enagartenant.demosites.co.in/login
https://enagartenant.demosites.co.in/logout
```

**admin-state:**

```text
https://enagarstate.demosites.co.in/login
https://enagarstate.demosites.co.in/logout
```

Or pull `infrastructure/keycloak/realm-export.json` and run `pnpm infra:demo:keycloak` **only** if you accept realm DB recreation (re-seed users afterward).

### 4.2 — State admin MFA (EN-3 prerequisite)

`DEV_AUTH_ENABLED=false` means **`state_admin` JWTs need MFA** (TOTP enrolled in Keycloak).

Before State onboarding smoke:

1. Sign in to Keycloak Admin → realm **enagar** → **Users**.
2. Open your State operator (e.g. `kmc-state-admin-dummy` or your real `state_admin` user).
3. **Credentials** → configure **OTP** (Google Authenticator / similar).
4. Sign in once at `https://enagarstate.demosites.co.in` and complete MFA at Keycloak.

Tenant **dummy** users (`kmc-tenant-admin-dummy`) still need MFA unless you use a wizard-provisioned `{code}-tenant-admin` with `ENAGAR_DEMO_VM_MFA_BYPASS=true`.

---

## Part 5 — Build and restart processes

### 5.1 — Production path (HTTPS OAuth)

```powershell
cd c:\projects\enagar
$env:NODE_OPTIONS = "--max-old-space-size=4096"
pnpm build:portal-demo
```

Restart (separate windows or your process manager):

```powershell
pnpm --filter @enagar/api start
pnpm --filter @enagar/citizen-pwa start
pnpm --filter @enagar/admin-tenant start
pnpm --filter @enagar/admin-state start
```

### 5.2 — Dev path (common on VM)

Stop existing `pnpm dev:portals`, then:

```powershell
cd c:\projects\enagar
pnpm dev:portals
```

**Must restart** after pull so API + State Admin load EN-3 and logout routes.

### 5.3 — Caddy

No change for this rollout if hub and subdomains already work. Confirm:

```powershell
curl -s -o NUL -w "hub %{http_code}`n" https://enagar.demosites.co.in
curl -s -o NUL -w "api %{http_code}`n" https://enagarapi.demosites.co.in/health
```

---

## Part 6 — EN-3: onboard a pilot ULB (e.g. Bally `BLYM`)

Use a **private/incognito** window.

### 6.1 — State Admin wizard (new or existing ULB)

1. Open `https://enagarstate.demosites.co.in/login` → sign in as **state_admin** (with MFA enrolled).
2. Tab **Tenants**:
   - **New municipality** — blank wizard for a new code.
   - **Re-onboard** — click an existing ULB in the list (e.g. KMC, BPMC); wizard pre-fills categories and `{code}-tenant-admin`.
3. Complete steps (typical flow):

   | Step             | Fill                                                                                                                                     |
   | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
   | **Profile**      | Code `BLYM`, name _Bally Municipality_, district, wards, theme, languages                                                                |
   | **Catalogues**   | Select service + grievance **categories** (many categories ≠ many services — preview shows **published** global services only, often ~6) |
   | **Tenant admin** | Username `blym-tenant-admin`, email, temporary password `DummyDev_2026!ChangeMe` (or your policy)                                        |
   | **Review**       | Confirm adoption preview                                                                                                                 |
   | **Activate**     | Sets status **active**; API provisions Keycloak user + adopts services                                                                   |

4. Success: municipality appears in tenant list; audit log shows `tenant.upsert`.

**If wizard UI is missing** (EN-3 not on branch): use **JSON** tab with payload including:

```json
{
  "code": "BLYM",
  "name": "Bally Municipality",
  "district": "Howrah",
  "ward_count": 20,
  "theme_color": "#0E7490",
  "languages_enabled": ["en", "bn"],
  "status": "active",
  "inherit_default_services": true,
  "config": {
    "default_language": "bn",
    "support_email": "support@bally.example.gov.in",
    "onboarding_source": "state_wizard",
    "wizard_completed": true
  }
}
```

Then create `blym-tenant-admin` manually in Keycloak (realm role `tenant_admin`, attributes `tenant_id` / `tenant_code` for BLYM). Prefer fixing Part 0 and using the wizard provisioner instead.

### 6.2 — Verify Barrackpore (`BPMC`) if already onboarded

Repeat spot-check: citizen picker lists BPMC, `bpmc-tenant-admin` (or your username) reaches Tenant Admin dashboard without login loop.

### 6.3 — Tenant Admin login (pilot)

1. `https://enagartenant.demosites.co.in/login`
2. User `blym-tenant-admin`, password from wizard.
3. **Pass:** dashboard/desk loads (not immediate redirect back to `/login`).
4. **Fail (login loop):** API returns `Admin role requires MFA` → confirm `ENAGAR_DEMO_VM_MFA_BYPASS=true` in `infrastructure\.env` and API restarted.

### 6.4 — Citizen visibility

1. `https://enagarcitizen.demosites.co.in` → sign in (OTP).
2. Municipality picker / workspace must include **BLYM** (and BPMC if active).
3. API check:

```powershell
curl -s https://enagarapi.demosites.co.in/api/tenants | ConvertFrom-Json | Select-Object -ExpandProperty tenants | Select-Object code, name
```

**Pass:** active onboarded ULBs listed; **WBPORTAL** not in picker list.

4. Open a **published** service under BLYM — citizen sees services only when tenant has **published** `service_form_versions` (EN-4 will improve global form copy; today some globals may use stub forms).

### 6.5 — Automated EN-3 smoke

```powershell
cd c:\projects\enagar
$env:API_URL = 'https://enagarapi.demosites.co.in'
$env:KEYCLOAK_TOKEN_URL = 'https://enagarauth.demosites.co.in/realms/enagar/protocol/openid-connect/token'
$env:TENANT_CODE = 'BLYM'
$env:TENANT_ADMIN_USER = 'blym-tenant-admin'
$env:TENANT_ADMIN_PASSWORD = 'DummyDev_2026!ChangeMe'
pnpm verify:en3
```

**Pass:** script exits 0 (tenant in catalogue, services/forms, tenant admin token → `desk/me` OK).

### 6.6 — Optional: RAG index after activate

If indexer is running:

```powershell
curl -X POST http://127.0.0.1:8100/index/tenant-all
```

---

## Part 7 — Track A: logout → portal hub smoke

Incognito window:

| #   | Action                                                        | Expected                                      |
| --- | ------------------------------------------------------------- | --------------------------------------------- |
| 1   | `https://enagartenant.demosites.co.in` → login → **Sign out** | `https://enagartenant.demosites.co.in/logout` |
| 2   | **Home — eNagar portal**                                      | `https://enagar.demosites.co.in`              |
| 3   | Same on `https://enagarstate.demosites.co.in`                 | State `/logout` → hub                         |
| 4   | Hub → Tenant / State                                          | Login still works                             |

---

## Part 8 — Troubleshooting

| Symptom                              | Likely cause                       | Fix                                                |
| ------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| `pnpm verify:en3` not found          | EN-3 not pushed                    | Part 0 — commit/push EN-3 batch                    |
| New ULB not in citizen picker        | `GET /api/tenants` still seed-only | Deploy EN-3 `tenants.service.ts`; restart API      |
| Tenant admin login loop              | MFA required                       | `ENAGAR_DEMO_VM_MFA_BYPASS=true` + API restart     |
| State API 401 after Keycloak login   | State admin MFA not enrolled       | Part 4.2 — enroll TOTP                             |
| Keycloak error on sign out           | Missing `/logout` URI              | Part 4.1                                           |
| Wizard error `adoptedServicePreview` | Old State build                    | Pull latest + restart `admin-state`                |
| New ULB form shows Barrackpore       | Old `EMPTY_TENANT_DRAFT`           | Pull EN-3 UI fix                                   |
| ~15 categories but ~6 services       | Expected                           | Only **published** globals per selected categories |
| Sign-out lands on `/login` only      | Old admin build                    | Rebuild/restart tenant + state apps                |

---

## Part 9 — What you do **not** need

- New DB migration solely for logout/hub (unless EN-3 migrations ship in your batch — run `pnpm db:migrate` if pull includes new `prisma/migrations`).
- Caddy / hub file changes.
- EN-4 backlog markdown (no runtime).

---

## Master checklist

**Dev machine**

- [ ] EN-3 + logout commits on `main`
- [ ] `git push origin main`

**VM**

- [ ] `git pull` + `pnpm install`
- [ ] `infrastructure\.env`: `ENAGAR_DEMO_VM_MFA_BYPASS=true`, Keycloak admin vars, `DEV_AUTH_ENABLED=false`
- [ ] Admin `.env.production.local`: `NEXT_PUBLIC_PORTAL_HUB_URL` (prod builds)
- [ ] Keycloak post-logout: `…/login` and `…/logout` (tenant + state)
- [ ] State admin MFA enrolled
- [ ] Restart API + `admin-state` + `admin-tenant` (or full `dev:portals` / prod stack)
- [ ] `pnpm verify:en3` passes for `BLYM`
- [ ] Citizen picker shows onboarded ULB(s)
- [ ] Logout → `/logout` → hub

---

## Related docs

- [state-tenant-onboarding.md](./state-tenant-onboarding.md) — EN-3 detail (when present on branch)
- [unified-portal-manual-qa.md](./unified-portal-manual-qa.md) — broader QA script
- [keycloak.md](./keycloak.md) — dummy users, MFA, seed script
- [EN-4 backlog](../backlog/EN-4-global-form-templates-onboarding.md) — global form templates follow-up
