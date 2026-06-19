# Master Sprint 8.5A Implementation Plan — Hoarding rate calculator foundation

> **For implementers:** Execute in order **A1 → A4**. Citizen quote API and PWA are **8.5B** — do not add `POST /citizen/.../quote` in this slice. Exit evidence: [`master-sprint-85a-exit.md`](./master-sprint-85a-exit.md).

**Goal:** Pure hoarding tax math (ward × sqft × months), tenant-scoped rate matrix storage on `ad-hoarding`, admin CRUD + preview, unit tests.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5A · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24) · Phase [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)

**Builds on:** Sprint **8.2B** `smart-pricing.util.ts` patterns · existing `ad-hoarding` service + BOC workflow (unchanged)

**Status:** **complete** (2026-06-18) · Exit: [`master-sprint-85a-exit.md`](./master-sprint-85a-exit.md)

---

## Architecture decisions (locked for 8.5A)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Module layout | `apps/api/src/modules/advertising/` | Isolated from smart-parking; 8.5C LED may extend same module |
| Pure math | `hoarding-rate.util.ts` (no Nest inject) | Same pattern as `smart-pricing.util.ts`; easy unit tests |
| Config storage | `tenant_services.override_config.hoarding_rate_matrix` on **`ad-hoarding`** | No new table; ward rates are service-level policy |
| Ward key | `ward_code` matches `wards.number` (trimmed string) | Seed uses `"12"`, `"64"` |
| Revenue head | New catalogue head **`tax-ad-hoarding`** (accounting `TAX_AD_HOARDING`) | Util returns `tax-ad-hoarding` for ledger resolution in 8.5B |
| Matrix cap | **200** ward rows max | Prevent config abuse |
| Duration cap | **1–12** months (constant) | Per master plan edge cases |
| Default flat rate | **5000** paise / sqft / month when ward missing | Logically `ward_matched: false` in quote result |
| Admin API | `GET/PUT …/admin/tenant/advertising/hoarding-rates` + `POST …/preview` | Preview validates util without citizen auth |
| Admin UI | Operations → **Advertising** tab · `AdvertisingOpsPanel` | Matrix editor + inline preview |
| Citizen quote | **Deferred to 8.5B** | Keeps 8.5A scope testable in isolation |

### Config JSON shape

```json
{
  "hoarding_rate_matrix": {
    "flat_rate_paise_per_sqft_per_month": 5000,
    "ward_rates": [
      { "ward_code": "12", "rate_paise_per_sqft_per_month": 7500 },
      { "ward_code": "64", "rate_paise_per_sqft_per_month": 6000 }
    ]
  }
}
```

### Quote formula

```text
sqft = round(width_ft × height_ft, 2 decimal places)
rate = ward_rates[ward_code] ?? flat_rate_paise_per_sqft_per_month
tax_paise = round(sqft × duration_months × rate)
reject if tax_paise > INT32_MAX
```

---

## File manifest

| File | Responsibility |
| ---- | -------------- |
| `advertising/hoarding-rate.util.ts` | Parse matrix, compute quote, validate bounds |
| `advertising/hoarding-rate.util.spec.ts` | Ward hit/miss, sqft, months, overflow, negatives |
| `advertising/advertising.service.ts` | Load/save matrix on `ad-hoarding`, admin preview |
| `advertising/advertising.service.spec.ts` | Matrix validation, tenant scope |
| `advertising/advertising-admin.controller.ts` | Admin routes |
| `advertising/dto/advertising.dto.ts` | DTO validation |
| `advertising/advertising.module.ts` | Nest module |
| `service-catalogue.seed.ts` | `tax-ad-hoarding` revenue head + KMC matrix seed |
| `admin-tenant/.../advertising-ops-panel.tsx` | Matrix CRUD UI |
| `admin-tenant/.../operations-client.tsx` | Advertising tab |

---

## Sub-deliverables

### A1 — `HoardingRateService` (pure util)

- `parseHoardingRateMatrix(unknown)`
- `computeHoardingTaxPaise({ matrix, wardCode, widthFt, heightFt, durationMonths })`
- Returns `{ tax_paise, revenue_head_code, ward_matched, ward_code, sqft, duration_months, rate_paise_per_sqft_per_month }`

### A2 — Pricing config shape + seed

- KMC `ad-hoarding` override with sample ward rates (12, 64)
- Revenue head `tax-ad-hoarding`

### A3 — Admin matrix editor

- API: list wards + current matrix; replace matrix; preview quote
- UI: table of ward rows, flat rate field, preview form

### A4 — Unit tests

- `hoarding-rate.util.spec.ts` — all edge cases from master plan
- `advertising.service.spec.ts` — matrix size cap, duplicate ward codes

---

## Edge cases (must pass in tests)

| Case | Expected |
| ---- | -------- |
| Unknown ward | Flat rate; `ward_matched: false` |
| `width_ft` or `height_ft` ≤ 0 | `400` |
| `duration_months` < 1 or > 12 | `400` |
| `tax_paise` overflow | `400` |
| Fractional feet 10.5 × 8.25 | sqft 86.63 → tax computed correctly |
| Duplicate `ward_code` in matrix | `400` on admin save |
| > 200 ward rows | `400` on admin save |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- hoarding-rate
pnpm --filter @enagar/api test -- advertising
pnpm --filter @enagar/api typecheck
```

---

## Out of scope (8.5A)

- Citizen `POST …/advertising/hoarding/quote` (8.5B)
- PWA calculator workspace (8.5B)
- BOC workflow changes
- GIS ward detection
- Payment / deferred fee settlement

---

_Last updated: 2026-06-19_
