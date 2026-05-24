# Unified Portal Option A — manual QA script

**Use on:** demo VM (`demosites.co.in`) after [VM setup](./unified-portal-vm-setup-beginner.md)  
**Companion:** [unified-portal-option-a-exit.md](./unified-portal-option-a-exit.md) (maps to E1–E14)

Mark **Pass / Fail** for each row. Note the browser and date in the sign-off table at the bottom.

---

## A. Hub and navigation

| ID        | Steps                                                     | Pass condition                                        |
| --------- | --------------------------------------------------------- | ----------------------------------------------------- |
| **A-01**  | Open `https://enagar.demosites.co.in` → click **Citizen** | Lands on `https://enagarcitizen.demosites.co.in/`     |
| **A-02**  | Hub → **Municipal staff**                                 | Lands on `https://enagartenant.demosites.co.in/login` |
| **A-03**  | Hub → **State administration**                            | Lands on `https://enagarstate.demosites.co.in/login`  |
| **A-03b** | View page source / links on hub                           | **No** link to `enagarauth`                           |

---

## B. Citizen portal

| ID       | Steps                                                                | Pass condition                       |
| -------- | -------------------------------------------------------------------- | ------------------------------------ |
| **A-04** | Sign in (OTP) → pin a ULB (e.g. KMC) → open workspace → refresh page | Session survives refresh             |
| **A-05** | **Services** → **Birth Certificate** → upload proof → **Submit**     | Docket visible; no red CORS banner   |
| **A-10** | Repeat hub + citizen on phone or narrow browser (320px)              | Layout usable; hub scrolls on mobile |

**Dev-only note:** if `DEV_AUTH_ENABLED=true`, OTP is `DEV_OTP_CODE` from `infrastructure/.env`.

---

## C. Tenant Admin

| ID         | Steps                                                             | Pass condition                                                     |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| **A-06**   | Sign in as clerk (`kmc-tenant-clerk-dummy` or similar) → **Desk** | Scoped application/grievance list loads                            |
| **A-06b**  | Open one application from Desk                                    | Detail view loads                                                  |
| **A-07**   | Sign in as municipality admin → **Configure** on a service        | Designer opens                                                     |
| **A-09**   | Start login → cancel at Keycloak                                  | Returns to `https://enagartenant.demosites.co.in/login` with error |
| **Logout** | Click logout in Tenant Admin                                      | Returns to `/login` on **tenant** host (not auth host)             |

---

## D. State Admin

| ID         | Steps                                                  | Pass condition                                       |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **A-08**   | Sign in as `state_admin` dummy → **Grievance library** | Catalogue loads                                      |
| **A-09**   | Cancel OAuth at Keycloak                               | Error on `https://enagarstate.demosites.co.in/login` |
| **Logout** | Logout                                                 | Returns to `/login` on **state** host                |

---

## E. API, TLS, and assets

| ID         | Steps                                                              | Pass condition                                 |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **API-01** | `curl https://enagarapi.demosites.co.in/health`                    | HTTP 200                                       |
| **E8**     | Hard refresh on `/dashboard`, citizen workspace                    | No 404; `/_next/static/*` loads (Network tab)  |
| **E10**    | DevTools Console on citizen + tenant during Desk load              | No CORS errors                                 |
| **E12**    | Browser padlock on each subdomain                                  | Valid wildcard cert                            |
| **E14**    | Edit `portal-hub/maintenance.json` → `enabled: true` → refresh hub | Banner visible; set back to `false` after test |

---

## F. Repo CI (run on laptop before VM cutover)

| Check              | Command                                             |
| ------------------ | --------------------------------------------------- |
| Security contracts | `pnpm test:security -- unified-portal`              |
| Demo builds        | `pnpm build:portal-demo && pnpm verify:portal-demo` |

---

## Sign-off

| Tester | Date | Browser | A-01–A-10 | API/infra | Notes |
| ------ | ---- | ------- | --------- | --------- | ----- |
|        |      |         |           |           |       |
