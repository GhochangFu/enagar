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
- **`db:seed`** fills minimum data the app expects (tenants, etc.).

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

By default the PWA talks to **`http://localhost:3001/api`**. Change that only if you run the API on another host/port (`NEXT_PUBLIC_API_BASE_URL` — see [`apps/citizen-pwa/README.md`](../../apps/citizen-pwa/README.md)).

---

## Step 10 — Log in locally (OTP)

When **`DEV_AUTH_ENABLED=true`** and **`DEV_OTP_CODE`** is set in **`infrastructure/.env`**:

1. Open **`http://localhost:3000`**
2. Enter a **10-digit mobile** number (Indian format rules apply in places)
3. Use the OTP from **`DEV_OTP_CODE`** (default in the sample file is often **`12345`** unless you changed it)

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
| API health         | http://localhost:3001/health |
| API docs (Swagger) | http://localhost:3001/docs   |
| Keycloak console   | http://localhost:8080        |

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
