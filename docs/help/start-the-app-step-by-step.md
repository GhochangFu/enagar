# Start the application — simple step-by-step

This guide is for **local development** only. Follow the steps in order.

---

## Step 1 — Install tools (one time)

Install these on your computer:

| Tool               | Why you need it                                  |
| ------------------ | ------------------------------------------------ |
| **Git**            | To get the project code                          |
| **Node.js 20**     | Runs the API and web apps                        |
| **pnpm 9+**        | Installs JavaScript packages (`npm i -g pnpm@9`) |
| **Docker Desktop** | Starts Postgres, Keycloak, Redis, etc.           |

---

## Step 2 — Get the code and go to the project folder

```bash
git clone <your-repo-url>
cd MunicipalServices
```

(Use the real folder name if yours is different, e.g. `enagarseba`.)

---

## Step 3 — Install project packages

From the **root** of the project (where `package.json` is):

```bash
pnpm install
```

Wait until it finishes with no errors.

---

## Step 4 — Create the infrastructure config file

1. Go to the **`infrastructure`** folder.
2. Copy **`.env.example`** to **`.env`** (same folder).

**Windows (PowerShell), from the repo root:**

```powershell
Copy-Item infrastructure\.env.example infrastructure\.env
```

**Mac / Linux:**

```bash
cp infrastructure/.env.example infrastructure/.env
```

For a first run you can **leave the defaults** in `infrastructure/.env`. You only need to edit things like API keys if you use features that need them (for example the AI chatbot).

---

## Step 5 — Start Postgres, Keycloak, and the rest (Docker)

From the **repo root**:

```bash
pnpm infra:up
```

The first time can take several minutes while images download.

### Check that containers are running

- Docker Desktop should show the **eNagarSeba** compose stack as **running**.
- Or run: `docker compose -f infrastructure/docker-compose.yml ps` (with the same `--env-file infrastructure/.env` if your team uses that).

---

## Step 6 — Create database tables and seed basic data

Still from the **repo root**:

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm db:seed
```

- **`prisma:migrate:deploy`** applies SQL migrations (creates tables like `citizens`, `tenants`, etc.).
- **`db:seed`** fills minimum data the app expects: tenants, service catalogue rows, and published citizen form versions used by PWA/mobile apply flows.

If this step fails, fix **Postgres** / **`DATABASE_URL`** first (see troubleshooting below).

---

## Step 7 — (Optional) Seed dummy Keycloak users

Only if you want pre-made test users in Keycloak:

```bash
pnpm infra:seed-keycloak-users
```

You can skip this for a minimal flow; dev OTP login works without it when `DEV_AUTH_ENABLED` is on in `infrastructure/.env`.

---

## Step 8 — Start the backend (API)

Open a terminal in the **repo root** and run:

```bash
pnpm --filter @enagar/api dev
```

Leave this terminal open.

- API default URL: **`http://localhost:3001`**
- Quick check in the browser: **`http://localhost:3001/health`**

On startup you should see a log line like **`Postgres target: host=… db=enagarseba`** (no password printed). That database name should match **`POSTGRES_DB`** in `infrastructure/.env`.

---

## Step 9 — Start the citizen website (PWA)

Open a **second** terminal in the **repo root** and run:

```bash
pnpm --filter @enagar/citizen-pwa dev
```

Leave this terminal open.

- Citizen PWA: **`http://localhost:3000`**
- Screenshot walkthrough deck: [`docs/presentations/citizen-pwa/`](../presentations/citizen-pwa/README.md) (`npx serve docs/presentations/citizen-pwa -p 8787`)

By default the PWA talks to **`http://localhost:3001/api`**. Change that only if you run the API on another host/port (`NEXT_PUBLIC_API_BASE_URL` — see [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md)).

**Tailwind:** the PWA config scans **`packages/ui`** and **`@enagar/forms/web`** paths so citizen form widgets keep styles in **`next build`**. Avoid trimming those **`content`** entries when adding primitives.

---

## Step 9b — (Optional) Tenant Admin portal

Only if you seeded Keycloak dummy operators (**Step 7**) and want the ULB admin UI:

```bash
pnpm --filter @enagar/admin-tenant dev
```

- Tenant Admin: **`http://localhost:3002`**
- Env template: **`apps/admin-tenant/.env.example`** → **`.env.local`**
- Exit checklists/plans: **`docs/runbooks/master-sprint-61-exit.md`** … **`docs/runbooks/master-sprint-612-exit.md`**, **`docs/runbooks/master-sprint-613-exit.md`** (Operator Desk — closed **2026-05-18**)

