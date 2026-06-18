# Master Sprint 8.2D Implementation Plan — EV charging slots & kWh metering (stub)

> **For implementers:** Execute sub-sprints **in order** (D-A → D-B → D-C → D-D → D-E). Do not start citizen UI before API smoke passes. Mirror [`SmartParkingModule`](../../apps/api/src/modules/smart-parking/) patterns unless noted below. Exit evidence goes in [`master-sprint-82d-exit.md`](./master-sprint-82d-exit.md).

**Goal:** Citizen can reserve an EV charger, start/stop a stub-metered session, pay kWh × rate, and receive receipt metadata; tenant admin can CRUD chargers and view sessions.

**Parent plan:** [`master-sprint-82-plan.md`](./master-sprint-82-plan.md) § 8.2D · Jira [**EN-23**](https://ghochangfu.atlassian.net/browse/EN-23)

**Builds on:** 8.2A–8.2C (smart parking module, `@enagar/smart-city-adapters`, stub payments, Operations shell).

**Status:** **8.2D-A closed in-repo (2026-06-18)** · **8.2D-B closed in-repo (2026-06-18)** · **8.2D-C closed in-repo (2026-06-18)** · **8.2D-D next**

---

## Architecture decisions (locked for 8.2D)

| Topic                | Decision                                                                                     | Rationale                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Module layout        | New `apps/api/src/modules/ev-charging/` (service + citizen + admin controllers)              | Parity with `smart-parking`; keeps smart-city slices isolated                             |
| Adapter package      | Extend `packages/smart-city-adapters` with `IEvMeterProvider` + `StubEvMeterProvider`        | Same home as `ISensorProvider`; no OCPP in v1                                             |
| Charger availability | **Derived** from `ev_sessions` (`HELD` unexpired + `CHARGING`); no per-charger status column | Simpler than parking bays; one connector = one active session                             |
| Hold TTL             | **15 minutes** (`EV_CHARGING_HOLD_TTL_MS = 15 * 60 * 1000`)                                  | Per master plan D5                                                                        |
| Stub kWh             | Fixed increment on `stop` (default **5.5 kWh**, override `STUB_EV_KWH_INCREMENT` env)        | Demo-friendly; `readMeter(sessionId)` returns accumulated kWh                             |
| Payment rail         | Reuse `PaymentStore` + stub gateway; add **`evSessionId`** FK on `payments`                  | Mirrors `bookingReservationId` / `leaseInvoiceId`; enables `findActivePaymentByEvSession` |
| Service catalogue    | Add **`ev-charging`** global service + **`ev-charging-fee`** revenue head                    | **Gap:** not in `service-catalogue.seed.ts` today despite master plan note                |
| Workflow pattern     | `tax-payment` (pay-after-consumption), `fee_type: computed`                                  | Per master plan service table                                                             |
| Citizen category     | `parking-transport` (same as smart parking)                                                  | Citizen nav `smart` category already lists transport services                             |
| Feature gate         | Respect `tenants.config.smart_city.ev_charging.enabled` (default **true** for KMC seed)      | `packages/types/src/tenant.ts` already defines the flag                                   |
| Amount math          | `amount_paise = Math.round(kwh_consumed * rate_paise_per_kwh)` using `Decimal` in DB         | Avoid float drift; round half-up at settlement                                            |

### Session state machine

```text
                    hold (15 min TTL)
   [no session] ──────────────────────► HELD ──start──► CHARGING
                        ▲                  │                │
                        │                  │ cancel/TTL     │ stop (stub meter)
                        │                  ▼                ▼
                        └──── CANCELLED ◄──┘         amount computed
                                                          │
                              initiate-payment + stub settle
                                                          ▼
                                                    pay/confirm ──► COMPLETED
```

**Rules:**

- At most **one** non-terminal session per charger (`HELD` | `CHARGING`).
- At most **one** active `HELD` or `CHARGING` session per citizen per tenant.
- `HELD` → `CHARGING` only by session owner; reject if hold expired.
- `CHARGING` → stop sets `ended_at`, `kwh_consumed`, `amount_paise`; status stays `CHARGING` until payment confirmed (or use intermediate `STOPPED` — **do not add**; keep plan enum: settle then `COMPLETED`).
- **Implementation note:** After `stop`, session remains `CHARGING` with `ended_at` set until payment; alternatively transition to a payable state. **Locked:** use `CHARGING` with `ended_at != null` meaning “awaiting payment”; `pay` → `COMPLETED`. Document in DTO responses as `status: 'awaiting_payment'` in API layer only if needed for UI clarity.

---

## File manifest (expected touch list)

### New — API

| File                                                                       | Responsibility            |
| -------------------------------------------------------------------------- | ------------------------- |
| `apps/api/prisma/migrations/…_sprint_82d_ev_charging_schema/migration.sql` | Tables + RLS + payment FK |
| `apps/api/prisma/seed/ev-charging.ts`                                      | KMC 2 chargers            |
| `apps/api/src/modules/ev-charging/ev-charging.module.ts`                   | Nest module               |
| `apps/api/src/modules/ev-charging/ev-charging.service.ts`                  | Core logic                |
| `apps/api/src/modules/ev-charging/ev-charging.service.spec.ts`             | Unit tests                |
| `apps/api/src/modules/ev-charging/citizen-ev-charging.controller.ts`       | Citizen routes            |
| `apps/api/src/modules/ev-charging/ev-charging-admin.controller.ts`         | Admin routes              |
| `apps/api/src/modules/ev-charging/dto/ev-charging.dto.ts`                  | Validation DTOs           |
| `apps/api/src/modules/ev-charging/ev-charging-hold.util.ts`                | Hold expiry helpers       |
| `apps/api/src/modules/ev-charging/ev-charging-hold.util.spec.ts`           | Hold util tests           |
| `apps/api/src/modules/ev-charging/ev-charging-amount.util.ts`              | kWh × rate math           |
| `apps/api/src/modules/ev-charging/ev-charging-amount.util.spec.ts`         | Amount tests              |

### New — adapters package

| File                                                                              | Responsibility               |
| --------------------------------------------------------------------------------- | ---------------------------- |
| `packages/smart-city-adapters/src/ev-meter-provider.ts`                           | `IEvMeterProvider` interface |
| `packages/smart-city-adapters/src/stub-ev-meter.provider.ts`                      | Stub implementation          |
| `packages/smart-city-adapters/src/stub-ev-meter.provider.spec.ts` or package test | Adapter unit tests           |

### Modified — API / shared

| File                                                       | Change                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/api/prisma/schema.prisma`                            | `EvCharger`, `EvSession`, `EvSessionStatus`, `Payment.evSessionId` |
| `apps/api/src/app.module.ts`                               | Import `EvChargingModule`                                          |
| `apps/api/src/modules/payments/payment-store.ts`           | `evSessionId`, `findActivePaymentByEvSession`                      |
| `apps/api/src/modules/payments/postgres-payment.store.ts`  | Persist + query `evSessionId`                                      |
| `apps/api/src/modules/payments/in-memory-payment.store.ts` | Same for tests                                                     |
| `apps/api/src/modules/services/service-catalogue.seed.ts`  | `ev-charging-fee` + `ev-charging` service                          |
| `apps/api/prisma/seed.ts`                                  | Call `seedEvChargingForKmc`                                        |
| `packages/smart-city-adapters/src/index.ts`                | Export EV meter types                                              |

### New — Citizen PWA

| File                                                    | Responsibility    |
| ------------------------------------------------------- | ----------------- |
| `apps/citizen-pwa/lib/ev-charging-api.ts`               | Fetch helpers     |
| `apps/citizen-pwa/components/ev-charging-workspace.tsx` | Full citizen flow |

### Modified — Citizen PWA

| File                            | Change                                  |
| ------------------------------- | --------------------------------------- |
| `apps/citizen-pwa/app/page.tsx` | Route `ev-charging` service → workspace |

### New — Admin tenant

| File                                                     | Responsibility      |
| -------------------------------------------------------- | ------------------- |
| `apps/admin-tenant/components/ev-charging-ops-panel.tsx` | CRUD + session list |

### Modified — Admin tenant

| File                                                               | Change            |
| ------------------------------------------------------------------ | ----------------- |
| `apps/admin-tenant/app/dashboard/operations/operations-client.tsx` | Tab `ev-charging` |

### New — verification

| File                                                   | Responsibility                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `scripts/smoke-ev-charging.mjs`                        | E2E API smoke                                                               |
| `tests/security/master-sprint-82d-ev-charging.spec.ts` | Tenant isolation (optional in 8.2D if time-boxed; **required** before exit) |

---

## API contract (citizen)

Base path: `/api/citizen/ev-charging` (global prefix as today). All routes require citizen JWT + optional `x-enagar-tenant-code`.

| Method | Path                             | Body / query                                  | Success                                                                                                      | Errors                                     |
| ------ | -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `GET`  | `/chargers?tenant_code=KMC`      | —                                             | `{ chargers: [{ code, name, location, connector_type, max_kw, rate_paise_per_kwh, is_active, available }] }` | 403 feature disabled                       |
| `POST` | `/chargers/:code/holds`          | `{ tenant_code }`                             | `{ session_id, charger_code, status: 'HELD', hold_expires_at }`                                              | 404 charger; 409 busy; 409 citizen overlap |
| `POST` | `/sessions/:id/start`            | `{ tenant_code }`                             | `{ session_id, status: 'CHARGING', started_at }`                                                             | 409 not HELD / expired                     |
| `POST` | `/sessions/:id/stop`             | `{ tenant_code }`                             | `{ session_id, kwh_consumed, amount_paise, rate_paise_per_kwh, status: 'awaiting_payment' }`                 | 409 not CHARGING                           |
| `POST` | `/sessions/:id/initiate-payment` | `{ tenant_code, method }` + `Idempotency-Key` | `{ session_id, amount_paise, payment: { id, gateway_order_id, status } }`                                    | 400 no amount                              |
| `POST` | `/sessions/:id/pay`              | `{ tenant_code, payment_id? }`                | `{ session_id, status: 'COMPLETED', amount_paise, kwh_consumed }`                                            | 400 payment not settled                    |

Admin base: `/api/admin/tenant/ev-charging`

| Method  | Path        | Purpose                          |
| ------- | ----------- | -------------------------------- |
| `GET`   | `/`         | List chargers + recent sessions  |
| `PATCH` | `/chargers` | Upsert charger                   |
| `GET`   | `/sessions` | Paginated read-only session list |

---

## Sub-sprint 8.2D-A — Schema, catalogue & adapter

**Objective:** Database + seed + catalogue + stub meter interface — no HTTP yet.

### Deliverables

| ID  | Deliverable           | Detail                                                                                          |
| --- | --------------------- | ----------------------------------------------------------------------------------------------- |
| A1  | Prisma `EvCharger`    | Fields per plan D1; `@@unique([tenantId, code])`; RLS policy                                    |
| A2  | Prisma `EvSession`    | Fields per plan D2; enum `EvSessionStatus`; `kwhConsumed Decimal @db.Decimal(10,3)`             |
| A3  | Payment FK            | `payments.ev_session_id` nullable UUID + index                                                  |
| A4  | `IEvMeterProvider`    | `startMeter(sessionId)`, `readMeter(sessionId) → kWh`, `stopMeter(sessionId) → kWh`             |
| A5  | `StubEvMeterProvider` | In-memory map; `stop` adds `STUB_EV_KWH_INCREMENT` (default 5.5)                                |
| A6  | Catalogue             | `ev-charging-fee` revenue head + `ev-charging` global service (`workflow_pattern: tax-payment`) |
| A7  | KMC seed              | 2 chargers: e.g. `CHG-MKT-01`, `CHG-MKT-02`, `rate_paise_per_kwh: 1500`, TYPE2/CCS2             |
| A8  | Tenant config         | KMC `smart_city.ev_charging.enabled: true` in seed or tenant config JSON                        |

### Implementation steps

1. Add enums/models to `schema.prisma`; run `pnpm --filter @enagar/api prisma:migrate:dev` with name `sprint_82d_ev_charging_schema`.
2. Extend `payment-store` interfaces (types only — implementations in D-B).
3. Add adapter files; `pnpm --filter @enagar/smart-city-adapters build`.
4. Add catalogue entries adjacent to `smart-parking` in `service-catalogue.seed.ts`.
5. Create `prisma/seed/ev-charging.ts`; wire in `seed.ts`.
6. `pnpm --filter @enagar/api prisma:seed` and verify rows in DB.

### Exit criteria (8.2D-A)

| ID  | Criterion                                           | Verification                                 |
| --- | --------------------------------------------------- | -------------------------------------------- |
| EA1 | Migration applies cleanly on fresh DB               | `prisma migrate deploy`                      |
| EA2 | RLS enabled on `ev_chargers`, `ev_sessions`         | Inspect migration SQL                        |
| EA3 | KMC seed has 2 active chargers @ 1500 paise/kWh     | SQL or Prisma Studio                         |
| EA4 | `ev-charging` appears in effective services for KMC | `GET /services?tenant_code=KMC` or seed unit |
| EA5 | Stub meter returns deterministic kWh on stop        | Package unit test                            |

### Test plan (8.2D-A)

```bash
cd packages/smart-city-adapters && pnpm test
cd apps/api && pnpm test -- ev-charging-amount   # after util exists; stub-only tests in A if util created here
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api prisma:seed
```

**Unit tests (write in A or B):**

- `StubEvMeterProvider`: start → read 0 → stop → read returns increment.
- `computeEvSessionAmountPaise(5.5, 1500) === 8250` (5.5 × 15 ₹ = ₹82.50).

---

## Sub-sprint 8.2D-B — API core (service + controllers) ✅ closed 2026-06-18

**Objective:** All citizen and admin endpoints working; payment store wired; hold expiry job on read paths.

### Deliverables

| ID  | Deliverable         | Detail                                                                    |
| --- | ------------------- | ------------------------------------------------------------------------- |
| B1  | `EvChargingService` | All business rules + transactions                                         |
| B2  | Citizen controller  | Routes per API contract                                                   |
| B3  | Admin controller    | CRUD + session list                                                       |
| B4  | Payment store impl  | `evSessionId` on create; `findActivePaymentByEvSession`                   |
| B5  | Hold cleanup        | `releaseExpiredEvSessionHolds` on list/hold (mirror parking)              |
| B6  | Revenue resolution  | `ServicesService.resolveLedgerCodesForService('ev-charging')` at pay time |
| B7  | Module registration | `EvChargingModule` in `app.module.ts`                                     |

### Key service methods

- `listChargersForCitizen` — join availability (no active HELD/CHARGING on charger).
- `createHoldForCitizen` — transactional `insert session HELD` after conflict checks.
- `startSessionForCitizen` — HELD + not expired → CHARGING; call `meter.startMeter`.
- `stopSessionForCitizen` — CHARGING → set `ended_at`, `kwh_consumed`, `amount_paise`; `meter.stopMeter`.
- `initiatePaymentForCitizen` — idempotency + stub gateway (copy fingerprint pattern from smart parking).
- `confirmPaymentForCitizen` — settled payment → `COMPLETED`, link `payment_id`.
- `listForAdmin` / `upsertCharger` / `listSessionsForAdmin`.

### Exit criteria (8.2D-B)

| ID  | Criterion                                                                     | Verification         |
| --- | ----------------------------------------------------------------------------- | -------------------- |
| EB1 | `GET /chargers` returns 2 KMC chargers with `available: true`                 | curl / smoke         |
| EB2 | Hold → start → stop computes **8250 paise** for default stub (5.5 kWh @ 1500) | API unit test        |
| EB3 | Second hold on same charger → **409**                                         | service spec         |
| EB4 | Expired hold → charger available again                                        | unit test + manual   |
| EB5 | `initiate-payment` + stub settle + `pay` → `COMPLETED`                        | smoke script (draft) |
| EB6 | Cross-tenant hold rejected                                                    | security spec stub   |
| EB7 | Admin `PATCH /chargers` creates charger visible to citizen                    | manual               |

### Test plan (8.2D-B)

**Unit** (`ev-charging.service.spec.ts`):

- Hold conflict on busy charger.
- Citizen overlap guard (second HELD while first active).
- Hold expiry releases slot.
- Stop without start → 409.
- Payment without settled status → 400.
- Amount rounding edge: `1.333 kWh × 1500` → `1999` or `2000` (document chosen rounding).

**Integration** (optional `ev-charging.integration.spec.ts`):

- Full lifecycle with in-memory payment store + test DB.

```bash
cd apps/api && pnpm test -- ev-charging
node scripts/smoke-ev-charging.mjs   # create script in D-B or D-E
```

---

## Sub-sprint 8.2D-C — Citizen PWA ✅ closed 2026-06-18

**Objective:** `EvChargingWorkspace` end-to-end in browser.

### Deliverables

| ID  | Deliverable           | Detail                                                                     |
| --- | --------------------- | -------------------------------------------------------------------------- |
| C1  | `ev-charging-api.ts`  | Typed fetch helpers + idempotency key helper                               |
| C2  | `EvChargingWorkspace` | Step UX: list → hold → start → stop → show kWh/amount → stub pay → confirm |
| C3  | `page.tsx` routing    | `isEvChargingService(service)` → workspace; Smart City category card       |
| C4  | UX guards             | `submittingRef` anti double-click; disable busy chargers                   |

### UI flow (match smart parking patterns)

1. **Chargers** — cards showing connector, ₹/kWh, max kW, available badge.
2. **Reserve** — creates hold; show 15 min countdown (optional simple text).
3. **Start charging** — prominent CTA when HELD.
4. **Stop** — shows consumed kWh + amount.
5. **Pay** — reuse `completeBookingStubPayment` from `bookings-api.ts`.
6. **Done** — success message + receipt hint (payments list / metadata).

### Exit criteria (8.2D-C)

| ID  | Criterion                                                | Verification   |
| --- | -------------------------------------------------------- | -------------- |
| EC1 | Service card opens EV workspace (not generic apply form) | Manual PWA     |
| EC2 | Busy charger not clickable                               | Manual         |
| EC3 | Full happy path in UI matches smoke script               | Manual + smoke |
| EC4 | `pnpm typecheck` clean in citizen-pwa                    | CI             |

### Test plan (8.2D-C)

```bash
cd apps/citizen-pwa && pnpm typecheck
# Manual: login 9876543210 / OTP 12345 → KMC → Smart City → EV Charging
```

---

## Sub-sprint 8.2D-D — Tenant Admin operations

**Objective:** Operators can manage chargers and audit sessions.

### Deliverables

| ID  | Deliverable          | Detail                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------ |
| D1  | `EvChargingOpsPanel` | Charger form (code, name, location, connector, max_kw, rate, active)     |
| D2  | Session table        | Read-only: session id, charger, citizen, status, kWh, amount, timestamps |
| D3  | Operations tab       | `{ id: 'ev-charging', label: 'EV Charging' }` in `operations-client.tsx` |

Mirror `smart-parking-ops-panel.tsx` structure (fetch with admin JWT, tenant from context).

### Exit criteria (8.2D-D)

| ID  | Criterion                                          | Verification       |
| --- | -------------------------------------------------- | ------------------ |
| ED1 | Create charger via admin → visible in citizen list | Manual             |
| ED2 | Deactivate charger → hidden or `available: false`  | Manual             |
| ED3 | Session list shows completed smoke session         | Manual after smoke |

### Test plan (8.2D-D)

```bash
cd apps/admin-tenant && pnpm typecheck
# Manual: tenant admin login → Operations → EV Charging
```

---

## Sub-sprint 8.2D-E — Verification & closure

**Objective:** Automated smoke, security, docs, exit runbook evidence.

### Deliverables

| ID  | Deliverable                     | Detail                                                                    |
| --- | ------------------------------- | ------------------------------------------------------------------------- |
| E1  | `scripts/smoke-ev-charging.mjs` | hold → start → stop → initiate → stub complete → pay                      |
| E2  | Security spec                   | `tests/security/master-sprint-82d-ev-charging.spec.ts` — tenant isolation |
| E3  | Update parent plan              | Mark 8.2D closed in `master-sprint-82-plan.md`                            |
| E4  | Exit runbook                    | Complete evidence table in `master-sprint-82d-exit.md`                    |
| E5  | `graphify update .`             | After code changes                                                        |

### Smoke script outline (`scripts/smoke-ev-charging.mjs`)

```text
1. POST /auth/verify-otp (9876543210 / 12345)
2. POST /citizen/select-tenant { KMC }
3. GET  /citizen/ev-charging/chargers?tenant_code=KMC
4. POST /citizen/ev-charging/chargers/CHG-MKT-01/holds
5. POST /citizen/ev-charging/sessions/:id/start
6. POST /citizen/ev-charging/sessions/:id/stop
   → assert amount_paise === 8250 (5.5 × 1500)
7. POST /citizen/ev-charging/sessions/:id/initiate-payment (Idempotency-Key)
8. POST /payments/stub/complete (existing stub)
9. POST /citizen/ev-charging/sessions/:id/pay
10. GET chargers → CHG-MKT-01 available again
```

### Exit criteria (8.2D — sprint slice)

| ID  | Criterion                                 | Verification                                                  |
| --- | ----------------------------------------- | ------------------------------------------------------------- |
| E1  | EV session E2E API (plan E4)              | `node scripts/smoke-ev-charging.mjs`                          |
| E2  | Admin configure charger (plan E6 partial) | Manual ops panel                                              |
| E3  | Tenant isolation                          | `pnpm test:security -- master-sprint-82d-ev-charging.spec.ts` |
| E4  | No regression on smart parking            | `node scripts/smoke-smart-parking-bay-merge.mjs`              |
| E5  | API + PWA typecheck                       | `pnpm test` + typecheck scripts                               |

---

## Suggested commit sequence

| Commit | Scope                                                                 |
| ------ | --------------------------------------------------------------------- |
| 1      | `feat(api): 8.2D-A ev charging schema, catalogue, stub meter adapter` |
| 2      | `feat(api): 8.2D-B ev charging citizen and admin API`                 |
| 3      | `feat(citizen-pwa): 8.2D-C ev charging workspace`                     |
| 4      | `feat(admin-tenant): 8.2D-D ev charging operations panel`             |
| 5      | `test: 8.2D-E smoke, security, exit runbook`                          |

---

## Risks & mitigations

| Risk                                | Mitigation                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Payment store missing `evSessionId` | Add in D-A schema + D-B store impl together before initiate-payment               |
| `CHARGING` + `ended_at` ambiguity   | Document in service + expose `awaiting_payment` in response mapper                |
| Catalogue not showing EV service    | Ensure category `parking-transport` maps to citizen `smart` nav (same as parking) |
| Float kWh                           | Use `Decimal` in Prisma; convert to number only at API boundary                   |

---

## Out of scope (reminder)

- OCPP / hardware connector lock
- Real-time SoC display
- Confirmation PDF (defer to 8.2F with parking PDF reuse)
- Full `master-sprint-82.spec.ts` merge (8.2F)

---

## Next slice after 8.2D

**8.2E** — IoT water meter prepaid recharge (stub) per [`master-sprint-82-plan.md`](./master-sprint-82-plan.md).

---

_Last updated: 2026-06-18 — implementation plan for Sprint 8.2D; ready for execution._
