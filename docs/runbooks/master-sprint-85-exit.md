# Master Sprint 8.5 Exit — Advertising, health bookings & Phase 8 hardening

**Status:** **complete** (2026-06-19)  
**Plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24) · Parent [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)

**Partial Phase 8 exit:** [`phase-8-partial-exit.md`](./phase-8-partial-exit.md) — EN-10 remains open until held 8.3/8.4 slices ship.

---

## Sub-slice evidence

| Slice | Scope | Exit record |
| ----- | ----- | ----------- |
| 8.5A | Hoarding rate matrix + admin API | [`master-sprint-85a-exit.md`](./master-sprint-85a-exit.md) |
| 8.5B | Citizen hoarding calculator PWA | [`master-sprint-85b-exit.md`](./master-sprint-85b-exit.md) |
| 8.5C | LED deferred booking (`ad-led`) | [`master-sprint-85c-exit.md`](./master-sprint-85c-exit.md) |
| 8.5E | Health fleet backend | [`master-sprint-85e-exit.md`](./master-sprint-85e-exit.md) |
| 8.5F | Health fleet citizen PWA | [`master-sprint-85f-exit.md`](./master-sprint-85f-exit.md) |
| 8.5F2 | My Bookings + receipt PDF + Booking Summary | [`master-sprint-85f2-exit.md`](./master-sprint-85f2-exit.md) |
| 8.5G | Security, abuse caps, combined smoke | This doc § G |
| 8.5H | Docs, tests, operator help | This doc § H |

**Deferred:** 8.5D digital billboard PWA · crematorium booking · tenders/EMD/vendor (8.3) · pension (8.4).

---

## Exit criteria (parent plan)

| ID | Criterion | Pass | Verification |
| -- | --------- | ---- | ------------ |
| E1 | Hoarding calculator quote varies by ward/size/duration | ✅ | `hoarding-rate.util.spec.ts`, `smoke-hoarding-calculator.mjs` |
| E2 | `ad-hoarding` apply still completes BOC workflow | ✅ | `hoarding-boc-e2e-smoke.mjs` |
| E3 | LED slot booking confirm + PDF via bookings engine | ✅ | `smoke-ad-led-booking.mjs`, combined smoke |
| E4 | Citizen books ambulance slot E2E with confirmation PDF | ✅ | `smoke-health-fleet-booking.mjs` |
| E5 | Emergency ambulance confirms with ₹0 + audit metadata | ✅ | `bookings.service.ts` + `booking-reservation-note.util.spec.ts` |
| E6 | Hearse fleet-pool slot booking with stub pay | ✅ | `smoke-health-fleet-booking.mjs` |
| E7 | `master-sprint-85.spec.ts` green + 81/82 specs green | ✅ | `pnpm test:security` |
| E8 | Partial Phase 8 exit doc lists delivered vs deferred | ✅ | `phase-8-partial-exit.md` |
| E9 | Operator help updated for advertising + health ops | ✅ | `operator-help-admin-tenant.html` § advertising-health-ops |
| E10 | `graphify update .` after API/UI code changes | ✅ | Agent rule |

---

## 8.5G — Hardening

| ID | Deliverable | Evidence |
| -- | ----------- | -------- |
| G1 | Security spec tenant isolation | `tests/security/master-sprint-85.spec.ts` |
| G2 | Perf / abuse caps | `hoarding-quote-rate-limit.ts` (60/hr), `MAX_SLOT_RANGE_DAYS=90`, `MAX_HOARDING_MATRIX_ROWS=200`, emergency 2/day |
| G3 | Combined smoke | `scripts/smoke-sprint-85-adv-health.mjs` |
| G4 | Phase 8 partial exit | `phase-8-partial-exit.md` |
| G5 | ROADMAP update | `ROADMAP.md` — 8.5 closed |
| G6 | Native mobile decision | **PWA-only** for 8.5 citizen surfaces (hoarding calc, LED, health fleet, My Bookings). Native mobile screens deferred post-8.5 unless sponsor unpause. |

---

## 8.5H — Docs & verification

| ID | Deliverable | Evidence |
| -- | ----------- | -------- |
| H1 | Exit runbook | This file |
| H2 | API unit tests | Hoarding: `hoarding-rate.util.spec.ts`, `advertising.service.spec.ts`; LED: `smoke-ad-led-booking.mjs`; health: `bookings-citizen-list.service.spec.ts`, `booking-reservation-note.util.spec.ts`, fleet overlap in `bookings.service.ts` |
| H3 | Smoke regression matrix | Combined `smoke-sprint-85-adv-health.mjs`; retain `hoarding-boc-e2e-smoke.mjs`, `smoke-sprint-82-smart-city.mjs` |
| H4 | Operator help | `docs/help/operator-help-admin-tenant.html` + admin-tenant public copy |
| H5 | Sahayak seeds | `sahayak-service-help.seed.ts` — ambulance emergency + hearse BPL notes |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- hoarding advertising bookings-time hoarding-quote
pnpm test:security -- master-sprint-85.spec.ts
pnpm test:security -- master-sprint-82.spec.ts
pnpm test:security -- master-sprint-81a.spec.ts master-sprint-81b.spec.ts master-sprint-81c.spec.ts master-sprint-81d.spec.ts master-sprint-81e.spec.ts master-sprint-81f.spec.ts
node scripts/smoke-sprint-85-adv-health.mjs
graphify update .
```

---

## Manual smoke sign-off

1. **Hoarding:** Ward 12, 10×8 ft, 3 months → quote → apply `ad-hoarding` → desk BOC.
2. **LED:** Pick board → slot → deferred submit → desk approval → pay → PDF.
3. **Ambulance (paid):** Pooled slot → pickup address → pay → PDF (no vehicle name).
4. **Ambulance (emergency):** Declare emergency → ₹0 confirm → audit in admin calendar.
5. **Hearse:** Fleet pool book → pay → PDF.
6. **My Bookings:** Applications / Bookings → list + receipt download.
7. **Admin:** Dashboard Booking Summary shows hall, LED, ambulance, hearse.
8. **Regression:** `smoke-sprint-82-smart-city.mjs` green.

---

## Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | |
| Product | | | Manual §1–§8 |

---

_Last updated: 2026-06-19_
