# Master Sprint 8.5F2 Exit — Bookings portfolio & formatted receipts

**Status:** **complete** (F2-1–F2-4, F2-8; F2-7 → 8.5G)  
**Plan:** [`master-sprint-85f2-plan.md`](./master-sprint-85f2-plan.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Prerequisite:** **8.5F** complete ([`master-sprint-85f-exit.md`](./master-sprint-85f-exit.md))

**Next slice:** **8.5G** hardening ([`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5G)

---

## Exit criteria

| ID | Criterion | Pass | Verification |
| -- | --------- | ---- | -------------- |
| F2-1 | `GET /citizen/bookings` returns citizen's confirmed bookings with service_code, slot, no health vehicle name | ✅ | `citizen-booking-list.util.spec.ts`, `bookings-citizen-list.service.spec.ts`, smoke list step |
| F2-2 | PWA nav **Applications / Bookings** with sub-tabs **My Applications** \| **My Bookings** | ✅ | `page.tsx`, `my-bookings-panel.tsx`, `booking-detail-panel.tsx`, typecheck |
| F2-3 | My Bookings detail has **Download receipt** for confirmed rows | ✅ | `booking-detail-panel.tsx` + PDF API |
| F2-4 | PDF opens with formatted sections (not single-line blob) | ✅ | `bookings-confirmation.pdf.spec.ts` + manual §3 |
| F2-5 | Ambulance PDF: pickup visible, no vehicle code | ✅ | Model + PDF spec; manual §3 |
| F2-6 | Admin dashboard **Booking Summary** shows totals + recent rows for hall, LED, ambulance, hearse | ✅ | `admin-tenant-booking-summary.util.spec.ts`, dashboard panel |
| F2-7 | Tenant isolation on list + summary APIs | ↪ **8.5G** | Unit scoping in `bookings-citizen-list.service.spec.ts` + `admin-tenant.service.spec.ts`; full security spec in [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5G G1 |
| F2-8 | Smoke scripts green | ✅ | `smoke-health-fleet-booking.mjs`, `smoke-citizen-my-bookings.mjs` |

---

## Manual smoke checklist (operator)

### 1. Citizen — Applications / Bookings tab

1. Log in → open **Applications / Bookings**.
2. Confirm sub-tabs: **My Applications** | **My Bookings**.
3. **My Applications** — existing dockets unchanged (community hall, hoarding, etc.).

### 2. Citizen — My Bookings

1. Complete a new ambulance or hall booking (or use seeded confirmed rows).
2. **My Bookings** lists booking number, service, slot, status **Confirmed**.
3. Select row → **Download receipt** → PDF saves and opens readable.

### 3. PDF formatting

1. Open downloaded PDF (e.g. `booking-BK-KMC-2026-00020.pdf`).
2. Expect: ULB header, title, labelled rows, amounts block, footer — **not** one run-on line.
3. Ambulance: pickup address present; **no** `kmc-ambulance-01` on citizen PDF.

### 4. Admin — Booking Summary

1. Tenant Admin → **Dashboard**.
2. **Booking Summary** section visible with 30d counts.
3. Breakdown includes **Ambulance**, **Hearse**, **HALL**, **LED** (as applicable).
4. Recent table row matches Operations calendar reservation.

### 5. Regression

1. Hall booking still in My Bookings after confirm.
2. Application-linked hall booking still in My Applications.
3. Operations → Health Bookings unchanged (fleet CRUD).

---

## Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | |
| Product | | | Manual §1–§5 |

---

_Last updated: 2026-06-19_
