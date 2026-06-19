# Master Sprint 8.5F Exit — Health booking citizen PWA & polish

**Status:** **complete** (2026-06-19)  
**Plan:** [`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md) · Depends on **8.5E** [`master-sprint-85e-exit.md`](./master-sprint-85e-exit.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Next slice:** **8.5F2** — My Bookings + formatted receipt PDF + admin Booking Summary ([`master-sprint-85f2-plan.md`](./master-sprint-85f2-plan.md))

---

## Implementation plan (execution order)

| Step | ID | Work | Verify |
| ---- | -- | ---- | ------ |
| 1 | F1 | PWA fleet API helpers (`fetchFleetAvailability`, `quoteFleetBooking`, `createFleetBookingHold`) | typecheck |
| 2 | F2 | `HealthBookingsWorkspace` + `HealthFleetBookingInner` — pooled calendar, details, pay/emergency | PWA manual §1–§5 |
| 3 | F2 | `page.tsx` — Health category routes `ambulance` / `hearse` | PWA manual §1 |
| 4 | F3 | PDF: hide vehicle name; pickup + emergency on ambulance PDF | unit spec + manual §6 |
| 5 | F4 | Admin calendar type chips (`AMBULANCE`, `HEARSE`, …) | manual §7 |
| 6 | F5 | Concurrency: parallel holds → one 409 | smoke + unit |
| 7 | — | Exit runbook + regression checklist | this document |

---

## Deliverables

| ID | Deliverable | Evidence |
| -- | ----------- | -------- |
| F1 | Citizen PWA wired to fleet APIs (no `asset_code`) | `bookings-api.ts` |
| F2 | Health fleet booking UX | `health-bookings-workspace.tsx` · `health-fleet-booking-inner.tsx` · `page.tsx` |
| F3 | Health PDF variants | `bookings-pdf.util.ts` · `bookings.service.ts` |
| F4 | Admin calendar asset-type filters | `bookings-calendar-panel.tsx` · `bookings-calendar.util.ts` |
| F5 | Concurrency test | `bookings-fleet-pool.util.spec.ts` · `smoke-health-fleet-booking.mjs` |

---

## Exit criteria

| ID | Criterion | Pass | Verification |
| -- | --------- | ---- | -------------- |
| F1 | PWA calls `fleet-availability` (not per-asset list) for ambulance/hearse | ✅ | code + manual §2 |
| F2 | No vehicle picker in citizen UI; slots show “N ambulances/hearses available” | ✅ | manual §2 |
| F3 | Ambulance: pickup address required before hold | ✅ | manual §3 |
| F4 | Emergency: no pay step; ₹0 rent; confirm succeeds | ✅ | manual §4 + smoke |
| F5 | Hearse: BPL declare checkbox; paid path still works | ✅ | manual §5 |
| F6 | Confirmation PDF omits vehicle name for health fleet | ✅ | unit + manual §6 |
| F7 | Ambulance PDF includes pickup address | ✅ | unit + manual §6 |
| F8 | Admin calendar filters by `AMBULANCE` / `HEARSE` | ✅ | manual §7 |
| F9 | Parallel holds on last hearse unit → one success, one **409** | ✅ | smoke |
| F10 | Community hall + LED booking regressions unchanged | ⏳ | manual §8 |
| F11 | `pnpm --filter @enagar/citizen-pwa typecheck` green | ⏳ | CI |
| F12 | API unit tests green | ⏳ | CI |

---

## Prerequisite after pull

```bash
pnpm --filter @enagar/api prisma migrate deploy
pnpm --filter @enagar/api prisma db seed
pnpm infra:up   # API :3001, citizen PWA, tenant admin :3002
```

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- fleet-pool bookings-pdf bookings-calendar
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-health-fleet-booking.mjs
graphify update .
```

---

## Complete manual smoke checklist (operator sign-off after 8.5F)

Use this checklist after **8.5E + 8.5F** are deployed. Tick each item before product sign-off.

**Prereqs:** `pnpm infra:up`, migrate + seed, API `:3001`, Citizen PWA (default `:3000`), Tenant Admin `:3002`, Keycloak citizen user (e.g. mobile `9876500099` OTP `123456`).

---

### A. Environment & data

| # | Step | Expected |
| - | ---- | -------- |
| A1 | Run migrate deploy + db seed | KMC health fleet seeded (2 ambulances, 1 hearse) |
| A2 | API health: `GET /api/health` or smoke script | 200 OK |
| A3 | Automated smoke: `node scripts/smoke/smoke-health-fleet-booking.mjs` | Exit 0 (paid ambulance, emergency, hearse, concurrency) |

---

### B. Citizen PWA — Health category entry

| # | Step | Expected |
| - | ---- | -------- |
| B1 | Open Citizen PWA → select **KMC** tenant → log in | Authenticated home |
| B2 | Open **Health** category | Service cards include **Ambulance** and **Hearse** only (no crematorium) |
| B3 | Confirm **no** ambulance/hearse under **Bookings & Rentals** | Health services only in Health category |
| B4 | Tap **Ambulance** | Opens “Book municipal ambulance” — **no** vehicle list step |
| B5 | Tap **Cancel** → tap **Hearse** | Opens “Book hearse van” — **no** vehicle list |

---

### C. Fleet pool calendar (ambulance)

| # | Step | Expected |
| - | ---- | -------- |
| C1 | On ambulance flow, view weekday calendar | Hour grid 09:00–21:00 IST; **no** vehicle names |
| C2 | Free slots show unit count | e.g. “**2 ambulances available**” or “**1 ambulance available**” |
| C3 | Fully booked slot | Disabled / “No units” |
| C4 | Select 1-hour slot → **Continue to details** | Details form opens |

---

### D. Ambulance — paid booking

| # | Step | Expected |
| - | ---- | -------- |
| D1 | Enter pickup address (required), name, mobile | Continue enabled only with pickup |
| D2 | Leave emergency **unchecked** → **Continue to payment** | Quote + checkout with rent (deposit ₹0) |
| D3 | **Pay and confirm (stub)** | Success message + booking number |
| D4 | Download **confirmation PDF** | PDF has booking no, slot time, pickup address; **no** ambulance unit name/code |
| D5 | Repeat slot on same hour (if still free) | `available_units` decreased by 1 |

---

### E. Ambulance — emergency (₹0)

| # | Step | Expected |
| - | ---- | -------- |
| E1 | New slot → details → check **Emergency ambulance** | Button reads “Confirm emergency booking” (no pay step) |
| E2 | Submit with pickup address | Confirmed immediately without payment |
| E3 | PDF for emergency booking | Shows “Emergency booking: yes”, rent ₹0, pickup address |
| E4 | Book **2nd** emergency same day (same citizen) | Succeeds |
| E5 | Attempt **3rd** emergency same day | Error / rate limit (429) |
| E6 | Emergency without pickup address | Blocked in UI; API would return 400 |

---

### F. Hearse — fleet pool

| # | Step | Expected |
| - | ---- | -------- |
| F1 | Hearse calendar | “**1 hearse available**” on free slots (KMC seed) |
| F2 | Details: optional BPL declare checkbox | Can proceed with or without |
| F3 | Paid path: stub pay → confirm | Booking number issued |
| F4 | Hearse confirmation PDF | Slot time + contact; **no** hearse unit name |

---

### G. Admin — operations

| # | Step | Expected |
| - | ---- | -------- |
| G1 | Tenant Admin → **Operations → Health Bookings** | 2 ambulances + 1 hearse listed (internal codes visible) |
| G2 | **Operations → Bookings** calendar → chip **Ambulance** | Only ambulance reservations/availability |
| G3 | Chip **Hearse** | Only hearse rows |
| G4 | Click a health reservation event | Draft shows **assigned** `asset_code` (dispatch detail) |
| G5 | Deactivate one ambulance in Health Bookings | Citizen calendar `available_units` drops by 1 |

---

### H. API regression (curl or smoke)

| # | Step | Expected |
| - | ---- | -------- |
| H1 | `GET .../assets?service_code=ambulance` | `[]` |
| H2 | `GET .../assets?service_code=community-hall` | Halls listed (not empty) |
| H3 | `GET .../assets?service_code=ad-led` | LED boards listed |
| H4 | Hold with `asset_code` on ambulance | **400** |
| H5 | Parallel holds on last hearse slot | One **201/200**, one **409** |

---

### I. Regression — other booking flows

| # | Step | Expected |
| - | ---- | -------- |
| I1 | **Bookings & Rentals → Community hall** | Asset picker → calendar → pay path works |
| I2 | **Advertising → LED board** | Deferred quote/application flow works |
| I3 | **Advertising → Hoarding** | Calculator flow opens (8.5D still deferred for billboard booking) |
| I4 | Smart parking / EV / water | Unaffected (smoke spot-check if time permits) |

---

### J. Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | Automated tests + smoke green |
| Product | | | Manual A–I complete |
| Operations | | | Admin G1–G5 verified on KMC |

---

## Out of scope (confirmed deferred)

- Digital billboard (`ad-billboard`) booking
- Crematorium service card or booking
- Real-time dispatch map / ETA
- Citizen vehicle picker

---

_Last updated: 2026-06-19_
