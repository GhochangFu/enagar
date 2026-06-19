# Master Sprint 8.5B Implementation Plan — Hoarding quote API, PWA calculator & BOC regression

> **For implementers:** Execute **B1 → B5** in order. Builds on closed **8.5A** ([`master-sprint-85a-exit.md`](./master-sprint-85a-exit.md)). Exit evidence: [`master-sprint-85b-exit.md`](./master-sprint-85b-exit.md).

**Goal:** Citizen-authenticated hoarding quote, PWA calculator workspace before `ad-hoarding` apply, quote snapshot on application for desk review, BOC smoke regression green.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5B · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Status:** **complete** (2026-06-18) · Exit: [`master-sprint-85b-exit.md`](./master-sprint-85b-exit.md)

---

## Architecture decisions (locked for 8.5B)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Citizen API base | `citizen/advertising` | Mirrors `citizen/smart-parking`, `citizen/iot-water` |
| Quote endpoint | `POST …/hoarding/quote` | Master plan B1 |
| Ward picker data | `GET …/hoarding/context` | Returns tenant wards; no admin token required |
| Tenant scope | `resolveCitizenMunicipalityForWrite` + `tenant_code` query/body | Same as 8.2 smart-city citizen APIs |
| Quote math | Reuse `computeHoardingTaxPaise` from 8.5A | Single source of truth |
| Snapshot storage | Optional form field `hoarding_calculator_snapshot` (JSON string) | Passes `validateSubmission` (`additionalProperties: false`) |
| Payment timing | **Deferred** — permission fee **+ hoarding tax** combined on `approval` line | Single payment link after officer approval |
| PWA flow | Intercept `ad-hoarding` → calculator → Continue → existing apply form | Master plan flow order |
| Desk display | `DeskHoardingQuotePanel` parses snapshot; hide raw JSON from summary grid | B4 clerk review |
| Re-quote after submit | Server does not mutate submitted apps; citizen re-applies with new draft | Edge case from master plan |

### Snapshot JSON shape (stored in `hoarding_calculator_snapshot`)

```json
{
  "ward_code": "12",
  "width_ft": 10,
  "height_ft": 8,
  "duration_months": 3,
  "sqft": 80,
  "tax_paise": 1800000,
  "revenue_head_code": "tax-ad-hoarding",
  "ward_matched": true,
  "rate_paise_per_sqft_per_month": 7500,
  "quoted_at": "2026-06-18T12:00:00.000Z"
}
```

---

## File manifest

| File | Responsibility |
| ---- | -------------- |
| `advertising/hoarding-quote.util.ts` | Build/parse calculator snapshot |
| `advertising/citizen-advertising.controller.ts` | Citizen GET context + POST quote |
| `advertising/advertising.service.ts` | `quoteHoardingForCitizen`, `getHoardingContextForCitizen` |
| `advertising/dto/advertising.dto.ts` | Citizen DTOs with `tenant_code` |
| `apps/api/prisma/seed.ts` | Optional `hoarding_calculator_snapshot` on `ad-hoarding` form |
| `citizen-pwa/lib/advertising-api.ts` | HTTP client |
| `citizen-pwa/components/hoarding-calculator-workspace.tsx` | Calculator UX |
| `citizen-pwa/app/page.tsx` | Intercept `ad-hoarding` apply flow |
| `admin-tenant/.../desk-client.tsx` | `DeskHoardingQuotePanel` |
| `scripts/smoke/smoke-hoarding-calculator.mjs` | Quote + snapshot smoke |
| `scripts/smoke/hoarding-boc-e2e-smoke.mjs` | Optional quote leg before draft |

---

## Sub-deliverables

### B1 — Citizen quote API

- `GET /citizen/advertising/hoarding/context?tenant_code=KMC` → `{ wards: [{ number, name }] }`
- `POST /citizen/advertising/hoarding/quote` → full quote result + `quoted_at`
- `401` without citizen JWT; tenant isolation via write resolver

### B2 — `HoardingCalculatorWorkspace`

- Ward select, W×H, months 1–12, Get quote, show tax in INR
- **Continue to apply** → prefill `hoarding_dimensions` + snapshot field → standard apply form

### B3 — Deferred fee alignment

- No payment at quote; no change to `fee_lines.approval` / BOC payment generation

### B4 — Desk metadata display

- Summary tab shows hoarding quote panel when snapshot present

### B5 — Regression

- `smoke-hoarding-calculator.mjs` green
- `hoarding-boc-e2e-smoke.mjs` still green (quote leg optional, form unchanged if no snapshot)

---

## Edge cases (must pass in tests)

| Case | Expected |
| ---- | -------- |
| Quote without auth | `401` / `403` |
| Wrong `tenant_code` vs scope | `400` |
| Cross-tenant matrix | Only resolved tenant matrix used |
| Invalid dimensions | `400` from util |
| Snapshot round-trip | build → parse → equal fields |
| Form submit with snapshot | Passes validation (optional field) |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- hoarding advertising
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
node scripts/smoke/smoke-hoarding-calculator.mjs
node scripts/smoke/hoarding-boc-e2e-smoke.mjs
```

---

## Out of scope (8.5B)

- Online hoarding tax payment at quote time
- LED booking (8.5C)
- GIS ward auto-detection
- Mutating submitted application quotes server-side

---

_Last updated: 2026-06-18_
