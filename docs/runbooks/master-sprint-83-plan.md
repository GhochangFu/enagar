# Master Sprint 8.3 Plan — Tenders, vendor empanelment & advertisement/hoarding

> **HELD (2026-06-18)** — Do **not** implement this slice as written. Scope was split: **advertising/hoarding/LED** (minus tenders) and **health** (minus pension) merged into active **[`master-sprint-85-plan.md`](./master-sprint-85-plan.md)**. Tender, EMD, vendor empanelment, and deposit-refund items remain here for a **future procurement slice**. This file is retained as reference only.

**Status:** **held** — superseded for implementation by **8.5** · Original exit: [`master-sprint-83-exit.md`](./master-sprint-83-exit.md) _not started_  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)  
**ROADMAP:** [§ Phase 8](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Slice **8.3**  
**Builds on:** Sprint **8.2** ([`master-sprint-82-plan.md`](./master-sprint-82-plan.md) / exit _TBD_) — smart-city stub adapters, zone pricing evaluator; Sprint **8.1** ([`master-sprint-81-exit.md`](./master-sprint-81-exit.md)) — bookings calendar, deposits, stub payments  
**Architecture:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Revenue Model (EMD/deposits), § Bookings — Calendar-Based Inventory · [`docs/service-catalogue.md`](../service-catalogue.md) § tender / adv patterns

---

## Primary user stories (non-negotiable)

### Tenders & EMD

> As a **contractor**, I browse **active tenders**, **purchase the tender form**, pay **EMD** (% of estimated value), and receive a **participation receipt** — so I can bid without visiting the ULB office.

### Vendor empanelment

> As a **vendor**, I apply for **contractor empanelment** with GST/PAN proofs, track approval, and appear on the tenant vendor register when approved — so I can be assigned work orders.

### Hoarding rate calculator

> As an **advertiser**, I enter **ward, hoarding size, and duration**, see a **computed hoarding fee quote**, then continue to the **ad-hoarding permission** application — so I know the cost before applying.

### LED slot booking

> As an **advertiser**, I open an **LED board calendar**, pick a **free slot**, pay, and receive **confirmation** — reusing the booking engine from Sprint 8.1.

**Flow order (tender EMD — must not be reversed):**

```text
Browse tender list → purchase form (fixed fee) → pay computed EMD → deposit held → participation receipt
```

**Flow order (hoarding calculator — must not be reversed):**

```text
Ward + dimensions + duration → quote (ward × sqft × months) → apply for ad-hoarding → workflow scrutiny
```

---

## Objective

Productionise the **citizen-facing tender and advertisement modules** already modelled in Phase 8 ROADMAP and `ARCHITECTURE.md`:

| Service code       | Pattern         | Sprint 8.3 focus                                              |
| ------------------ | --------------- | ------------------------------------------------------------- |
| `tender-form`      | `instant`       | Tender catalogue + form purchase (₹500 default)               |
| `tender-emd`       | `tender`        | Computed EMD (% of estimated value) → `deposits` + stub pay   |
| `security-deposit` | `tender`        | Post-award SD capture (staff-initiated v1)                    |
| `deposit-refund`   | `tender`        | Citizen refund application linked to held EMD/SD                |
| `scrap-sale`       | `tender`        | Manual lot listing + EMD (no auction engine)                    |
| `vendor-reg`       | `cert-issuance` | Contractor empanelment → `tenant_vendors` on approval         |
| `ad-hoarding`      | `cert-issuance` | Rate **calculator** before apply (existing BOC workflow kept) |
| `ad-led`           | `booking`       | LED slot calendar + reserve-and-pay                           |
| `ad-billboard`     | `cert-issuance` | Citizen PWA entry + optional size-based quote hook            |

Extend — do not replace — Sprint **8.1** bookings/deposits, Sprint **8.2** pricing evaluator patterns, and existing hoarding desk workflow (`hoarding_clerk` → BOC).

---

## What already exists (do not re-build)

| Area                         | Evidence                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Deposits + lifecycle         | `deposits` table, `FinanceDepositsService`, `deposit-lifecycle.ts`, stub payment capture       |
| Payments + receipts          | `PaymentsService`, GL posting, receipt PDF metadata                                           |
| Hoarding application flow    | `ad-hoarding` service, hoarding designations, BOC workflow templates, desk queue              |
| Hoarding smoke               | `scripts/smoke/hoarding-boc-e2e-smoke.mjs`, `scripts/smoke/lib/hoarding-smoke-lib.mjs`         |
| Vendor registry (staff)      | `tenant_vendors`, work-order vendor assignment on desk                                         |
| Bookings engine              | `apps/api/src/modules/bookings/` — slots, holds, confirm, PDF (reuse for `ad-led`)            |
| Fee-rule types               | `FeeRule`, slab/fixed/computed in `admin-tenant-config.contracts.ts`                            |
| Global service catalogue     | All six `tender` services + six `adv` services in `docs/service-catalogue.md`                 |
| Rental assets (hoarding ops) | `apps/admin-tenant/app/rental-assets/` — long-term hoarding asset register (admin-only today) |

### Known gaps to close in 8.3

- No **`tenders`** catalogue table or citizen tender list API.
- No **EMD computation** (% of estimated value) wired to `deposits.deposit_type = 'EMD'`.
- No citizen **Tenders** category flow (form purchase + EMD in one journey).
- **`vendor-reg`** not exposed as citizen apply + approval → `tenant_vendors` promotion.
- **`deposit-refund`** citizen application not linked to deposit lifecycle.
- No **hoarding rate calculator** API (ward × sqft × duration); `ad-hoarding` fee is fixed today.
- No **`ad-led`** bookable asset / slot calendar (pattern = `booking` in catalogue).
- **`scrap-sale`** has no lot listing or manual bid recording surface.

---

## Key existing surfaces

- `apps/api/src/modules/finance/finance-deposits.service.ts` — deposit CRUD, status transitions
- `apps/api/src/modules/payments/payments.service.ts` — stub initiate/settle
- `apps/api/src/modules/bookings/bookings.service.ts` — slot/hold/confirm (LED reuse)
- `apps/api/src/modules/services/service-catalogue.seed.ts` — `ad-hoarding`, tender category stub
- `apps/admin-tenant/lib/workflow-designer-templates.ts` — hoarding scrutiny Pattern C
- `apps/citizen-pwa/app/page.tsx` — `tender` category card exists; no tender workspace yet
- `apps/admin-tenant/app/rental-assets/` — hoarding rental asset CRUD (reference for rate matrix wards)

---

## Sub-sprints

### 8.3A — Tender schema & admin catalogue

**Deliverables:**

| ID  | Deliverable              | Detail                                                                                                                                                                                                 |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **`tenders` table**      | Per tenant: `tender_no` (unique), localized `title`, `description`, `estimated_value_paise`, `emd_percent` (2–5, validated), `form_fee_paise`, `publish_at`, `closing_at`, `status` (`DRAFT`, `OPEN`, `CLOSED`, `AWARDED`), `metadata` JSON (department, document URLs). RLS parity. |
| A2  | **`tender_participations` table** | FK `tender_id`, `citizen_id`, `application_id?`, `form_payment_id?`, `emd_deposit_id?`, `participation_no`, `status` (`FORM_PURCHASED`, `EMD_HELD`, `WITHDRAWN`). Unique `(tenant_id, tender_id, citizen_id)`. |
| A3  | **`scrap_lots` table (minimal)** | For `scrap-sale`: `lot_no`, `description`, `emd_paise`, `status`, `closing_at`; manual award fields in metadata.                                                                                        |
| A4  | **Admin CRUD**           | Tenant Admin → Operations → Tenders: list/create/edit tenders and scrap lots (guided form). Publish/close actions with audit log.                                                                       |
| A5  | **Seed**                 | KMC: **5 active OPEN tenders** (ROADMAP exit criterion), 1 scrap lot, varied EMD %.                                                                                                                    |

**Non-goals:**

- Full e-procurement / e-tender portal integration (deep link only, per ROADMAP out of scope).
- Online bid submission / encryption.

---

### 8.3B — Citizen tender list, form purchase & EMD payment

**Deliverables:**

| ID  | Deliverable                              | Detail                                                                                                                                                                      |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **`GET …/tenders`**                      | Public/citizen: list `OPEN` tenders (title, closing_at, estimated_value, form_fee, emd_percent summary). Tenant-scoped via subdomain/header.                                 |
| B2  | **`GET …/tenders/:tenderNo`**            | Detail + citizen participation status if authenticated.                                                                                                                       |
| B3  | **`POST …/tenders/:tenderNo/form-purchase`** | Creates `tender_participations` + `application` for `tender-form` (instant) → stub pay fixed form fee → `FORM_PURCHASED`. Idempotent per citizen+tender.                      |
| B4  | **`POST …/tenders/:tenderNo/emd`**       | Validates form purchased; computes `emd_paise = round(estimated_value × emd_percent)`; creates `deposits` (`deposit_type: 'EMD'`, `reference_code: tender_no`); stub pay → `EMD_HELD`. |
| B5  | **`GET …/tenders/my-participations`**    | Citizen list with tender ref, deposit status, receipts.                                                                                                                      |
| B6  | **Citizen PWA — `TendersWorkspace`**     | Tenders category → list → detail → form purchase → EMD pay → receipt. Entry cards for `tender-form`, `tender-emd`, `scrap-sale`.                                              |
| B7  | **Revenue heads**                        | Resolve `NTAX_TENDER_FORM`, `DEP_EMD` (or catalogue defaults) via `ServicesService.resolveLedgerCodesForService`.                                                             |

**Non-goals:**

- Live PSP (**3.1B** deferred).
- Automatic EMD refund cron (staff + `deposit-refund` app in 8.3D; PFMS v2).

---

### 8.3C — Vendor empanelment (`vendor-reg`)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Citizen apply path**              | PWA + API: `vendor-reg` application with GST cert, PAN, address proof (catalogue docs). Fee ₹2,500 stub upfront.                                                                      |
| C2  | **Workflow**                        | Reuse `cert-issuance` stages: clerk verify → officer approve (procurement department designations). Seed KMC workflow if missing.                                                     |
| C3  | **Approval hook**                   | On certificate issue: upsert `tenant_vendors` (`code` from GSTIN slug or generated), link `application.metadata.vendor_id`.                                                           |
| C4  | **`GET …/vendors/me`**              | Citizen: empanelment status + vendor code when approved.                                                                                                                              |
| C5  | **Admin vendor list**               | Tenant Admin read-only empanelled vendors + link to originating application.                                                                                                          |

**Non-goals:**

- Vendor performance scoring / blacklisting engine.
- Replacing Phase 12 work-order vendor assignment UX.

---

### 8.3D — Deposit refund application (`deposit-refund`)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Citizen apply**                   | `deposit-refund` instant/refund pattern: select held deposit (EMD/SD) → application with bank details → staff review.                                        |
| D2  | **Staff release**                   | Finance desk: approve → `FinanceDepositsService` transition `held` → `release_initiated` → `refunded` (stub refund metadata v1).                             |
| D3  | **Link to tender participation**    | Show tender context on refund application; block refund if tender still `OPEN` unless withdrawn.                                                             |
| D4  | **Security deposit (minimal)**        | Staff-initiated SD capture for awarded tender (`security-deposit` service) — document manual award in metadata; citizen pay stub.                          |

**Non-goals:**

- PFMS NACH payout integration.
- Automatic 30-day EMD refund scheduler (document as v2; manual finance action in v1).

---

### 8.3E — Hoarding rate calculator (ward × size × duration)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                          |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **`HoardingRateService`**           | Pure module: inputs `ward_code`, `width_ft`, `height_ft`, `duration_months`; outputs `tax_paise`, `revenue_head_code` (`TAX_AD_HOARDING`). Whitelisted slab lookup only.                         |
| E2  | **Pricing config**                  | Tenant override / ward metadata: `hoarding_rate_matrix` JSON — `{ ward_code, rate_paise_per_sqft_per_month }[]`; default flat rate when ward absent.                                          |
| E3  | **`POST …/advertising/hoarding/quote`** | Citizen-authenticated; validates dimensions > 0, duration 1–12 months (config cap).                                                                                                         |
| E4  | **PWA calculator UI**               | Before `ad-hoarding` apply: ward picker → W×H → months → quote → pre-fill application form amounts/metadata.                                                                                    |
| E5  | **Deferred fee alignment**          | Keep `payment_schedule: deferred_only` on `ad-hoarding`; quote stored on application for officer approval payment step (existing BOC flow).                                                    |
| E6  | **Unit tests**                      | Ward boundary, sqft math, min/max duration, unknown ward fallback.                                                                                                                              |

**Non-goals:**

- Replacing hoarding scrutiny workflow or BOC stages.
- GIS map-based ward auto-detection.

---

### 8.3F — LED slot booking calendar (`ad-led`)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **LED bookable assets**             | Seed `bookable_assets` per LED board (`asset_type: LED_BOARD`, `rate_unit: HOUR` or `DAY` per tenant config); link `ad-led` tenant service via `override_config.bookable_asset_codes`. |
| F2  | **Reuse bookings API**              | Citizen uses existing `GET …/bookings/assets/:code/slots`, hold/confirm, deposit/stub pay from 8.1.                                                                                   |
| F3  | **Citizen PWA — LED booking**       | Advertising category → LED Boards → calendar (reuse `BookingWorkspace` component) → pay → confirmation PDF.                                                                           |
| F4  | **Admin**                           | Operations: LED asset CRUD + availability windows (prime-time bands as blackouts optional).                                                                                           |
| F5  | **Seed**                            | KMC: 2 LED boards with hourly slots 06:00–23:00.                                                                                                                                      |

**Non-goals:**

- Dynamic creative upload/scheduling CMS.
- Programmatic ad network integration.

---

### 8.3G — Digital billboard & scrap sale surfaces (minimal)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | **`ad-billboard` PWA entry**        | Citizen apply path wired (existing cert-issuance); optional size slab quote using `FeeRule` slabs (reuse E1 pattern without ward dimension).                 |
| G2  | **Scrap sale citizen view**         | `GET …/scrap-lots` + detail; EMD payment via tender deposit pattern; manual winner recorded in admin metadata.                                               |
| G3  | **Regression**                      | `hoarding-boc-e2e-smoke.mjs` still green after calculator + workflow touchpoints.                                                                            |

**Non-goals:**

- Online auction engine (ROADMAP v2).
- Billboard structural engineering workflow redesign.

---

### 8.3H — Docs, tests, verification

**Deliverables:**

| ID  | Deliverable           | Detail                                                                                                                                                         |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Exit runbook**      | `master-sprint-83-exit.md` with evidence table + manual smoke sign-off.                                                                                        |
| H2  | **Security contract** | `tests/security/master-sprint-83.spec.ts` — tenant isolation on tenders/participations, cross-tenant EMD rejected, vendor-reg auth, hoarding quote auth.      |
| H3  | **API unit tests**    | EMD math, form purchase idempotency, deposit linkage, hoarding quote boundaries, LED slot hold.                                                                |
| H4  | **Smoke script**      | `scripts/smoke-sprint-83-tenders-hoarding.mjs` — 5 tenders listed → form+EMD → deposit held; hoarding quote → apply stub; LED slot book.                      |
| H5  | **README / help**     | Operator help § tender publishing, EMD %, hoarding rate matrix, LED asset setup.                                                                               |
| H6  | **ROADMAP queue row** | Add **8.3** closed line under Phase 8 when done.                                                                                                               |

---

## Exit criteria

| ID  | Criterion                                                                 | Verification                         |
| --- | ------------------------------------------------------------------------- | ------------------------------------ |
| E1  | Tender list renders **≥ 5 active tenders** for pilot tenant                 | API + manual PWA                     |
| E2  | Citizen **buys form + pays EMD** end-to-end; deposit `held`                 | `smoke-sprint-83-tenders-hoarding.mjs` |
| E3  | **Vendor empanelment** apply → approve → `tenant_vendors` row created     | API + manual desk                    |
| E4  | **Hoarding calculator** quote varies by ward/size/duration (unit test)      | Unit test + PWA                      |
| E5  | **`ad-hoarding` apply** still completes BOC workflow (no regression)      | `hoarding-boc-e2e-smoke.mjs`         |
| E6  | **LED slot booking** confirm + PDF via bookings engine                      | Smoke + manual PWA                   |
| E7  | **`deposit-refund`** application links to held EMD and staff can release    | Manual finance desk                  |
| E8  | `pnpm test:security -- master-sprint-83.spec.ts` green                      | CI                                   |
| E9  | No regression: `master-sprint-81.spec.ts`, `master-sprint-82.spec.ts`     | CI                                   |
| E10 | `graphify update .` after API/UI code changes                               | Agent rule                           |

---

## Out of scope (Sprint 8.3)

Defer to **8.4** or later per [`ROADMAP.md`](../../ROADMAP.md):

- Welfare pensions + disbursement status
- Health bookings (ambulance, hearse, crematorium)
- Phase 8 cross-module hardening pass
- Smart waste, GIS licensing, rooftop solar (8.2 deferrals)
- Real IoT / live PSP (**3.1B**)
- State e-tender portal integration (deep link placeholder only)
- Full scrap **auction engine**
- PFMS automated refund dispatch
- Push/SMS for tender closing reminders

---

## Dependencies

| Dependency                               | Status                 |
| ---------------------------------------- | ---------------------- |
| Sprint 8.1 — bookings + deposits + PDF     | Closed (2026-06-03)    |
| Sprint 8.2 — pricing evaluator patterns    | Planned / in progress  |
| Phase 3 — payments / deposits              | Closed (3.1B deferred) |
| Phase 6 — fee rules + revenue heads        | Closed                 |
| Hoarding BOC workflow (Phase 7 desk)       | Closed — must not regress |

---

## Risks & mitigations

| Risk                                      | Mitigation                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| EMD % computation disputes                | Store `emd_percent` + `estimated_value_paise` on tender; audit on participation |
| Tender list stale after closing           | Status filter on API; admin close action; cache TTL 60 s in PWA               |
| Hoarding calculator vs deferred fee confusion | Calculator = informational + application metadata; payment still at approval |
| LED reusing hall booking UX               | Distinct `asset_type`; copy/UI labels; separate seed assets                     |
| Vendor duplicate GSTIN                    | Unique constraint on normalized GSTIN in application metadata                 |
| Pricing matrix DSL creep                  | Whitelisted ward slabs only; cap matrix rows; unit tests                      |

---

## Verification plan

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/admin-tenant build
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/citizen-pwa test
pnpm test:security -- --runTestsByPath tests/security/master-sprint-83.spec.ts tests/security/master-sprint-82.spec.ts tests/security/master-sprint-81.spec.ts
node scripts/smoke-sprint-83-tenders-hoarding.mjs
node scripts/smoke/hoarding-boc-e2e-smoke.mjs
graphify update .
```

---

## Manual smoke (after implementation)

1. `pnpm infra:up` · migrate · seed · API · Tenant Admin · Citizen PWA.
2. **Tenant Admin:** Publish 5 tenders; set hoarding ward rate matrix; create 2 LED bookable assets.
3. **Citizen PWA — Tenders:** List shows 5 OPEN → open one → purchase form (stub) → pay EMD → participation shows deposit `held`.
4. **Citizen PWA — Vendor reg:** Apply with GST/PAN → clerk approves → vendor appears in admin list.
5. **Citizen PWA — Hoarding:** Calculator quote for Ward 12, 10×8 ft, 3 months → apply `ad-hoarding` → desk BOC flow still advances.
6. **Citizen PWA — LED:** Pick board → free slot → pay → confirmation PDF.
7. **Finance desk:** `deposit-refund` on held EMD → release transition.
8. **Regression:** Community hall booking (8.1) + smart parking (8.2) smoke paths still green.

---

## Decision defaults (locked for this sprint)

| Topic              | Decision                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| Payment rail       | **Stub only** (3.1B out of scope)                                      |
| EMD formula        | `round(estimated_value_paise × emd_percent / 100)`; percent on tender row |
| Form fee           | Default **₹500** (`tender-form` catalogue); overridable per tender         |
| Hoarding tax basis | **sqft × months × ward rate**; dimensions from citizen form              |
| LED slots          | Reuse **8.1 bookings module**; `rate_unit: HOUR` default                 |
| Vendor promotion   | **`tenant_vendors`** upsert on `vendor-reg` certificate issue            |
| Scrap sale         | **Manual award** in admin metadata; no bid engine                        |
| Pilot tenant       | **KMC** seed for tenders, hoarding matrix, LED assets                    |
| e-Tender portal    | **Out of scope** — optional external URL field on tender metadata only   |

---

## Jira

- Parent: [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) — Bookings, Smart-City & Tender Modules
- Sub-task: _TBD_ — Sprint 8.3 — Tenders, vendor empanelment & advertisement/hoarding

---

_Last updated: 2026-06-17 — drafted from Phase 8 ROADMAP slice 8.3, ARCHITECTURE § EMD/deposits, service catalogue tender/adv services, and Sprint 8.1/8.2 foundations._
