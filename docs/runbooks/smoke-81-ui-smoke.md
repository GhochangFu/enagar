# Sprint 8.1 — UI smoke test report

**Date:** 2026-06-03  
**Scope:** Bookable assets (sports facilities), Community Hall service + booking workflow, citizen slot applications, clerk desk approve/reject, slot reopen on reject.

**Environment**

| Service      | URL                                   | Notes                                                                            |
| ------------ | ------------------------------------- | -------------------------------------------------------------------------------- |
| API          | `http://localhost:3001/api`           | Running                                                                          |
| Citizen PWA  | `http://localhost:3000`               | Running                                                                          |
| Tenant Admin | `http://localhost:3002`               | Was **down** at start of session; started with `pnpm dev` in `apps/admin-tenant` |
| Keycloak     | `http://localhost:8080/realms/enagar` | Dev OTP `12345`                                                                  |

**Credentials**

- Tenant admin: `kmc-tenant-admin-dummy` / `DummyDev_2026!ChangeMe`
- Clerk: `kmc-municipality-clerk-dummy` / same password
- Citizen OTP: mobile `9876543210` or booking owner `9836177767`, OTP `12345`

**Data setup:** `scripts/smoke-81-ui-setup.ps1` (sports assets + availability). **Other facility service:** `scripts/provision-other-facility-booking.ps1` (KMC `other-facility-booking` on **general** department; sports assets only; halls stay on `community-hall`).

**Screenshots:** `docs/runbooks/smoke-81-ui-output/screenshots/`

---

## Summary

| Area                                                          | Result                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Sports assets + availability (API + Operations UI)            | **Pass**                                                               |
| Service Designer — booking workflow + bookable asset mapping  | **Pass** (requires admin-tenant running)                               |
| Clerk Desk — inbox, review-slot, confirm, reject              | **Pass** (use `?docket=` deep link for reliable detail panel)          |
| Slot reopen after reject                                      | **Pass** (public slot `free` after UI reject)                          |
| Citizen — OTP login                                           | **Pass**                                                               |
| Citizen — enter KMC workspace + new slot booking (automation) | **Fail / blocked** (hub clicks); use deep link below                   |
| Citizen — booking deep link (`?tenant=KMC&service=…&book=1`)  | **New** — bypasses hub navigation after OTP                            |
| Citizen — application detail / single receipt                 | **Not re-verified in UI** (API: `related_payments` count = 2 on 00008) |

**Overall:** Core 8.1 booking loop (assets → service mapping → desk → slot release) is **healthy** when admin-tenant is up. Citizen workspace navigation remains fragile in browser automation (known from prior session).

---

## Step-by-step results

### 1. Bookable assets (sports facilities)

| Step                                                   | Result | Evidence                                                                                            |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| Upsert `kmc-multipurpose-ground`, `kmc-tennis-court-a` | Pass   | Setup script + Operations → Bookings lists both as **active**                                       |
| Bulk weekday availability 09:00–21:00                  | Pass   | Script + calendar shows **Available** blocks on both assets                                         |
| Public catalogue scoped to `community-hall`            | Pass   | 4 assets: `community-hall-main`, `rabindra-bhawan`, `kmc-multipurpose-ground`, `kmc-tennis-court-a` |

Screenshot: `07-operations-bookings-assets.png`

### 2. Service — Community Hall + workflow

| Step                                                                         | Result | Evidence                                               |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| Open Service Designer `fcba5a60-9d4f-4e49-bb62-d7549531a01d`                 | Pass   | No Retry error when admin-tenant running               |
| Workflow `community-hall-booking-v1` + **Hall & facility booking (replace)** | Pass   | Visible in designer                                    |
| Bookable assets mapping panel                                                | Pass   | 4 checkboxes; **Save asset mapping** present           |
| Map includes sports assets                                                   | Pass   | `kmc-multipurpose-ground`, `kmc-tennis-court-a` listed |

Screenshot: `08-service-designer-bookable-assets.png`

**Note:** Operations → Bookings is **admin-only**; clerk session shows “Administrator access required”.

### 3. Citizen — slot applications

