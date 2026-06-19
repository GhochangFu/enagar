# Master Sprint 8.5C Implementation Plan — LED slot booking (`ad-led`)

> **For implementers:** Execute **C1 → C6** in order. Builds on closed **8.5B** ([`master-sprint-85b-exit.md`](./master-sprint-85b-exit.md)). Exit evidence: [`master-sprint-85c-exit.md`](./master-sprint-85c-exit.md).

**Goal:** Citizen LED board calendar booking via reused Sprint 8.1 bookings engine, scoped by `ad-led` service code; admin LED asset ops under Advertising; tests + smoke green.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5C · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Status:** **complete** (2026-06-18)

---

## Architecture decisions (locked for 8.5C)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Booking engine | Reuse `bookings` module (8.1) | Master plan C2 — no parallel calendar |
| Service scoping | `service_code: ad-led` on quote/hold/slots/list | `bookable_asset_codes` on tenant override |
| Asset type | `LED_BOARD` (new DB check + admin validation) | Distinguish from halls/grounds |
| Citizen entry | `LedBookingWorkspace` → `BookingWorkspace` with LED copy | C3 — thin wrapper, no fork |
| Payment | Deposit + rent via existing hold payment (`include_rent`) | LED boards seeded with `security_deposit_paise > 0` |
| No application form | Direct quote → hold → pay → confirm | Advertising booking, not clerk-review hall flow |
| `service_code` on PDF | Stored in reservation `note` JSON at hold time | C6 without schema migration |
| Revenue head | `booking-fee` on `ad-led` global service | Same rail as community hall |
| Admin CRUD | Operations → Advertising → LED boards section | C4 — filter `LED_BOARD`, PATCH bookings API |

### Reservation note shape (hold)

```json
{
  "hold_expires_at": "2026-06-18T12:15:00.000Z",
  "service_code": "ad-led"
}
```

---

## File manifest

| File | Responsibility |
| ---- | -------------- |
| `prisma/migrations/..._sprint_85c_led_board_asset_type/migration.sql` | `LED_BOARD` on asset_type check |
| `prisma/seed/led-bookable-assets.ts` | KMC 2 LED boards, 06:00–23:00 IST weekdays |
| `service-catalogue.seed.ts` | Global `ad-led` + KMC `bookable_asset_codes` override |
| `bookings-revenue-scope.util.ts` | Resolve revenue head via `bookable_asset_codes` array |
| `booking-reservation-note.util.ts` | Parse/build note JSON incl. `service_code` |
| `bookings.service.ts` | Note on hold, PDF `service_code`, revenue head fix |
| `bookings-pdf.util.ts` | Optional `service_code` line on confirmation PDF |
| `admin-tenant.service.ts` | `assertBookableAssetType` includes `LED_BOARD` |
| `citizen-pwa/components/led-booking-workspace.tsx` | LED wrapper |
| `citizen-pwa/app/page.tsx` | Route `ad-led` → LED booking flow |
| `admin-tenant/components/led-booking-ops-panel.tsx` | Advertising → LED CRUD |
| `admin-tenant/.../advertising-ops-panel.tsx` | Host LED ops section |
| `scripts/smoke/smoke-ad-led-booking.mjs` | API smoke |
| `bookings-revenue-scope.util.spec.ts` | Revenue + scope unit tests |
| `booking-reservation-note.util.spec.ts` | Note round-trip |
| `bookings-pdf.util.spec.ts` | PDF includes `service_code: ad-led` |

---

## Sub-deliverables

### C1 — LED bookable assets

- Migration: `LED_BOARD` allowed on `bookable_assets.asset_type`
- Admin: `assertBookableAssetType('LED_BOARD')` passes
- Seed: `kmc-led-central`, `kmc-led-park-street` — `rate_unit: HOUR`, `base_rate_paise: 100_000`, `security_deposit_paise: 100_000`

### C2 — Reuse bookings API with `ad-led` filter

- `GET /public/bookings/assets?service_code=ad-led` → LED boards only
- Quote/hold/slots reject `community-hall-main` when `service_code=ad-led`
- `resolveRevenueHeadCode` uses `bookableAssetCodesFromOverrideConfig`

### C3 — `LedBookingWorkspace`

- PWA Advertising → LED Board Booking → calendar → checkout (no application form)
- LED-specific headings and empty-state copy

### C4 — Admin Advertising → LED

- List LED boards, create/edit via `PATCH /admin/tenant/bookings/assets`
- Link to bulk availability (06:00–23:00) guidance

### C5 — KMC seed

- 2 boards, weekday 06:00–23:00 IST rolling windows (56 days)
- `tenant_services.override_config.bookable_asset_codes` for `ad-led`

### C6 — Tests + smoke

- Unit: revenue scope, note util, PDF `service_code`
- Smoke: list → slot → quote → hold → pay → confirm → PDF contains `ad-led`
- Smoke: hall via `ad-led` → `400`

---

## Edge cases (must pass)

| Case | Expected |
| ---- | -------- |
| Slot overlaps hold/confirm | `400` slot unavailable |
| Hall via `ad-led` | `400` asset not bookable under service |
| Hold TTL expires | Slot freed (existing 8.1 behaviour) |
| Past slot | `400` |
| Inactive LED asset | Hidden from citizen list |
| Community hall regression | `community-hall` booking unchanged |

---

## Verification commands

```bash
pnpm --filter @enagar/api prisma migrate dev
pnpm --filter @enagar/api prisma db seed
pnpm --filter @enagar/api test -- led booking-revenue booking-reservation bookings-pdf
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-ad-led-booking.mjs
graphify update .
```

---

## Out of scope (8.5C)

- Creative upload CMS / ad network integration
- Prime-time blackout UI (metadata only in seed `rules` optional)
- Rent-only payment without deposit (LED seeded with deposit = 1 hr rate)

---

_Last updated: 2026-06-18_
