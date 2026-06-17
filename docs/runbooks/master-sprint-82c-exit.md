# Master Sprint 8.2C Exit — Smart parking reserve-and-pay

**Status: closed — engineering (repo)** · **2026-06-17**  
**Plan:** [`master-sprint-82-plan.md`](./master-sprint-82-plan.md) § 8.2C  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23)

## Deliverables

| ID  | Deliverable                                                | Evidence                                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| C1  | `POST /citizen/smart-parking/holds` — bay lock, 10 min TTL | `SmartParkingService.createHoldForCitizen`, transactional `updateMany` on bay  |
| C2  | `POST …/holds/:id/confirm` after settled payment           | `confirmHoldForCitizen`, per-bay `bookable_assets`, `booking_no` `SPARK/…`     |
| C3  | `GET …/zones` — aggregate free/total                       | `listZonesForCitizen` + `mergeParkingBayStatuses`                              |
| C4  | `GET …/zones/:code/bays` — per-bay grid                    | `listZoneBaysForCitizen`                                                       |
| C5  | Citizen PWA `SmartParkingWorkspace`                        | Zone picker, bay grid, duration (1–3 hr), vehicle reg, quote, reserve-and-pay  |
| C6  | Tenant Admin occupancy view                                | `GET …/zones/:code/bays/effective`, `SmartParkingOpsPanel` live grid + refresh |

## Bug fixes (closure pass)

| Issue                                     | Root cause                                         | Fix                                                                                              |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Bay not grey after confirm                | Stub sensor overwrote DB `OCCUPIED`                | `smart-parking-bay-status.util.ts` — restrictive merge                                           |
| Zone counts inconsistent on re-entry      | Same sensor overwrite                              | Merge on list zones/bays + reload after confirm                                                  |
| No vehicle registration                   | UI never collected field                           | Required `vehicle_number` on DTO + workspace input                                               |
| Multiple slots per vehicle (double-click) | No citizen/vehicle overlap guard; race on bay lock | `assertNoConflictingSmartParkingReservation`, transactional bay `updateMany`, UI `submittingRef` |
| Stale `RESERVED` bays                     | No hold expiry cleanup                             | `releaseExpiredSmartParkingHolds` on list/hold paths                                             |

## Exit criteria (8.2C scope)

| ID  | Criterion                                                   | Pass | Verification                                         |
| --- | ----------------------------------------------------------- | ---- | ---------------------------------------------------- |
| E1  | Occupied bays not selectable                                | ✅   | PWA grid + API merge tests                           |
| E2  | Reserve-and-pay E2E with stub sensor                        | ✅   | `scripts/smoke-smart-parking-bay-merge.mjs`          |
| E3  | Vehicle registration required                               | ✅   | DTO validation + smoke 400 without vehicle           |
| E4  | One active reservation per vehicle/citizen (overlap window) | ✅   | Smoke 409 on second hold                             |
| E5  | Hold TTL releases bay                                       | ✅   | `releaseExpiredSmartParkingHolds` unit + integration |
| E6  | Admin merged occupancy grid                                 | ✅   | `GET …/bays/effective` + Operations panel            |

## Verification commands

```bash
cd apps/api && pnpm test -- smart-parking
node scripts/smoke-smart-parking-bay-merge.mjs
cd apps/citizen-pwa && pnpm typecheck
```

## Deferred (not blocking 8.2C)

| Item                         | Notes                      |
| ---------------------------- | -------------------------- |
| Confirmation PDF for parking | Reuse bookings PDF in 8.2F |
| ANPR / plate OCR             | Out of scope per plan      |
| In-session bay extension     | Manual re-book in v1       |

## Next slice

**8.2D** — EV charging slots & kWh metering (stub) per [`master-sprint-82-plan.md`](./master-sprint-82-plan.md).

## Sign-off

| Role        | Notes                                  | Date           |
| ----------- | -------------------------------------- | -------------- |
| Engineering | Repo closure; smoke + unit tests green | **2026-06-17** |
