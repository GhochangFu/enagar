# Master Sprint 8.2E Exit — IoT water meter prepaid recharge (stub)

**Status:** implemented in-repo — automated checks and local smokes green  
**Plan:** `master-sprint-82-plan.md` § 8.2E · Parent: `master-sprint-82-plan.md`  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira EN-23

---

## Deliverables

| ID  | Deliverable                                                                                                  | Evidence                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| E1  | `water_meter_accounts` table with tenant-scoped `meter_id`, consumer identity, balance, and reading metadata | `schema.prisma` · migration `20260618170000_sprint_82e_water_meter_recharge_schema`     |
| E2  | `water_meter_recharges` ledger with payment linkage, status, and balance-after metadata                      | same migration · `WaterMeterRecharge` model                                             |
| E3  | `StubWaterMeterProvider` with deterministic lookup and recharge behavior                                     | `packages/smart-city-adapters` test pass                                                |
| E4  | Citizen API: lookup meter and initiate prepaid recharge                                                      | `apps/api/src/modules/water-meter` · unit tests pass                                    |
| E5  | Citizen PWA: meter ID lookup → balance → amount presets/custom → stub pay → refreshed balance                | `water-meter-recharge-workspace.tsx` · citizen typecheck pass                           |
| E6  | Tenant Admin: meter account upsert/import and read-only recharge ledger                                      | `water-meter-ops-panel.tsx` · admin typecheck blocked by unrelated rental-assets errors |
| E7  | KMC seed: 3 demo meters linked to pilot citizen phones                                                       | seed log: `Seeded Sprint 8.2E KMC IoT water meter pilot accounts`                       |

---

## Sub-sprint closure checklist

| Sub-sprint | Scope                                   | Done | Notes                                                                    |
| ---------- | --------------------------------------- | ---- | ------------------------------------------------------------------------ |
| 8.2E-A     | Schema, migration, seed foundation      | ✅   | migrate deploy + seed pass                                               |
| 8.2E-B     | Adapter and domain service core         | ✅   | adapter tests + API tests pass                                           |
| 8.2E-C     | Citizen API and payment orchestration   | ✅   | water-meter unit tests pass                                              |
| 8.2E-D     | Citizen PWA and Tenant Admin ops        | ✅\* | PWA typecheck pass; admin typecheck has unrelated rental-assets blockers |
| 8.2E-E     | Smoke, security, docs, closure evidence | ✅   | security + water/EV smokes pass                                          |

---

## Exit criteria

| ID  | Criterion                                                      | Pass | Verification                                                   |
| --- | -------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| E1  | KMC seed creates 3 active water meter accounts                 | ✅   | `pnpm --filter @enagar/api db:seed`                            |
| E2  | Authorized citizen can lookup meter balance and last reading   | ✅   | `pnpm --filter @enagar/api test -- water-meter`                |
| E3  | Mismatched phone cannot lookup or recharge another meter       | ✅   | unit test + `master-sprint-82e-water-meter.spec.ts`            |
| E4  | Recharge settlement credits balance exactly once               | ✅   | `PostgresPaymentStore.settleStubLedger` + security contract    |
| E5  | Stub payment produces receipt metadata for `iot-water`         | ✅   | `smoke-water-meter-recharge.mjs` — stub settle credits balance |
| E6  | Tenant Admin can import/upsert meters and view recharge ledger | ⚠️   | code complete; manual admin smoke pending                      |
| E7  | EV charging and smart parking regressions remain clean         | ✅   | `smoke-ev-charging.mjs` pass                                   |

---

## Verification commands

Run from repo root after API dependencies are installed and DB is available:

```bash
pnpm --filter @enagar/api prisma:validate
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api db:seed
pnpm --filter @enagar/smart-city-adapters test
pnpm --filter @enagar/api test -- water-meter
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke-water-meter-recharge.mjs
node scripts/smoke-ev-charging.mjs
graphify update .
```

### Verification evidence (2026-06-18)

| Check                                                                              | Result | Notes                                                            |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `pnpm --filter @enagar/api prisma:validate`                                        | ✅     | schema valid                                                     |
| `pnpm --filter @enagar/api prisma:generate`                                        | ✅     | client generated                                                 |
| `pnpm --filter @enagar/api prisma:migrate:deploy`                                  | ✅     | applied `20260618170000_sprint_82e_water_meter_recharge_schema`  |
| `pnpm --filter @enagar/api db:seed`                                                | ✅     | seed log includes 8.2E KMC meter accounts                        |
| `pnpm --filter @enagar/smart-city-adapters test`                                   | ✅     | 4/4 tests pass                                                   |
| `pnpm --filter @enagar/api test -- water-meter`                                    | ✅     | water-meter service tests pass                                   |
| `pnpm --filter @enagar/api typecheck`                                              | ✅     | clean                                                            |
| `pnpm --filter @enagar/citizen-pwa typecheck`                                      | ✅     | clean                                                            |
| `pnpm test:security -- master-sprint-82e-water-meter.spec.ts`                      | ✅     | 4/4 tests pass                                                   |
| `pnpm --filter @enagar/admin-tenant typecheck`                                     | ⚠️     | blocked by pre-existing `rental-assets` TS errors, not IoT Water |
| `node scripts/smoke-water-meter-recharge.mjs`                                      | ✅     | `WM-001` balance `12500 → 62500` after ₹500 stub recharge        |
| `node scripts/smoke-ev-charging.mjs`                                               | ✅     | EV hold → start → stop → pay regression clean                    |
| Adapter `.js` shim fix (`water-meter-provider.js`, `stub-water-meter.provider.js`) | ✅     | unblocked API startup (`ERR_MODULE_NOT_FOUND` resolved)          |

### Smoke environment

| Variable                     | Default                     | Purpose              |
| ---------------------------- | --------------------------- | -------------------- |
| `API_BASE`                   | `http://localhost:3001/api` | API root             |
| `SMOKE_MOBILE`               | `9876543210`                | KMC citizen OTP user |
| `SMOKE_WATER_METER_ID`       | `WM-001`                    | Demo water meter     |
| `SMOKE_WATER_RECHARGE_PAISE` | `50000`                     | Default ₹500 credit  |

---

## Manual test script (citizen PWA)

1. Login `9876543210` / OTP `12345` → select KMC.
2. Open Water & Sanitation → IoT Water Recharge.
3. Enter `WM-001` → confirm balance and last reading display.
4. Select ₹500 preset or custom amount → Pay and recharge.
5. Confirm success message and balance increases by the exact recharge amount.
6. Open Payments → receipt metadata is available for the settled payment.

## Manual test script (tenant admin)

1. Login tenant admin for KMC.
2. Operations → IoT Water.
3. Create or import meter `WM-TEST-01` with phone `9876543210`.
4. Confirm the meter appears in the account list.
5. Complete a citizen recharge and refresh the ledger.
6. Confirm ledger row status is `CREDITED`, with payment id and balance-after value.

---

## Deferred

| Item                            | Notes                                  |
| ------------------------------- | -------------------------------------- |
| Live HMC/SAP/SOAP meter adapter | Deferred to ADR-0010 / later smart IoT |
| Postpaid billing cycle          | Out of scope for 8.2E                  |
| Low-balance push/SMS alerts     | Out of scope for 8.2E                  |

---

## Sign-off

| Role        | Notes                                                               | Date       |
| ----------- | ------------------------------------------------------------------- | ---------- |
| Engineering | Automated + smoke evidence green; tenant-admin manual smoke pending | 2026-06-18 |
