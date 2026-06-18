# Master Sprint 8.2 Plan — Smart parking, EV charging & IoT water meter (stub adapters)

**Status:** **in progress** — **8.2A closed in-repo (2026-06-17)** · **8.2B closed in-repo (2026-06-17)** · Exit record: _TBD_ [`master-sprint-82-exit.md`](./master-sprint-82-exit.md) · Jira [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23) **To Do**  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)  
**ROADMAP:** [§ Phase 8](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Slice **8.2**  
**Builds on:** Sprint **8.1** ([`master-sprint-81-exit.md`](./master-sprint-81-exit.md)) — hourly booking calendar, deposit linkage, confirmation PDF  
**Architecture:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Smart City — Real-Time Pricing Hooks

---

## Primary user stories (non-negotiable)

### Smart parking

> As a **citizen**, I open **Smart Parking**, see **zones with live occupancy** (from a stub sensor), pick a **free bay**, get a **zone × time-of-day quote**, **pay**, and receive a **reservation** — so I can park without hunting for an empty slot.

### EV charging

> As a **citizen**, I **reserve a charging slot**, see **per-kWh pricing**, start a session (stub meter), and **pay for kWh consumed** at session end.

### IoT water meter

> As a **citizen**, I enter my **meter ID**, see **balance / last reading** (stub provider), **recharge prepaid credit**, and get a **receipt** — so I can top up without visiting the ULB office.

**Flow order (smart parking — must not be reversed):**

```text
See zone occupancy (stub sensor) → select free bay → quote (zone × time) → pay → confirm reservation
```

---

## Objective

Productionise the **first smart-city citizen paths** for three catalogue services:

| Service code    | Pattern       | Sprint 8.2 focus                                       |
| --------------- | ------------- | ------------------------------------------------------ |
| `smart-parking` | `booking`     | Zone inventory, stub sensor occupancy, reserve-and-pay |
| `ev-charging`   | `tax-payment` | Slot reservation + per-kWh stub metering + settlement  |
| `iot-water`     | `tax-payment` | Prepaid recharge UI + stub meter balance lookup        |

Extend — do not replace — Sprint **8.1** bookings (`bookings` module, `bookable_assets`, stub payments, deposit rail).

---

## What already exists (do not re-build)

| Area                       | Evidence                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Bookings engine            | `apps/api/src/modules/bookings/` — slots, holds, confirm, PDF, deposit payment                  |
| Bookable assets + RLS      | `bookable_assets`, `bookable_asset_availability`, `booking_reservations`                        |
| Stub payment rail          | `PaymentsService`, `StubPaymentGateway`, deposits                                               |
| Fee-rule types (flat/slab) | `admin-tenant-config.contracts.ts` — `FeeRule`, tenant service `fee_config`                     |
| Global services            | `smart-parking`, `ev-charging`, `iot-water` in `service-catalogue.seed.ts` / catalogue          |
| Tenant feature flags       | `packages/types` — `ev_charging.enabled` toggle pattern                                         |
| Architecture contract      | `ARCHITECTURE.md` — pricing service → sensor stub → payment + `NTAX_SMART_PARKING` revenue head |

### Known gaps to close in 8.2

- No **smart-zone** or **parking-bay** inventory model (only generic `bookable_assets`).
- No **sensor adapter interface** or stub occupancy source.
- No **zone × time-of-day** pricing evaluator (hall hourly rate only in 8.1).
- No **EV session** model (kWh counter, start/stop, settlement).
- No **water-meter account** model or prepaid recharge path.
- No citizen PWA surfaces for any of the three services.
- No admin configuration for parking zones, EV chargers, or meter tariff slabs.

---

## Key existing surfaces

- `apps/api/src/modules/bookings/bookings.service.ts` — slot generation, hold/confirm (reuse patterns)
- `apps/api/src/modules/bookings/bookings-slot.util.ts` — discrete slot math
- `apps/api/src/modules/admin-tenant/admin-tenant-config.contracts.ts` — `FeeRule` validation
- `apps/api/src/modules/services/service-catalogue.seed.ts` — `smart-parking`, `ev-charging`, `iot-water`
- `apps/citizen-pwa/components/booking-workspace.tsx` — calendar/hour grid UX (reference for parking bay grid)
- `apps/admin-tenant/app/dashboard/operations/` — Operations shell for asset CRUD

---

## Sub-sprints

### 8.2A — Smart-zone schema & sensor adapter contract

**Status:** **closed in-repo (2026-06-17)** — migration `20260617120000_sprint_82a_smart_parking_schema`, `@enagar/smart-city-adapters`, `SmartParkingModule`, Operations → Smart Parking tab, KMC `ZONE-A` seed (20 bays).

**Deliverables:**

| ID  | Deliverable                     | Detail                                                                                                                                                                                                |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **`smart_zones` table**         | Per tenant: `code`, localized `name`, `ward_id?`, `geo?` JSON, `capacity_bays`, `is_active`. RLS parity with `bookable_assets`.                                                                       |
| A2  | **`parking_bays` table**        | FK `zone_id`, `bay_code`, `status` enum (`FREE`, `OCCUPIED`, `RESERVED`, `OUT_OF_SERVICE`), `last_sensor_at`. Unique `(tenant_id, zone_id, bay_code)`.                                                |
| A3  | **`ISensorProvider` interface** | `getZoneOccupancy(tenantId, zoneCode) → { bays: { code, status }[] }`. Implement **`StubModbusSensorProvider`** (deterministic seed / env-toggle scenarios). Package: `packages/smart-city-adapters`. |
| A4  | **Admin CRUD**                  | Tenant Admin: list/create zones + bays under Operations → Smart Parking (guided form, not raw JSON default).                                                                                          |
| A5  | **Seed**                        | KMC pilot: 1 zone (`ZONE-A`, 20 bays), 2 bays pre-marked occupied in stub provider for demo.                                                                                                          |

**Non-goals:**

- Real Modbus/MQTT hardware bridge (Phase 12 pilot).
- GPS navigation to bay.

---

### 8.2B — Zone × time pricing evaluator

**Status:** **closed in-repo (2026-06-17)** — `SmartPricingService` (`smart-pricing.util.ts`), zone `metadata.pricing_matrix`, `POST /citizen/smart-parking/quote`, `smart-parking` catalogue service + `smart-parking-fee` revenue head.

**Deliverables:**

| ID  | Deliverable                      | Detail                                                                                                                                                                                        |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **`SmartPricingService`**        | Pure function module: inputs `zone_code`, `vehicle_type?`, `starts_at`, `ends_at`; outputs `rent_paise`, `revenue_head_code`. Whitelisted operators only (no Turing-complete DSL).            |
| B2  | **Pricing config shape**         | Extend tenant service override / zone metadata: `pricing_matrix` JSON — `{ vehicle_type?, time_bands: [{ from_hhmm, to_hhmm, rate_paise_per_hour }] }`. Default flat rate when matrix absent. |
| B3  | **`POST …/smart-parking/quote`** | Citizen-authenticated. Validates bay still `FREE` via sensor snapshot + no overlapping `confirmed` reservation.                                                                               |
| B4  | **Revenue head**                 | Resolve `NTAX_SMART_PARKING` (or catalogue default) via existing `ServicesService.resolveLedgerCodesForService`.                                                                              |
| B5  | **Unit tests**                   | Band boundary (inclusive/exclusive), overnight span, zero-duration rejection, unknown zone 404.                                                                                               |

**Non-goals:**

- Dynamic surge pricing from live demand.
- Multi-vehicle cart.

---

### 8.2C — Smart parking reserve-and-pay flow

**Status:** **closed in-repo (2026-06-17)** — citizen hold/confirm/pay, `SmartParkingWorkspace`, admin effective occupancy grid, hold TTL cleanup, duplicate-vehicle guard. Exit: [`master-sprint-82c-exit.md`](./master-sprint-82c-exit.md).

**Deliverables:**

| ID  | Deliverable                                  | Detail                                                                                                                                                |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **`POST …/smart-parking/holds`**             | Lock bay (`RESERVED`), TTL 10 min (config constant). Reject if sensor says `OCCUPIED` or hold exists.                                                 |
| C2  | **`POST …/smart-parking/holds/:id/confirm`** | After stub payment captured → `booking_reservations` row (`asset_type: PARKING_BAY` or link `parking_bay_id`), bay → `OCCUPIED`, assign `booking_no`. |
| C3  | **`GET …/smart-parking/zones`**              | List zones with aggregate `free_count` / `total_count` from latest sensor poll (cache 30 s in-process for v1).                                        |
| C4  | **`GET …/smart-parking/zones/:code/bays`**   | Per-bay status for grid UI.                                                                                                                           |
| C5  | **Citizen PWA — `SmartParkingWorkspace`**    | Zone picker → bay grid (free/taken) → duration picker → quote → stub pay → confirm. Entry: Smart City category + `smart-parking` service card.        |
| C6  | **Tenant Admin — occupancy view**            | Read-only bay grid reflecting stub sensor + reservations (refresh button).                                                                            |

**Non-goals:**

- ANPR / plate recognition.
- Extension of reservation while parked (manual re-book in v1).

---

### 8.2D — EV charging slots & kWh metering (stub)

**Status:** **8.2D-A/B/C closed in-repo (2026-06-18)** — implementation plan [`master-sprint-82d-plan.md`](./master-sprint-82d-plan.md) · exit evidence [`master-sprint-82d-exit.md`](./master-sprint-82d-exit.md). **Next:** 8.2D-D (Admin ops).

**Deliverables:**

| ID  | Deliverable                        | Detail                                                                                                                                                                                       |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **`ev_chargers` table**            | Per tenant: `code`, `name`, `location`, `connector_type`, `max_kw`, `rate_paise_per_kwh`, `is_active`.                                                                                       |
| D2  | **`ev_sessions` table**            | `charger_id`, `citizen_id`, `status` (`HELD`, `CHARGING`, `COMPLETED`, `CANCELLED`), `started_at`, `ended_at`, `kwh_consumed` (decimal), `amount_paise`, `payment_id?`.                      |
| D3  | **`StubEvMeterProvider`**          | Interface `readMeter(sessionId) → kWh`; stub increments fixed kWh on `stop` for demo.                                                                                                        |
| D4  | **API**                            | `GET …/ev-chargers`, `POST …/ev-chargers/:code/holds`, `POST …/ev-sessions/:id/start`, `POST …/ev-sessions/:id/stop` (computes kWh × rate → payment initiate), `POST …/ev-sessions/:id/pay`. |
| D5  | **Citizen PWA — EV charging flow** | List chargers → reserve slot (15 min hold) → Start → Stop → pay consumed amount → receipt metadata (reuse payments receipt JSON contract).                                                   |
| D6  | **Admin**                          | CRUD chargers under Operations → EV Charging; session list read-only.                                                                                                                        |
| D7  | **Seed**                           | 2 chargers at KMC, `rate_paise_per_kwh: 1500` (₹15/kWh).                                                                                                                                     |

**Non-goals:**

- OCPP protocol integration.
- Real-time SoC / connector lock hardware.

---

### 8.2E — IoT water meter prepaid recharge (stub)

**Deliverables:**

| ID  | Deliverable                       | Detail                                                                                                                                                     |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **`water_meter_accounts` table**  | `meter_id` (tenant-scoped unique), `consumer_name`, `consumer_phone?`, `balance_paise`, `last_reading_litres?`, `last_reading_at?`.                        |
| E2  | **`water_meter_recharges` table** | `account_id`, `amount_paise`, `payment_id`, `balance_after_paise`, `created_at`.                                                                           |
| E3  | **`StubWaterMeterProvider`**      | `lookup(meterId) → balance + last reading`; `applyRecharge(meterId, amountPaise)` updates in-memory/DB balance.                                            |
| E4  | **API**                           | `GET …/water-meters/:meterId` (citizen: phone OTP match or meter+phone), `POST …/water-meters/:meterId/recharge` (amount → stub payment → credit balance). |
| E5  | **Citizen PWA — recharge flow**   | Enter meter ID → show balance + last reading → enter recharge amount (presets ₹100/₹500/₹1000) → stub pay → updated balance + payment receipt metadata.    |
| E6  | **Admin**                         | Import/seed meter accounts CSV (minimal: meter_id, name, opening balance); recharge ledger read-only.                                                      |
| E7  | **Seed**                          | 3 demo meters linked to KMC citizen test phones.                                                                                                           |

**Non-goals:**

- Live HMC/SAP SOAP meter integration (ADR-0010 adapter later).
- Postpaid billing cycle.

---

### 8.2F — Docs, tests, verification

**Deliverables:**

| ID  | Deliverable           | Detail                                                                                                                                                        |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Exit runbook**      | `master-sprint-82-exit.md` with evidence table + manual smoke sign-off.                                                                                       |
| F2  | **Security contract** | `tests/security/master-sprint-82.spec.ts` — tenant isolation on zones/chargers/meters, cross-tenant bay hold rejected, recharge auth.                         |
| F3  | **API unit tests**    | Pricing bands, parking hold/confirm, EV session lifecycle, water recharge idempotency.                                                                        |
| F4  | **Smoke script**      | `scripts/smoke-sprint-82-smart-city.mjs` — parking: free bay → hold → pay → confirm → bay taken; EV: start/stop/pay; water: lookup → recharge → balance bump. |
| F5  | **README / help**     | Operator help § smart parking zones, EV tariffs, water meter seeding.                                                                                         |
| F6  | **ROADMAP queue row** | Add **8.2** closed line under Phase 8 when done.                                                                                                              |

---

## Exit criteria

| ID  | Criterion                                                           | Verification                     |
| --- | ------------------------------------------------------------------- | -------------------------------- |
| E1  | Citizen sees **parking bay grid**; occupied bays not selectable     | Manual PWA + API test            |
| E2  | Smart parking **reserve-and-pay** end-to-end with **stub sensor**   | `smoke-sprint-82-smart-city.mjs` |
| E3  | **Zone × time** quote differs by time band (test fixture)           | Unit test                        |
| E4  | EV session: reserve → start → stop → **kWh × rate** payment settles | Smoke + API test                 |
| E5  | Water meter: lookup → recharge → **balance increases**              | Smoke + API test                 |
| E6  | Tenant Admin can **configure** at least one zone and one charger    | Manual Operations                |
| E7  | `pnpm test:security -- master-sprint-82.spec.ts` green              | CI                               |
| E8  | No regression: `master-sprint-81.spec.ts` + core booking tests      | CI                               |
| E9  | `graphify update .` after API/UI code changes                       | Agent rule                       |

---

## Out of scope (Sprint 8.2)

Defer to **8.3–8.4** per [`ROADMAP.md`](../../ROADMAP.md):

- Tenders / EMD / vendor empanelment
- Hoarding rate calculator / LED slot calendar
- Smart waste bin subscription, GIS licensing, rooftop solar, telecom NOC
- Welfare / health bookings
- Real IoT hardware (Modbus/MQTT/OCPP/live meter SOAP)
- Live payment gateway (**3.1B**)
- Native mobile smart-city screens (PWA only for v1)
- Push/SMS notifications for parking expiry or low water balance

---

## Dependencies

| Dependency                            | Status                  |
| ------------------------------------- | ----------------------- |
| Sprint 8.1 — bookings + stub payments | Closed (2026-06-03)     |
| Phase 3 — payments / deposits         | Closed (3.1B deferred)  |
| Phase 6 — fee rules + revenue heads   | Closed                  |
| Phase 7 — Sahayak AI                  | Closed — does not block |

---

## Risks & mitigations

| Risk                                   | Mitigation                                                               |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Pricing DSL creep                      | Whitelisted `time_bands` only; cap matrix size; unit-test boundaries     |
| Sensor stub diverges from real adapter | `ISensorProvider` interface + single swap point; document in exit        |
| EV kWh accuracy                        | Stub meter explicit in UI copy; real OCPP deferred                       |
| Water meter identity                   | Phone match + meter ID; no open lookup without auth factor               |
| Reusing bookings tables for parking    | Optional `parking_bay_id` FK; keep hall `bookable_assets` path unchanged |

---

## Verification plan

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-82.spec.ts tests/security/master-sprint-81.spec.ts
node scripts/smoke-sprint-82-smart-city.mjs
graphify update .
```

---

## Manual smoke (after implementation)

1. `pnpm infra:up` · migrate · seed · API · Tenant Admin · Citizen PWA.
2. **Tenant Admin:** Create smart zone `ZONE-A` with 10 bays; add EV charger; seed water meter `WM-001`.
3. **Citizen PWA — Smart Parking:** OTP login → Smart City → Smart Parking → zone shows free count → pick free bay → 2 h duration → quote reflects time band → stub pay → confirm → bay shows taken.
4. **Citizen PWA — EV:** Pick charger → reserve → Start → Stop (stub kWh) → pay → receipt metadata loads.
5. **Citizen PWA — Water:** Enter `WM-001` → balance shown → recharge ₹500 → stub pay → balance +₹500.
6. **Regression:** Community hall hourly booking (8.1) still works.
7. **Security:** Cross-tenant zone list returns only own tenant data.

---

## Decision defaults (locked for this sprint)

| Topic            | Decision                                                              |
| ---------------- | --------------------------------------------------------------------- |
| Sensor source    | **`StubModbusSensorProvider`** only; interface ready for real adapter |
| Parking payment  | **Stub only** (3.1B out of scope)                                     |
| Parking hold TTL | **10 minutes** default                                                |
| EV hold TTL      | **15 minutes** default                                                |
| EV metering      | **Stub kWh** on stop; rate per kWh on charger row                     |
| Water auth       | **Meter ID + citizen phone** match (same pattern as lease lookup)     |
| Pricing          | **Zone × time bands** + optional `vehicle_type`; flat fallback        |
| UI surface       | **Citizen PWA** + Tenant Admin ops; no native mobile in 8.2           |
| Pilot tenant     | **KMC** seed for all three services                                   |

---

## Jira

- Parent: [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) — Bookings, Smart-City & Tender Modules
- Sub-task: [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23) — Sprint 8.2 — Smart parking, EV charging & IoT water meter (stub adapters)

---

_Last updated: 2026-06-17 — drafted from Phase 8 ROADMAP slice 8.2, ARCHITECTURE § Smart City, and Sprint 8.1 bookings foundation._
