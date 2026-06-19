# Master Sprint 8.5A Exit — Hoarding rate calculator foundation

**Status:** **complete** (2026-06-18)  
**Plan:** [`master-sprint-85a-plan.md`](./master-sprint-85a-plan.md) · Parent [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

---

## Deliverables

| ID  | Deliverable | Evidence |
| --- | ----------- | -------- |
| A1  | `hoarding-rate.util.ts` — pure quote math | `hoarding-rate.util.spec.ts` (9 tests) |
| A2  | `hoarding_rate_matrix` on `ad-hoarding` override + `tax-ad-hoarding` revenue head | `service-catalogue.seed.ts` |
| A3  | Admin API + Operations Advertising panel | `advertising-admin.controller.ts` · `advertising-ops-panel.tsx` |
| A4  | Unit tests for ward/sqft/month/overflow edge cases | 12 tests green |

---

## Exit criteria

| ID  | Criterion | Pass | Verification |
| --- | --------- | ---- | ------------ |
| E1  | Ward-specific rate used when `ward_code` matches matrix | ✅ | `hoarding-rate.util.spec.ts` — ward 12 → 7500 paise |
| E2  | Unknown ward falls back to flat rate with `ward_matched: false` | ✅ | unit test — ward 99 → flat 5000 |
| E3  | Zero/negative dimensions rejected | ✅ | unit test |
| E4  | Duration outside 1–12 months rejected | ✅ | unit test (0 and 13 months) |
| E5  | `tax_paise` overflow rejected before persist | ✅ | unit test — INT32_MAX guard |
| E6  | Admin can GET/PUT matrix; max 200 rows enforced | ✅ | `advertising.service.spec.ts` — 201 rows rejected |
| E7  | Admin preview returns same result as util | ✅ | service spec — 10×10 ward 12 → 700000 paise |
| E8  | KMC seed includes sample ward rates for 12 and 64 | ✅ | `tenantServiceOverrides` in seed |
| E9  | `pnpm --filter @enagar/api test -- hoarding-rate advertising` green | ✅ | 2 suites, 12 tests (2026-06-18) |
| E10 | No change to hoarding BOC smoke (no regression) | ✅ | No BOC/workflow files touched in 8.5A |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- hoarding-rate
pnpm --filter @enagar/api test -- advertising
pnpm --filter @enagar/api typecheck
```

**Recorded output (2026-06-18):**

```
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
```

---

## API surface (8.5A)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/admin/tenant/advertising/hoarding-rates` | Matrix + ward list |
| PUT | `/admin/tenant/advertising/hoarding-rates` | Replace matrix |
| POST | `/admin/tenant/advertising/hoarding-rates/preview` | Admin quote preview |

Citizen quote API deferred to **8.5B**.

---

## Sign-off

| Role | Notes | Date |
| ---- | ----- | ---- |
| Engineering | 8.5A foundation shipped — util, seed, admin API/UI, tests | 2026-06-18 |
