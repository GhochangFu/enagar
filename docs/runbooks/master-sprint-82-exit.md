# Master Sprint 8.2 Exit — Smart parking, EV charging & IoT water meter (stub adapters)

**Status:** **closed in-repo (2026-06-18)** — engineering evidence green  
**Plan:** [`master-sprint-82-plan.md`](./master-sprint-82-plan.md) · Jira [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23)  
**Phase:** 8 — Bookings, Smart-City & Tenders · Parent [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)

---

## Sub-sprint closure

| Sub-sprint | Scope                                   | Exit record                                                |
| ---------- | --------------------------------------- | ---------------------------------------------------------- |
| 8.2A       | Smart-zone schema & sensor adapter      | plan § 8.2A                                                |
| 8.2B       | Zone × time pricing evaluator           | plan § 8.2B                                                |
| 8.2C       | Smart parking reserve-and-pay           | [`master-sprint-82c-exit.md`](./master-sprint-82c-exit.md) |
| 8.2D       | EV charging slots & kWh metering (stub) | [`master-sprint-82d-exit.md`](./master-sprint-82d-exit.md) |
| 8.2E       | IoT water meter prepaid recharge (stub) | [`master-sprint-82e-exit.md`](./master-sprint-82e-exit.md) |
| 8.2F       | Docs, tests, verification               | this document                                              |

---

## Exit criteria (Sprint 8.2 full scope)

| ID  | Criterion                                                      | Pass | Verification                                             |
| --- | -------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| E1  | Citizen sees parking bay grid; occupied bays not selectable    | ✅   | PWA + `smart-parking` unit tests                         |
| E2  | Smart parking reserve-and-pay E2E with stub sensor             | ✅   | `smoke-sprint-82-smart-city.mjs` parking leg             |
| E3  | Zone × time quote differs by time band                         | ✅   | `smart-pricing.util.spec.ts`                             |
| E4  | EV session reserve → start → stop → kWh × rate payment settles | ✅   | `smoke-sprint-82-smart-city.mjs` EV leg                  |
| E5  | Water meter lookup → recharge → balance increases              | ✅   | `smoke-sprint-82-smart-city.mjs` water leg               |
| E6  | Tenant Admin can configure zone, charger, and meter accounts   | ✅\* | Operations panels; tenant-admin manual smoke optional    |
| E7  | Combined security contract green                               | ✅   | `master-sprint-82.spec.ts`                               |
| E8  | No regression on Sprint 8.1 bookings                           | ✅   | `master-sprint-81a`–`81f` security specs 19/19 pass      |
| E9  | Operator help documents smart-city ops                         | ✅   | `docs/help/operator-help-admin-tenant.html` § Smart city |

---

## 8.2F deliverables

| ID  | Deliverable           | Evidence                                                             |
| --- | --------------------- | -------------------------------------------------------------------- |
| F1  | Exit runbook          | this file                                                            |
| F2  | Security contract     | `tests/security/master-sprint-82.spec.ts`                            |
| F3  | API unit tests        | `smart-parking`, `smart-pricing`, `ev-charging`, `water-meter` specs |
| F4  | Combined smoke script | `scripts/smoke-sprint-82-smart-city.mjs`                             |
| F5  | Operator help         | `docs/help/operator-help-admin-tenant.html` § Smart city services    |
| F6  | ROADMAP queue row     | `ROADMAP.md` Sprint **8.2** closed line                              |

---

## Verification commands

Run from repo root with API on `localhost:3001` and Postgres seeded:

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api db:seed
pnpm --filter @enagar/smart-city-adapters test
pnpm --filter @enagar/api test -- smart-parking
pnpm --filter @enagar/api test -- ev-charging
pnpm --filter @enagar/api test -- water-meter
pnpm --filter @enagar/citizen-pwa typecheck
pnpm test:security -- master-sprint-82.spec.ts
pnpm test:security -- master-sprint-81a.spec.ts master-sprint-81b.spec.ts master-sprint-81c.spec.ts master-sprint-81d.spec.ts master-sprint-81e.spec.ts master-sprint-81f.spec.ts
node scripts/smoke-sprint-82-smart-city.mjs
graphify update .
```

### Verification evidence (2026-06-18)

| Check                                             | Result | Notes                                     |
| ------------------------------------------------- | ------ | ----------------------------------------- |
| `pnpm --filter @enagar/smart-city-adapters test`  | ✅     | sensor + EV + water stub providers        |
| `pnpm --filter @enagar/api test -- smart-parking` | ✅     | 19/19 pass                                |
| `pnpm --filter @enagar/api test -- ev-charging`   | ✅     | 15/15 pass                                |
| `pnpm --filter @enagar/api test -- water-meter`   | ✅     | 4/4 pass                                  |
| `pnpm test:security -- master-sprint-82.spec.ts`  | ✅     | 9/9 pass                                  |
| `node scripts/smoke-sprint-82-smart-city.mjs`     | ✅     | parking + EV + water legs green           |
| Individual smokes (parking / EV / water)          | ✅     | passed 2026-06-18 per slice exit runbooks |

---

## Manual smoke sign-off

1. **Tenant Admin:** Operations → Smart Parking (zone/bay grid), EV Charging (charger CRUD), IoT Water (meter import/ledger).
2. **Citizen PWA — Smart Parking:** zone occupancy → free bay → quote → stub pay → confirm → bay taken.
3. **Citizen PWA — EV:** charger → hold → start → stop → pay → receipt metadata.
4. **Citizen PWA — Water:** `WM-001` lookup → ₹500 recharge → balance bump.
5. **Regression:** Community hall hourly booking (8.1) still works.

---

## Deferred (out of Sprint 8.2 scope)

| Item                                  | Notes                      |
| ------------------------------------- | -------------------------- |
| Real Modbus/MQTT/OCPP/live meter SOAP | Phase 12 pilot / ADR-0010  |
| Parking confirmation PDF              | reuse bookings PDF pattern |
| Live payment gateway                  | Sprint 3.1B deferred       |
| Native mobile smart-city screens      | PWA only for v1            |

---

## Sign-off

| Role        | Notes                                                               | Date       |
| ----------- | ------------------------------------------------------------------- | ---------- |
| Engineering | 8.2F docs/tests/verification slice; combined smoke + security green | 2026-06-18 |

**Next active slice:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) (8.3/8.4 held).
