# Phase 8 Partial Exit — Delivered vs deferred (EN-10)

**Status:** **partial exit after Sprint 8.5** (2026-06-19)  
**Parent:** Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) · [**Phase 8**](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules)  
**Active plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Exit: [`master-sprint-85-exit.md`](./master-sprint-85-exit.md)

---

## Purpose

Phase 8 **full** exit (including tenders and welfare pensions) is **not** complete after Sprint 8.5. This document records what is **delivered in-repo** vs **explicitly deferred** so EN-10 closure is not misread.

---

## Delivered slices (evidence links)

| Slice | Scope | Exit record |
| ----- | ----- | ----------- |
| 8.1 | Bookings calendar + deposit + PDF | [`master-sprint-81-exit.md`](./master-sprint-81-exit.md) |
| 8.2 | Smart parking, EV charging, IoT water (stub) | [`master-sprint-82-exit.md`](./master-sprint-82-exit.md) |
| 8.5A | Hoarding rate matrix + admin API | [`master-sprint-85a-exit.md`](./master-sprint-85a-exit.md) |
| 8.5B | Citizen hoarding calculator | [`master-sprint-85b-exit.md`](./master-sprint-85b-exit.md) |
| 8.5C | LED deferred booking | [`master-sprint-85c-exit.md`](./master-sprint-85c-exit.md) |
| 8.5E–F | Health fleet (ambulance + hearse) | [`master-sprint-85e-exit.md`](./master-sprint-85e-exit.md), [`master-sprint-85f-exit.md`](./master-sprint-85f-exit.md) |
| 8.5F2 | Bookings portfolio + formatted receipts | [`master-sprint-85f2-exit.md`](./master-sprint-85f2-exit.md) |
| 8.5G–H | Hardening, security, smokes, operator help | [`master-sprint-85-exit.md`](./master-sprint-85-exit.md) |

---

## Deferred slices (held plans)

| Held plan | Deferred scope | Revisit when |
| --------- | -------------- | ------------ |
| [`master-sprint-83-plan.md`](./master-sprint-83-plan.md) | Tenders catalogue, form purchase, **EMD**, vendor empanelment, deposit refund, scrap sale | Sponsor unpause procurement slice |
| [`master-sprint-84-plan.md`](./master-sprint-84-plan.md) | Old-age / widow / disability **pension** + disbursement CSV | Sponsor unpause welfare slice |
| _8.5 product deferrals_ | `ad-billboard` PWA (8.5D), **crematorium** booking | See [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § Scope refinement |
| _Native mobile_ | Dedicated mobile screens for adv/health | PWA-only sign-off in 8.5G G6; revisit if sponsor unpause |

---

## ROADMAP exit criteria mapping

| Criterion | Status after 8.5 | Notes |
| --------- | ---------------- | ----- |
| Community hall book + PDF + anti-double-book | ✅ 8.1 | |
| Smart parking E2E stub sensor | ✅ 8.2 | |
| Hoarding calculator + BOC regression | ✅ 8.5A–B | Quote rate limit 60/hr citizen |
| LED slot booking + deferred approval pay | ✅ 8.5C | |
| Health booking E2E + emergency path | ✅ 8.5E–F | Ambulance + hearse fleet pool; crematorium deferred |
| My Bookings + formatted receipt PDF | ✅ 8.5F2 | Citizen portfolio; not in My Applications |
| Admin Booking Summary (all types) | ✅ 8.5F2 | Dashboard section |
| Tenant isolation security spec | ✅ 8.5G | `master-sprint-85.spec.ts` |
| Tender list ≥ 5 + form + EMD | ⏸ held 8.3 | |
| Pension disbursement status | ⏸ held 8.4 | |

---

## Smoke regression matrix (8.5H)

| Script | Purpose |
| ------ | ------- |
| `scripts/smoke-sprint-85-adv-health.mjs` | Combined 8.5 orchestrator |
| `scripts/smoke/hoarding-boc-e2e-smoke.mjs` | Hoarding BOC regression |
| `scripts/smoke/smoke-hoarding-calculator.mjs` | Citizen quote |
| `scripts/smoke/smoke-ad-led-booking.mjs` | LED deferred booking |
| `scripts/smoke/smoke-health-fleet-booking.mjs` | Ambulance + hearse |
| `scripts/smoke/smoke-citizen-my-bookings.mjs` | My Bookings + PDF |
| `scripts/smoke-sprint-82-smart-city.mjs` | 8.2 regression leg |

---

## Sign-off

| Role | Notes | Date |
| ---- | ----- | ---- |
| Engineering | Sprint 8.5 closed in-repo; EN-10 partial | 2026-06-19 |

---

_Last updated: 2026-06-19_
