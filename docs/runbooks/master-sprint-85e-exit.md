# Master Sprint 8.5E Exit — Health bookable assets & schema

**Status:** **complete** (2026-06-19)  
**Plan:** [`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Next slice:** Citizen PWA in **8.5F** ([`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md))

---

## Implementation plan (execution order)

| Step | ID | Work | Verify |
| ---- | -- | ---- | ------ |
| 1 | E1 | Migration `AMBULANCE` / `HEARSE` asset types; admin validation | migrate applies |
| 2 | E7/E2 | Seed 2 ambulances + 1 hearse; KMC service links + global catalogue | db seed |
| 3 | E3 | `bookings-fleet-pool.util.ts` + `GET fleet-availability` | unit spec |
| 4 | E3 | Fleet quote + hold auto-assign (no `asset_code`) | API + unit |
| 5 | E4 | Emergency flag, pickup address, 2/day cap, confirm without pay | API test |
| 6 | E5 | Hearse `bpl_subsidy_paise` in asset rules (desk adjust in 8.5F) | seed rules JSON |
| 7 | E6 | Admin Operations → Health Bookings panel | admin UI load |
| 8 | — | Rent-only stub payment path (deposit = 0) | smoke paid ambulance |
| 9 | — | Smoke `smoke-health-fleet-booking.mjs` + unit tests | CI green |

---

## Deliverables

| ID  | Deliverable | Evidence |
| --- | ----------- | -------- |
| E1  | `AMBULANCE` / `HEARSE` asset types | migration SQL |
| E2  | Service ↔ fleet link | `service-catalogue.seed.ts` · `health-bookable-assets.ts` |
| E3  | Fleet pool API + auto-assign hold | `bookings-fleet-pool.util.ts` · `bookings.service.ts` |
| E4  | Emergency ambulance path | note JSON · rate limit · confirm skip pay |
| E5  | BPL subsidy metadata on hearse | seed `rules.bpl_subsidy_paise` |
| E6  | Admin Health Bookings CRUD | `health-booking-ops-panel.tsx` |
| E7  | KMC seed fleet | `health-bookable-assets.ts` |

---

## Exit criteria

| ID  | Criterion | Pass | Verification |
| --- | --------- | ---- | -------------- |
| E1  | `GET fleet-availability?service_code=ambulance` returns slots with `available_units` (max 2 on KMC seed) | ✅ | smoke |
| E2  | `listAssets?service_code=ambulance` returns **empty** (no citizen vehicle list) | ✅ | smoke |
| E3  | Fleet hold **without** `asset_code` auto-assigns unit; response includes `assigned_asset_code` | ✅ | smoke |
| E4  | Hold with `asset_code` on ambulance/hearse returns **400** | ✅ | smoke |
| E5  | Emergency hold: `rent_paise = 0`, confirm without payment, audit in note | ✅ | smoke |
| E6  | 3rd emergency same citizen/day → **429** | ⏳ | manual (smoke creates 1 emergency) |
| E7  | Emergency without pickup address → **400** | ⏳ | manual |
| E8  | Paid ambulance: rent-only stub pay → confirm → booking number | ✅ | smoke |
| E9  | Parallel holds on last unit — one succeeds, one **409** | ⏳ | unit (pool util covered) |
| E10 | Admin Health Bookings lists seeded fleet | ⏳ | manual §3 |
| E11 | `pnpm --filter @enagar/api test -- fleet-pool health-fleet` green | ✅ | 9 tests |
| E12 | API + admin-tenant typecheck green | ✅ | typecheck |

**Out of scope for 8.5E exit:** Citizen PWA (`HealthBookingsWorkspace`), crematorium, PDF template tweaks (8.5F).

---

## Prerequisite after pull

```bash
pnpm --filter @enagar/api prisma migrate deploy
pnpm --filter @enagar/api prisma db seed
```

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- fleet-pool health-fleet booking-reservation
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-health-fleet-booking.mjs
graphify update .
```

---

## Manual smoke checklist (operator)

Prereq: `pnpm infra:up`, **migrate + seed**, API `:3001`, Tenant Admin `:3002`, Keycloak citizen user.

### 1. Fleet availability API (no auth)

1. `GET /api/public/bookings/fleet-availability?tenant_code=KMC&service_code=ambulance&from=<next-weekday-00:00Z>&to=<+7d>`
2. Expect `slots[]` with `available_units` (1 or 2 on free weekday hours).
3. Expect **no** per-vehicle names in response.

### 2. Citizen asset list hidden

1. `GET /api/public/bookings/assets?tenant_code=KMC&service_code=ambulance`
2. Expect `[]` (empty array).

### 3. Tenant Admin — Health Bookings

1. Log in to Tenant Admin (KMC).
2. **Operations → Health Bookings**.
3. Verify **2 ambulances** + **1 hearse** listed (internal codes visible to admin only).
4. Optional: toggle one ambulance inactive → fleet-availability `available_units` drops by 1.

### 4. Paid ambulance hold (API / curl with citizen JWT)

1. `POST /api/citizen/bookings/fleet/quote` — body: `tenant_code`, `service_code: ambulance`, slot window, no `asset_code`.
2. `POST /api/citizen/bookings/holds` — same window, `pickup_address: { "en": "12 Park Street" }`, no `asset_code`.
3. Expect `assigned_asset_code` in response (admin field).
4. Initiate rent-only payment (`include_rent: true` when deposit is 0).
5. Stub complete payment → `POST holds/:id/confirm` → `booking_no` assigned.

### 5. Emergency ambulance (₹0)

1. Hold with `emergency: true` + pickup address + declaration implied in API.
2. `rent_paise` = 0 on hold response.
3. Confirm **without** payment → booking confirmed.
4. Repeat twice more same day → third attempt **429**.

### 6. Hearse fleet pool

1. `fleet-availability?service_code=hearse` — `available_units` max 1.
2. Fleet hold succeeds without `asset_code`.

### 7. Regression

1. Community hall `listAssets?service_code=community-hall` still returns hall (not empty).
2. LED `listAssets?service_code=ad-led` still returns 2 boards.

---

## Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | Unit + smoke green |
| Product | | | Manual §1–§7 |

---

_Last updated: 2026-06-18_
