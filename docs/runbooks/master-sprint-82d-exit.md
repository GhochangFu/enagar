# Master Sprint 8.2D Exit — EV charging slots & kWh metering (stub)

**Status:** **8.2D-A closed in-repo (2026-06-18)** — schema, adapter, catalogue, seed, payment-store types · **8.2D-B closed in-repo (2026-06-18)** — API core + smoke green · **8.2D-C closed in-repo (2026-06-18)** — Citizen PWA · **8.2D-D next**  
**Plan:** [`master-sprint-82d-plan.md`](./master-sprint-82d-plan.md) · Parent: [`master-sprint-82-plan.md`](./master-sprint-82-plan.md) § 8.2D  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23)

---

## Deliverables

| ID  | Deliverable                                                                                                                   | Evidence                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | `ev_chargers` table — per tenant `code`, `name`, `location`, `connector_type`, `max_kw`, `rate_paise_per_kwh`, `is_active`    | `20260618120000_sprint_82d_ev_charging_schema` · `EvCharger` model          |
| D2  | `ev_sessions` table — `charger_id`, `citizen_id`, status enum, timestamps, `kwh_consumed`, `amount_paise`, `payment_id?`      | same migration · `EvSession` model + partial unique indexes                 |
| D3  | `StubEvMeterProvider` — `readMeter(sessionId) → kWh`; fixed increment on stop                                                 | `packages/smart-city-adapters` · package test green                         |
| D4  | Citizen API — `GET …/chargers`, `POST …/chargers/:code/holds`, `POST …/sessions/:id/start`, `stop`, `initiate-payment`, `pay` | `apps/api/src/modules/ev-charging/` · `scripts/smoke-ev-charging.mjs` green |
| D5  | Citizen PWA `EvChargingWorkspace` — list → hold (15 min) → start → stop → pay → receipt metadata                              | `ev-charging-workspace.tsx` · `ev-charging-api.ts` · typecheck green        |
| D6  | Admin — CRUD chargers under Operations → EV Charging; read-only session list                                                  | _8.2D-D_                                                                    |
| D7  | Seed — 2 KMC chargers, `rate_paise_per_kwh: 1500`                                                                             | `prisma/seed/ev-charging.ts` · seed log                                     |
| —   | Catalogue — `ev-charging` service + `ev-charging-fee` revenue head                                                            | `service-catalogue.seed.ts`                                                 |
| —   | Payment FK — `payments.ev_session_id`                                                                                         | migration + `payment-store.ts` types + store impl                           |

---

## Sub-sprint closure checklist

| Sub-sprint | Scope                                     | Done | Notes                                  |
| ---------- | ----------------------------------------- | ---- | -------------------------------------- |
| **8.2D-A** | Schema, catalogue, adapter, seed          | ✅   | 2026-06-18                             |
| **8.2D-B** | API service + controllers + payment store | ✅   | 2026-06-18 — 15 unit tests + smoke E2E |
| **8.2D-C** | Citizen PWA workspace                     | ✅   | 2026-06-18 — `pnpm typecheck` clean    |
| **8.2D-D** | Admin operations panel                    | ☐    |                                        |
| **8.2D-E** | Smoke, security, parent plan update       | ☐    |                                        |

---

## Exit criteria

| ID  | Criterion                                                                                    | Pass | Verification                                 |
| --- | -------------------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| E1  | Citizen sees charger list; busy chargers not reservable                                      | ✅   | PWA workspace disables busy chargers         |
| E2  | EV session **hold → start → stop → pay** E2E with stub meter                                 | ✅   | `scripts/smoke-ev-charging.mjs` (2026-06-18) |
| E3  | Stop computes **kWh × rate** correctly (default stub: 5.5 kWh @ 1500 paise = **8250 paise**) | ✅   | Unit test + smoke assert                     |
| E4  | Hold TTL (**15 min**) releases charger                                                       | ✅   | Unit test `releaseExpiredEvSessionHolds`     |
| E5  | One active session per citizen (overlap guard)                                               | ✅   | API spec 409                                 |
| E6  | Tenant Admin can **create/edit** charger; sessions visible read-only                         | ☐    | Manual Operations                            |
| E7  | **Tenant isolation** — cross-tenant charger/session access rejected                          | ☐    | Security spec                                |
| E8  | Smart parking regression unchanged                                                           | ☐    | `scripts/smoke-smart-parking-bay-merge.mjs`  |
| E9  | Typecheck clean (api, citizen-pwa, admin-tenant)                                             | ☐    | citizen-pwa ✅ 2026-06-18                    |

---

## Verification commands

Run from repo root after API is up (`pnpm --filter @enagar/api dev` or smoke env):

```bash
# Unit tests
cd apps/api && pnpm test -- ev-charging
cd packages/smart-city-adapters && pnpm test

# E2E smoke
node scripts/smoke-ev-charging.mjs

# Regression
node scripts/smoke-smart-parking-bay-merge.mjs

# Security (when spec lands)
pnpm test:security -- master-sprint-82d-ev-charging.spec.ts

# Typecheck
cd apps/citizen-pwa && pnpm typecheck
cd apps/admin-tenant && pnpm typecheck
```

### Smoke environment

| Variable                | Default                     | Purpose              |
| ----------------------- | --------------------------- | -------------------- |
| `API_BASE`              | `http://localhost:3001/api` | API root             |
| `SMOKE_MOBILE`          | `9876543210`                | KMC citizen OTP user |
| `STUB_EV_KWH_INCREMENT` | `5.5`                       | Expected kWh on stop |

---

## Manual test script (citizen PWA)

1. Login `9876543210` / OTP `12345` → select **KMC**.
2. Open **Smart City** category → **EV Charging** service card.
3. Confirm two chargers listed with ₹15/kWh (1500 paise).
4. Reserve **CHG-MKT-01** → **Start charging** → **Stop**.
5. Verify amount **₹82.50** (8250 paise) for default stub.
6. Complete stub payment → confirm session complete.
7. Return to list — charger shows available.

## Manual test script (tenant admin)

1. Login tenant admin for KMC.
2. **Operations** → **EV Charging**.
3. Create charger `CHG-TEST-01` with rate 2000 paise/kWh.
4. Confirm appears in citizen list.
5. Set `is_active: false` → citizen list hides or marks unavailable.
6. Session table shows smoke / manual sessions.

---

## Bug fixes (closure pass)

| Issue                                                                         | Root cause                                                                                                  | Fix                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Stub complete 404 on `ev-charging` payment                                    | `getTenantService` requires published form version; `ev-charging` missing from `priorityServiceFormSchemas` | Added minimal EV form schema in `prisma/seed.ts`; re-seed catalogue |
| `payments_fee_code_check` / `payments_target_check` / `receipts_target_check` | EV session payments use new fee code and target                                                             | Migrations `20260618130000`–`20260618150000`                        |

---

## Deferred (not blocking 8.2D)

| Item                                | Notes                                  |
| ----------------------------------- | -------------------------------------- |
| Confirmation PDF                    | Reuse bookings PDF pattern in **8.2F** |
| OCPP / hardware                     | Out of scope per plan                  |
| Combined `master-sprint-82.spec.ts` | **8.2F** docs/tests slice              |
| Real-time SoC UI                    | Out of scope                           |

---

## Next slice

**8.2E** — IoT water meter prepaid recharge (stub) per [`master-sprint-82-plan.md`](./master-sprint-82-plan.md).

---

## Sign-off

| Role        | Notes                                    | Date  |
| ----------- | ---------------------------------------- | ----- |
| Engineering | _Repo closure; smoke + unit tests green_ | _TBD_ |
