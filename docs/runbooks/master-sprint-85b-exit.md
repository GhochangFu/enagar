# Master Sprint 8.5B Exit — Hoarding quote API, PWA calculator & BOC regression

**Status:** **complete** (2026-06-18)  
**Plan:** [`master-sprint-85b-plan.md`](./master-sprint-85b-plan.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

---

## Deliverables

| ID  | Deliverable | Evidence |
| --- | ----------- | -------- |
| B1  | Citizen `GET context` + `POST hoarding/quote` | `citizen-advertising.controller.ts` · service spec |
| B2  | `HoardingCalculatorWorkspace` in citizen PWA | component + `page.tsx` intercept |
| B3  | Deferred fee unchanged on `ad-hoarding` | no `payment_schedule` change |
| B4  | Desk hoarding quote panel | `DeskHoardingQuotePanel` in `desk-client.tsx` |
| B5  | Smokes + BOC regression | scripts updated |

---

## Exit criteria

| ID  | Criterion | Pass | Verification |
| --- | --------- | ---- | ------------ |
| E1  | Citizen quote returns ward-based tax for KMC ward 12 | ✅ | service spec · 80×3×7500 paise |
| E2  | Unauthenticated quote rejected | ✅ | service spec `ForbiddenException` |
| E3  | PWA calculator → Continue prefills apply form + snapshot | ✅ | code + manual smoke §1 |
| E4  | Desk summary shows quote snapshot | ✅ | `DeskHoardingQuotePanel` + manual §2 |
| E5  | `hoarding-boc-e2e-smoke.mjs` green | ⏳ | run with API up + **re-seed** for new form field |
| E6  | `smoke-hoarding-calculator.mjs` green | ⏳ | run with API up |
| E7  | `pnpm --filter @enagar/api test -- hoarding advertising` green | ✅ | 3 suites, 18 tests |
| E8  | API + citizen-pwa typecheck green | ✅ | tsc 2026-06-18 |
| E9  | Submitted application quote immutable | ✅ | snapshot on draft only; new apply = new draft |

---

## Prerequisite after pull

Re-seed (or republish) `ad-hoarding` form schema so optional field `hoarding_calculator_snapshot` exists — otherwise draft validation rejects the snapshot key.

```bash
pnpm --filter @enagar/api prisma db seed
```

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- hoarding advertising
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
node scripts/smoke/smoke-hoarding-calculator.mjs
node scripts/smoke/hoarding-boc-e2e-smoke.mjs
```

**Recorded unit tests (2026-06-18):**

```
Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
```

---

## Manual smoke checklist (operator)

Prereq: `pnpm infra:up`, **migrate + seed**, API `:3001`, Citizen PWA, Tenant Admin `:3002`, Keycloak users seeded.

### 1. Citizen calculator → apply

1. Log in to Citizen PWA (KMC).
2. Open **Advertising & Hoarding**.
3. Tap **Hoarding Permission** — **calculator** opens (not the raw form).
4. Ward **12**, **10×8 ft**, **3 months** → **Get quote** → expect **₹18,000.00**.
5. **Continue to apply** → form opens with **10ft x 8ft** in dimensions.
6. Fill applicant name, site address, upload site photo + creative mock → submit.
7. Application appears under **My applications**.

### 2. Desk quote snapshot

1. Tenant Admin → **Desk** → open the hoarding docket.
2. **Summary** tab shows **Hoarding calculator quote**: ward 12, 80 sqft, 3 months, ₹18,000.
3. **Fees & payment** still shows deferred approval schedule (no upfront hoarding tax).

### 3. Re-quote immutability

1. Submit a **second** hoarding application with ward **64** or different size.
2. Open the **first** docket in desk — snapshot unchanged.

### 4. BOC regression

1. `node scripts/smoke/hoarding-boc-e2e-smoke.mjs` — quote leg + full clerk → BOC path green.

### 5. API-only quote (optional)

```bash
node scripts/smoke/smoke-hoarding-calculator.mjs
```

---

## Hoarding tax + approval fee (8.5B+)

When `hoarding_calculator_snapshot` is on the application:

- `fee_settlement.approval.amount_paise` = **permission fee + `tax_paise`**
- Desk payment link and citizen pay use that combined total
- Desk/citizen UI show breakdown: permission + hoarding tax = total

See [`master-sprint-85b-hoarding-payment-plan.md`](./master-sprint-85b-hoarding-payment-plan.md).

---

## Sign-off

| Role | Notes | Date |
| ---- | ----- | ---- |
| Engineering | 8.5B shipped — citizen quote, PWA calculator, desk panel, tests | 2026-06-18 |
