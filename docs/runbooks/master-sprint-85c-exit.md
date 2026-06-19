# Master Sprint 8.5C Exit — LED slot booking (`ad-led`)

**Status:** **complete** (2026-06-18)  
**Plan:** [`master-sprint-85c-plan.md`](./master-sprint-85c-plan.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

---

## Deliverables

| ID  | Deliverable | Evidence |
| --- | ----------- | -------- |
| C1  | `LED_BOARD` assets + seed | migration · `led-bookable-assets.ts` |
| C2  | Bookings API scoped by `ad-led` | `bookings.service.ts` · smoke |
| C3  | `LedBookingWorkspace` in citizen PWA | component · `page.tsx` |
| C4  | Admin Advertising → LED ops | `led-booking-ops-panel.tsx` |
| C5  | KMC 2 boards, 06:00–23:00 IST | seed |
| C6  | Tests + smoke | unit specs · `smoke-ad-led-booking.mjs` |

---

## Exit criteria

| ID  | Criterion | Pass | Verification |
| --- | --------- | ---- | ------------ |
| E1  | `ad-led` lists only LED boards for KMC | ✅ | smoke list assets |
| E2  | Hall rejected when `service_code=ad-led` | ✅ | smoke quote 400 |
| E3  | Hold → pay → confirm → booking number | ✅ | smoke E2E |
| E4  | Confirmation PDF includes `service_code: ad-led` | ✅ | smoke PDF text |
| E5  | Overlap guard on second hold | ✅ | existing `bookings.db.spec.ts` |
| E6  | `pnpm --filter @enagar/api test -- led booking-revenue` green | ✅ | 10 tests |
| E7  | API + citizen-pwa typecheck green | ✅ | admin-tenant has pre-existing rental-assets TS errors |
| E8  | Community hall booking regression | ⏳ | manual §4 |

---

## Prerequisite after pull

```bash
pnpm --filter @enagar/api prisma migrate dev
pnpm --filter @enagar/api prisma db seed
```

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- led booking-revenue booking-reservation bookings-pdf
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-ad-led-booking.mjs
graphify update .
```

---

## Manual smoke checklist (operator)

Prereq: `pnpm infra:up`, **migrate + seed**, API `:3001`, Citizen PWA `:3000`, Tenant Admin `:3002`, Keycloak users seeded.

### 1. Citizen LED booking E2E

1. Log in to Citizen PWA (KMC).
2. Open **Advertising & Hoarding** (or Advertising category).
3. Tap **LED Board Booking** — LED calendar opens (not a permission form).
4. Pick **KMC LED — Central Crossing** (or Park Street).
5. Select a **weekday** and a **free 1-hour slot** (06:00–23:00 IST window).
6. Proceed to checkout — verify **rent + security deposit** shown (₹1,000 + ₹1,000 for 1 hr at seed rates).
7. Pay (stub) and confirm — expect **booking number** `BK/KMC/...`.
8. Download **confirmation PDF** — verify line `Service: ad-led`.

### 2. Service scoping

1. In browser devtools or API client, call quote with `service_code: ad-led` and `asset_code: community-hall-main`.
2. Expect **400** — asset not bookable under `ad-led`.

### 3. Tenant Admin — LED ops

1. Log in to Tenant Admin (KMC).
2. **Operations → Advertising** — scroll to **LED boards** section.
3. Verify **2 seeded boards** listed (Central, Park Street).
4. Optional: edit hourly rate on one board → save → citizen list reflects new rate on next quote.

### 4. Regression — community hall

1. Citizen PWA → **Bookings** → **Community Hall Booking**.
2. Complete a 1-hour slot hold + pay + confirm (or verify existing flow still loads halls).
3. Hoarding calculator (`ad-hoarding`) still opens calculator first — unchanged.

### 5. Hold overlap (optional desk)

1. Book the same LED slot twice as two citizens — second hold should fail with slot unavailable.

---

## Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | Unit + smoke green |
| Product | | | Manual §1–§4 |

---

_Last updated: 2026-06-18_