| Step                                   | Result            | Evidence                                                                            |
| -------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| OTP login (`9876543210` / `12345`)     | Pass              | Hub loads after `type` on OTP field                                                 |
| Enter KMC workspace                    | Fail (automation) | Apply → **Enter workspace** and Home → KMC card do not switch to workspace step     |
| Deep link to booking workspace         | Pass (code)       | `http://localhost:3000/?tenant=KMC&service=other-facility-booking&book=1` after OTP |
| Create new sports-ground booking in UI | Not run           | Blocked on workspace; existing dockets used for desk tests                          |

Pre-existing slot bookings used for desk:

- `WBM/KMC/community-hall/2026/00008` — rabindra-bhawan, 4 Jun 11:00–14:00 IST, hold `6c614f3d-…`
- `WBM/KMC/community-hall/2026/00007` — community-hall-main, 10 Jun 10:00–11:00 IST, hold `03da438d-…`

### 4. Clerk Desk — approve / reject

| Step                                              | Result  | Evidence                                                                |
| ------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| Clerk login + Desk inbox                          | Pass    | **MY APPLICATIONS: 12**; community-hall rows visible                    |
| Open dossier                                      | Pass    | URL: `/dashboard/desk?docket=WBM%2FKMC%2Fcommunity-hall%2F2026%2F{nnn}` |
| 00008 — Review Slot → Confirm                     | Pass    | API+UI: stage **confirmed** / status **closed**                         |
| 00007 — Review Slot (API) → Reject (UI + comment) | Pass    | Heading **Community Hall Booking · Rejected**                           |
| Inbox without `?docket=`                          | Partial | Detail/actions easy to miss; deep link recommended                      |

Screenshots: `02-desk-inbox.png`, `04-desk-00008-review-slot.png`, `05-desk-00007-reject-ready.png`, `06-desk-00007-rejected.png`

### 5. Slot reopen after reject

| Check                                                          | Before reject (00007 hold)        | After UI reject       |
| -------------------------------------------------------------- | --------------------------------- | --------------------- |
| Public slot `community-hall-main` @ `2026-06-10T04:30:00.000Z` | **taken**                         | **free**              |
| Application stage                                              | `slot-review` (after review-slot) | **rejected** / closed |

Query used:

`GET /api/public/bookings/assets/community-hall-main/slots?tenant_code=KMC&from=2026-06-10T00:00:00.000Z&to=2026-06-11T00:00:00.000Z`

---

## Issues / follow-ups

1. **admin-tenant not running** — Causes Desk/Designer “Retry” and timeouts on port 3002. Ensure `pnpm dev:portals` or `apps/admin-tenant` dev server before UI smoke.

2. **Citizen workspace automation** — `Enter workspace` and hub KMC card clicks do not advance `step` to `workspace` under agent-browser; manual testing or hardening click targets (e.g. `data-testid`) recommended.

3. **Desk UX** — Workflow action buttons appear only after dossier load; use **docket query param** or click inbox row then wait for **Review Slot / Confirm / Reject** buttons.

4. **Dual payment display** — For 00008, API returns `related_payments: 2` (application fee + booking hold). Confirm in PWA after hard refresh whether UI still shows two receipt blocks (owner mobile `9836177767`).

5. **Clerk `queue=all`** — Returns 403 for clerk (municipality admin only); use **`queue=my`** for clerk inbox.

---

## Quick re-run checklist

```powershell
# Data
.\scripts\smoke-81-ui-setup.ps1

# Slot check helper (PowerShell)
$u = 'http://localhost:3001/api/public/bookings/assets/community-hall-main/slots?tenant_code=KMC&from=2026-06-10T00:00:00.000Z&to=2026-06-11T00:00:00.000Z'
(Invoke-RestMethod $u).slots | Where-Object starts_at -eq '2026-06-10T04:30:00.000Z' | Select status
```

**Desk URLs (clerk):**

- Inbox: `http://localhost:3002/dashboard/desk`
- Docket: `http://localhost:3002/dashboard/desk?docket=WBM%2FKMC%2Fcommunity-hall%2F2026%2F00007`

**Service Designer:**

- `http://localhost:3002/dashboard/services/fcba5a60-9d4f-4e49-bb62-d7549531a01d`
