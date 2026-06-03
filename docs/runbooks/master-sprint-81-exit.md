# Master Sprint 8.1 Exit — Bookings calendar, hourly slots & deposit linkage

**Status: closed — engineering (repo)** · **2026-06-03**  
**Plan:** [`master-sprint-81-plan.md`](./master-sprint-81-plan.md)  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira parent [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) · Sprint [**EN-15**](https://ghochangfu.atlassian.net/browse/EN-15)

## Sub-sprint closure (8.1A–8.1F)

| Slice    | Scope                                              | Evidence                                                                                                |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **8.1A** | Schema, GiST overlap, `assertBookableWindow`, seed | `20260603120000_sprint_81a_*`, `bookings.db.spec.ts`, `master-sprint-81a.spec.ts`                       |
| **8.1B** | Public slots + citizen hold/quote/confirm/cancel   | `BookingsModule`, `master-sprint-81b.spec.ts`                                                           |
| **8.1C** | Deposit + stub pay before `confirmed`              | `initiate-payment`, `completeBookingStubPayment`, `master-sprint-81c.spec.ts`                           |
| **8.1D** | Confirmation PDF                                   | `GET /citizen/bookings/:ref/confirmation.pdf`, `master-sprint-81d.spec.ts`                              |
| **8.1E** | Citizen hour grid + admin calendar + deep link     | `BookingWorkspace`, `BookingHourGrid`, `BookingsCalendarPanel` (day-hours), `master-sprint-81e.spec.ts` |
| **8.1F** | Hold ↔ application + desk confirm/reject sync      | `linkApplicationToHold`, `syncDeskWorkflowToReservation`, `master-sprint-81f.spec.ts`                   |

### Slot algorithm (8.1B)

1. Clip `available` windows to `[from, to]`.
2. Subtract `blackout` ranges.
3. Split remainder into `slot_step_minutes` steps (default 60).
4. Mark each step `taken` if it overlaps any `hold` / `confirmed` reservation; else `free`.
5. Hold TTL: **15 minutes** (`hold_expires_at` in reservation `note` JSON).

### Product extras (same sprint)

| Item                         | Notes                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Service ↔ asset mapping      | `bookable_asset_codes` on tenant service config; Service Designer mapping panel                                        |
| KMC `other-facility-booking` | Sports assets split from `community-hall`; `scripts/provision-other-facility-booking.ps1`                              |
| Desk booking workflow        | Hall template: submitted → review-slot → confirmed/rejected; slot freed on reject                                      |
| Operator manual              | Bookings + form validation/conditions — `docs/help/operator-help-admin-tenant.html`                                    |
| UI smoke                     | [`smoke-81-ui-smoke.md`](./smoke-81-ui-smoke.md) — desk loop pass; citizen hub automation flaky (deep link documented) |

## Exit criteria

| ID  | Criterion                                           | Pass | Evidence                                                                                                  |
| --- | --------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| E1  | Citizen hour grid; taken hours not selectable       | ✅   | `BookingHourGrid`, `master-sprint-81e.spec.ts`                                                            |
| E2  | End-to-end free hourly slot booking                 | ✅   | API/scripts + desk smoke; citizen UI via deep link `?tenant=KMC&service=…&book=1`                         |
| E3  | Overlapping hour rejected                           | ✅   | DB GiST + API tests (`master-sprint-81a` / `81b`)                                                         |
| E4  | Inside `available` window enforced                  | ✅   | `assertBookableWindow`, `bookings.db.spec.ts`                                                             |
| E5  | Deposit stub-captured before `confirmed`            | ✅   | `master-sprint-81c.spec.ts`                                                                               |
| E6  | Confirmation PDF                                    | ✅   | `master-sprint-81d.spec.ts`                                                                               |
| E7  | Tenant Admin calendar shows booking on correct hour | ✅   | `BookingsCalendarPanel` day-hours view (IST)                                                              |
| E8  | Unified `master-sprint-81.spec.ts`                  | ⚠️   | **Deferred** — slice specs `master-sprint-81a` … `81f` green via `pnpm test:security -- master-sprint-81` |
| E9  | No regression 611 / apply                           | ✅   | `master-sprint-611.spec.ts` unchanged; booking path additive                                              |

## Deferred (8.1G — do not block 8.1 closure)

| Item                                    | Notes                                               |
| --------------------------------------- | --------------------------------------------------- |
| `scripts/smoke-sprint-81-bookings.mjs`  | Single scripted E2E smoke — backlog                 |
| Unified `master-sprint-81.spec.ts`      | Consolidate a–f contracts                           |
| FullCalendar / React Big Calendar       | Admin uses custom day-hour grid (acceptable for v1) |
| Citizen hub automation in agent-browser | Use booking deep link for QA                        |

## Phase gate

**Pass** — Sprint **8.1** closed in-repo. Jira [**EN-15**](https://ghochangfu.atlassian.net/browse/EN-15) → **Done**. **Next slice:** Sprint **8.2** (smart parking / EV / IoT stubs) per [`ROADMAP.md`](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules).

## Sign-off

| Role          | Notes                              | Date           |
| ------------- | ---------------------------------- | -------------- |
| Engineering   | Repo closure; CI contracts 81a–81f | **2026-06-03** |
| Product owner | _(optional)_                       |                |
