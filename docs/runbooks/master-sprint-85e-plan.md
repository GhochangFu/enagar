# Master Sprint 8.5E Implementation Plan — Health bookable assets & schema

> **For implementers:** Execute **E1 → E7** in order. Builds on closed **8.5C** ([`master-sprint-85c-exit.md`](./master-sprint-85c-exit.md)). Citizen PWA ships in **8.5F** ([`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md)).

**Goal:** Backend + admin foundation for **ambulance** and **hearse** fleet bookings using pooled availability and auto-assign — **no crematorium** in this slice.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5E · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Status:** **complete** (2026-06-19) · Exit: [`master-sprint-85e-exit.md`](./master-sprint-85e-exit.md)

---

## Architecture decisions (locked for 8.5E)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Services in scope | `ambulance`, `hearse` only | **Crematorium deferred** per product (2026-06-18) |
| Citizen vehicle picker | **None** | Citizens book service + slot; system assigns unit |
| Admin fleet model | **One `bookable_asset` row per physical unit** | Overlap guards stay per-asset (8.1 pattern) |
| Citizen availability | **Fleet pool API** merges linked units | Slot free iff ≥1 unit free; response includes `available_units` |
| Hold path | `POST hold` with `service_code` + window; **omit `asset_code`** | Server picks first free unit in transaction |
| Asset types | `AMBULANCE`, `HEARSE` (new DB check) | Distinct from halls, `LED_BOARD`, parking |
| Deposits | `security_deposit_paise: 0` | Health fleet — rent only |
| Rate unit | `HOUR` | Align with 8.1 slot grid |
| Emergency ambulance | `emergency: true` on hold → `rent_paise = 0` | Skip payment gate; audit + 2/day cap |
| Hearse BPL | `bpl_subsidy_paise` in asset `rules` / metadata | Desk verifies before quote adjustment (v1) |
| Revenue head | `booking-fee` on global health booking services | Same rail as community hall |

### Fleet pool availability response (sketch)

```json
{
  "service_code": "ambulance",
  "from": "2026-06-20T00:00:00.000Z",
  "to": "2026-06-27T00:00:00.000Z",
  "slots": [
    {
      "starts_at": "2026-06-20T04:00:00.000Z",
      "ends_at": "2026-06-20T05:00:00.000Z",
      "available_units": 2,
      "status": "free"
    }
  ]
}
```

### Hold auto-assign (sketch)

```json
{
  "tenant_code": "KMC",
  "service_code": "ambulance",
  "starts_at": "2026-06-20T04:00:00.000Z",
  "ends_at": "2026-06-20T05:00:00.000Z",
  "pickup_address": { "en": "12 Park Street, Kolkata" },
  "emergency": false
}
```

Response includes `assigned_asset_code` for **admin** surfaces only; citizen PDF omits vehicle name.

---

## File manifest (expected)

| File | Responsibility |
| ---- | -------------- |
| `prisma/migrations/..._sprint_85e_health_asset_types/migration.sql` | `AMBULANCE`, `HEARSE` on `asset_type` check |
| `prisma/seed/health-bookable-assets.ts` | KMC 2 ambulances + 1 hearse, weekday windows |
| `service-catalogue.seed.ts` | Global `ambulance`, `hearse` + KMC `bookable_asset_codes` |
| `bookings.service.ts` | `fleetAvailability`, `createHold` auto-assign branch |
| `bookings-fleet-pool.util.ts` | Merge slots, count free units, pick assignee |
| `public-bookings.controller.ts` | `GET fleet-availability` route |
| `admin-tenant/components/health-booking-ops-panel.tsx` | Operations → Health Bookings CRUD |
| `admin-tenant/.../operations-client.tsx` | Health Bookings nav section |
| `bookings-fleet-pool.util.spec.ts` | Pool merge + assign unit tests |

---

## Sub-deliverables

### E1 — Fleet assets (admin-only units)

- Migration: `AMBULANCE`, `HEARSE` allowed on `bookable_assets.asset_type`
- Assets flagged `citizen_selectable: false` in `rules` JSON (or implied by health asset types in API)
- Seed rates: ambulance ~₹500/hr, hearse ~₹800/hr (catalogue-aligned)

### E2 — Service ↔ fleet link

- KMC override:
  - `ambulance` → `['kmc-ambulance-01', 'kmc-ambulance-02']`
  - `hearse` → `['kmc-hearse-01']`

### E3 — Fleet pool API

- `GET /public/bookings/fleet-availability?tenant_code=&service_code=&from=&to=`
- Merges slots across all linked active units
- `available_units` = count of units with no overlapping hold/confirm for that window

### E4 — Emergency ambulance

- Hold metadata: `emergency`, `emergency_declaration_at`, pickup address required
- Audit table or `booking_reservations` note JSON for emergency flag
- Rate limit: 2 emergency holds per `citizen_id` per IST calendar day → `429`

### E5 — BPL subsidy hook (hearse)

- Optional `bpl_subsidy_paise` on hearse asset rules
- Hold note stores `bpl_declared: true` + document ref when citizen uploads (8.5F form)
- Desk override endpoint or existing hold PATCH for officer-adjusted `rent_paise` (v1)

### E6 — Admin Health Bookings

- Operations → **Health Bookings** section (mirror LED ops pattern)
- List/create/edit ambulance + hearse units
- Emergency policy toggle on tenant feature flags
- Link to bulk availability setup

### E7 — KMC seed

- 2 ambulances, 1 hearse
- Weekday 09:00–21:00 IST rolling windows (align with hall seed pattern unless product specifies 24/7 ambulance)
- **No crematorium** asset

---

## Edge cases (must pass)

| Case | Expected |
| ---- | -------- |
| Emergency without pickup address | `400` |
| 3rd emergency same citizen/day | `429` |
| Parallel hold, 1 unit left | One `201`, one `409` |
| All units inactive | `available_units: 0` everywhere |
| `asset_code` on citizen health hold | `400` — use pool path |
| Cross-tenant fleet query | Empty or `404` |

---

## Verification commands

```bash
pnpm --filter @enagar/api prisma migrate dev
pnpm --filter @enagar/api prisma db seed
pnpm --filter @enagar/api test -- fleet-pool health-booking bookings
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/admin-tenant typecheck
graphify update .
```

---

## Out of scope (8.5E)

- Citizen PWA (`HealthBookingsWorkspace`) — **8.5F**
- Crematorium asset type, seed, or API
- GPS dispatch / 108 integration
- Real-time ETA

---

_Last updated: 2026-06-18_