Sign-in uses Keycloak (**not** dev OTP). Prefer a dummy **`municipality_admin`** user for smoke tests if **`tenant_admin`** MFA is not enrolled yet — see **`docs/runbooks/keycloak.md`**.

**Sprint 6.13 (closed):** clerks (`kmc-tenant-clerk-dummy`, `kmc-municipality-clerk-dummy`) sign in to the **same** Tenant Admin URL and use **Desk** (`/dashboard/desk`) for application and grievance processing. Municipality admins use Desk plus Dashboard/Masters/Operations. Manual smoke checklist: **`docs/runbooks/master-sprint-613-exit.md`** § Manual smoke.

**Phase UX (next — 6.14–6.19):** cross-portal UI revamp (**Tricolor Calm** + per-ULB `theme_color`) — programme plan **`docs/runbooks/phase-ux-revamp-plan.md`**; start implementation with **`docs/runbooks/master-sprint-614-plan.md`**. Gates Phase 7 until **6.19** exit.

**Citizen apply smoke (PWA):** hub **Apply** → pick a municipality (e.g. **KMC**) → workspace **Services** → **Birth Certificate** → submit. Dev OTP **`12345`** when `DEV_AUTH_ENABLED`; published birth-cert form uses **`applicant_dob`** (see **`apps/citizen-pwa/lib/service-schemas.ts`**).

After login as **municipality admin**, click **Configure** on a service to open the Sprint 6.7 visual form palette / workflow canvas plus Sprint 6.8 guided fee/document/revenue configuration panel and Sprint 6.10 escalation authoring. The **Dashboard** includes Sprint 6.9 trend tables, SLA-breached queues, workload cards, tenant CSV exports, and Sprint 6.11 PDF downloads. Use **Masters** for revenue heads, address master rows, tax/tariff rows, Sprint 6.9 address CSV dry-run/import, and Sprint 6.10 guided revenue/tariff plus catalogue governance. Use **Operations** for Sprint 6.4 branding, feature flags, KB articles, staff/role assignments, Sprint 6.8 maintenance banners, notification-template preview, Sprint 6.11 KB/RAG, branding asset, bookings controls, and Sprint 6.12 guided staff invite/provisioning UX.

---

## Step 9c — (Optional) State Super-Admin portal

Only if you seeded Keycloak dummy operators and need the state-level Phase 6 UI:

```bash
pnpm --filter @enagar/admin-state dev
```

- State Admin: **`http://localhost:3003`** (Sprint **6.19** — teal platform theme, executive dashboard chrome)
- Env template: **`apps/admin-state/.env.example`** → **`.env.local`**
- Exit checklists/plans: **`docs/runbooks/master-sprint-65-exit.md`**, **`docs/runbooks/master-sprint-66-exit.md`**, **`docs/runbooks/master-sprint-69-exit.md`**, **`docs/runbooks/master-sprint-610-exit.md`**, **`docs/runbooks/master-sprint-612-exit.md`**
- Sprint 6.9 smoke: filter audit logs, export audit CSV, and click a tenant row for the detail drill-down panel.
- Sprint 6.10 smoke covers analytics v2 date ranges/deltas and public transparency aggregate outputs.
- Sprint 6.12 covers global service library curation, integration cockpit metadata/readiness, and onboarding/audit hardening.

Sign in with a **`state_admin`** dummy user. The dashboard supports municipality onboarding, tenant directory review, audited impersonation token creation, cross-tenant analytics, and recent audit log review.

---

## Step 9d — (Future) Citizen mobile app — Sprint 6.20

**Not part of Sprint 6.19 sign-off.** Full **Citizen PWA parity** (central hub, shortcuts, all workspace tabs) is planned in **`docs/runbooks/master-sprint-620-plan.md`** and **blocks Phase 7** until closed.

When implementing 6.20:

```bash
pnpm --filter @enagar/mobile dev
```

- Copy **`apps/mobile/.env.example`** → **`apps/mobile/.env`** (`EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/api` on laptop web).
- Add **`http://localhost:8081`** to **`CORS_ORIGIN`** in **`infrastructure/.env`** (already in template) and restart the API.
- **Expo Web:** press **`w`** in the Expo terminal, or open the URL Metro prints.
- **Android emulator:** use `http://10.0.2.2:3001/api` in `.env`.
- **Physical device:** use your PC LAN IP; install **Expo Go for SDK 52** (project uses Expo SDK 52, not store SDK 54).

