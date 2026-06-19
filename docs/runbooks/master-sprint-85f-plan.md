# Master Sprint 8.5F Implementation Plan — Health booking citizen API & PWA

> **For implementers:** Execute **F1 → F5** after **8.5E** ([`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md)) is merged. Exit evidence: [`master-sprint-85f-exit.md`](./master-sprint-85f-exit.md).

**Goal:** Citizens book **ambulance** and **hearse** via Health category using **fleet pool** UX — no vehicle picker, unit count only — with emergency and BPL paths.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5F · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Status:** **complete** (2026-06-19)

**Exit evidence:** [`master-sprint-85f-exit.md`](./master-sprint-85f-exit.md)

---

## Architecture decisions (locked for 8.5F)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Entry | Health category → service cards | Separate from Bookings & Rentals (halls) |
| Workspace | `HealthBookingsWorkspace` → `BookingWorkspace` `variant="fleet"` | Reuse 8.1 calendar/pay/PDF shell |
| Asset step | **Skipped** | Go straight to pooled calendar |
| Availability copy | “**N ambulances available**” / “**1 hearse available**” | Product requirement — no unit names |
| Ambulance form | Pickup address + contact (required) | 8.5E emergency validation |
| Emergency UI | Checkbox + declaration; **no pay button** | ₹0 path |
| Hearse BPL | Declare + upload on details step | Desk adjusts before pay (v1) |
| PDF | Time + location (ambulance); slot time (hearse) | **No vehicle name** on citizen PDF |
| Admin calendar | Filter `AMBULANCE` / `HEARSE` | Show assigned unit on row detail |
| Crematorium | **Out of scope** | Deferred |

### Citizen flow

```text
Health → Ambulance | Hearse
  → Calendar (pooled slots + unit count)
  → Details (pickup / BPL / emergency)
  → Quote → Pay (or emergency skip)
  → Confirmation + PDF
```

---

## File manifest (expected)

| File | Responsibility |
| ---- | -------------- |
| `citizen-pwa/components/health-bookings-workspace.tsx` | Thin wrapper; service copy |
| `citizen-pwa/components/booking-workspace.tsx` | `variant="fleet"` — skip asset step, fleet availability API |
| `citizen-pwa/lib/bookings-api.ts` | `fetchFleetAvailability`, pool hold helpers |
| `citizen-pwa/app/page.tsx` | Route `ambulance` / `hearse` → health booking flow |
| `bookings-pdf.util.ts` | Ambulance + hearse PDF templates (no unit name) |
| `bookings-calendar-panel.tsx` | Asset type filter `AMBULANCE` / `HEARSE` |
| `scripts/smoke/smoke-health-fleet-booking.mjs` | Paid ambulance + emergency + hearse legs |
| `bookings-fleet-pool.util.spec.ts` | Concurrency (F5) |

---

## Sub-deliverables

### F1 — Fleet pool citizen APIs (wire-up)

- PWA uses `fleet-availability` instead of per-asset list for health services
- Hold/quote/confirm without citizen-supplied `asset_code`
- Ambulance hold metadata: `pickup_address`, `holder_mobile`, `emergency`

### F2 — `HealthBookingsWorkspace`

- Health category cards for `ambulance`, `hearse` only
- Headings: “Book municipal ambulance” / “Book hearse van”
- Empty state when `available_units === 0` for entire range

### F3 — Confirmation PDF variants

- Ambulance: pickup time + address lines
- Hearse: slot time + holder contact
- Omit `assigned_asset_code` from citizen-facing PDF

### F4 — Admin calendar filter

- Operations → Bookings: filter chips `AMBULANCE`, `HEARSE`
- Reservation detail shows assigned unit for dispatch

### F5 — Concurrency test

- Two parallel holds on last free ambulance slot → exactly one succeeds

---

## Edge cases (must pass)

| Case | Expected |
| ---- | -------- |
| 0 units for slot | Slot disabled; helper text |
| Non-emergency skips pay | Confirm blocked until stub pay |
| Emergency shows pay | Pay UI hidden |
| Deep link to hall from health | Rejected |
| Hearse BPL declared, not verified | Full quote until desk override |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- fleet-pool health emergency
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-health-fleet-booking.mjs
node scripts/smoke-sprint-85-adv-health.mjs
graphify update .
```

---

## Out of scope (8.5F)

- Crematorium service card or booking flow
- Vehicle picker UI
- Real-time ETA / dispatch map
- Multi-leg hearse routing

---

_Last updated: 2026-06-18_