See [`apps/mobile/README.md`](../../apps/mobile/README.md).

---

## Step 10 — Log in locally (OTP)

When **`DEV_AUTH_ENABLED=true`** and **`DEV_OTP_CODE`** is set in **`infrastructure/.env`**:

1. Open **`http://localhost:3000`**
2. Enter a **10-digit mobile** number (Indian format rules apply in places)
3. Use the OTP from **`DEV_OTP_CODE`** (default in the sample file is often **`12345`** unless you changed it)

---

## Operator: add a grievance type (Sprint 6.21–6.24)

1. **State Admin** (`http://localhost:3003`) → **Grievance library** — create a **global category** and its **sub-types** (kebab-case codes, e.g. `broken-streetlight` / `lamp-out`).
2. **Tenant Admin** (`http://localhost:3002`) → **Masters** → **Grievance catalogue** — **Adopt** a global row, or create a **tenant-only** category. Use **Fork** to customize labels locally; **Deactivate** hides a type from citizens without deleting history.
3. **Operations** tab (same Masters area) — set **SLA hours** and **routing role** per category.
4. **Citizen PWA** (`http://localhost:3000`) or **mobile** (`http://localhost:8081`) — file a test grievance; the picker loads from `GET /api/public/tenants/:code/grievance-catalogue`.

State can also **Adopt** global types for a municipality from the municipality **Profile** drawer (Municipalities tab).

---

## Shortcut: run API + PWA together

Instead of two terminals, from the repo root:

```bash
pnpm dev
```

That starts multiple apps via Turbo (can be noisy; filtering two packages as above is clearer for beginners).

---

## Useful URLs (after everything is up)

| What               | Address                      |
| ------------------ | ---------------------------- |
| Citizen PWA        | http://localhost:3000        |
| Tenant Admin       | http://localhost:3002        |
| State Admin        | http://localhost:3003        |
| API health         | http://localhost:3001/health |
| API docs (Swagger) | http://localhost:3001/docs   |
| Keycloak console   | http://localhost:8080        |

**Master Sprint 5.4:** PWA installability (manifest + `/sw.js`) and query deep links (`?grievance=`, `?application=`) — see [`docs/runbooks/master-sprint-54-exit.md`](../runbooks/master-sprint-54-exit.md). Optional web push: set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on the PWA; Expo mobile registers push tokens after sign-in when running on a physical device.

**Master Sprint 6.6:** Citizen PWA/mobile service forms come from DB-published `service_form_versions`. If Services appears empty after admin form changes, rerun `pnpm db:seed` for local fixtures or publish a form from Tenant Admin, then refresh the citizen app.

Exact Keycloak admin user/password come from **`infrastructure/.env`**.

---

## Stop the stack when you are done

- Stop **API / PWA**: press **`Ctrl+C`** in each terminal.
- Stop **Docker services** (keeps data):

```bash
pnpm infra:down
```

- **Danger:** wipe databases and volumes (full reset):

```bash
pnpm infra:reset
```

---

## Troubleshooting (short)

| Problem                                              | What to try                                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm` not found                                     | Install Node 20 + `npm install -g pnpm@9`, restart the terminal                                                                                                                   |
| Docker errors                                        | Start Docker Desktop; ensure **WSL2** backend on Windows works                                                                                                                    |
| **`citizens` does not exist** / 500 after login pins | Run **Step 6** again against the DB the API uses. Check API log **`Postgres target`**. Match **`DATABASE_URL`** to Compose (see [`apps/api/README.md`](../../apps/api/README.md)) |
| OTP always fails                                     | Check **`DEV_AUTH_ENABLED`** and **`DEV_OTP_CODE`** in **`infrastructure/.env`**; restart API after changes                                                                       |
| PWA cannot reach API                                 | Confirm API on **3001**; firewall; correct **`NEXT_PUBLIC_API_BASE_URL`**                                                                                                         |

For deeper setup (offline LLM, ZAP scans, Keycloak realm import), use the **[main README](../../README.md)** **[Quickstart](../../README.md#quickstart)** and **[docs/runbooks/keycloak.md](../runbooks/keycloak.md)**.
