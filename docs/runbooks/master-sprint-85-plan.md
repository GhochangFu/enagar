# Master Sprint 8.5 Plan — Advertising, health bookings & Phase 8 hardening

**Status:** **complete** (2026-06-19) · Exit record: [`master-sprint-85-exit.md`](./master-sprint-85-exit.md) · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)  
**ROADMAP:** [§ Phase 8](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Slice **8.5** (merged from held **8.3** + **8.4**)  
**Builds on:** Sprint **8.2** closed ([`master-sprint-82-exit.md`](./master-sprint-82-exit.md)) · Sprint **8.1** ([`master-sprint-81-exit.md`](./master-sprint-81-exit.md)) — bookings calendar, deposits, stub payments, PDF  
**Supersedes (held):** [`master-sprint-83-plan.md`](./master-sprint-83-plan.md) · [`master-sprint-84-plan.md`](./master-sprint-84-plan.md) — implement **8.5** instead; original 8.3/8.4 remain reference only  
**Architecture:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Bookings · § Revenue Model · [`docs/service-catalogue.md`](../service-catalogue.md) § `booking`, `adv` patterns

---

## Scope decision (2026-06-18)

Sprints **8.3** and **8.4** are **held**. This plan merges their implementable remainder into **one** sprint and **defers** the following to a later Phase 8 backlog slice (not in 8.5):

| Deferred (was 8.3 / 8.4) | Reason |
| ------------------------ | ------ |
| Tenders catalogue, form purchase, **EMD** | Sponsor hold — procurement slice later |
| **Vendor empanelment** (`vendor-reg`) | Depends on tender/procurement policy |
| **Deposit refund** / security deposit capture | Tied to EMD lifecycle |
| **Scrap sale** lots + EMD | Tied to tender/deposit rail |
| **Old-age / widow / disability pension** apply + workflow | Sponsor hold — welfare slice later |
| **Pension disbursement** CSV import + citizen status | Depends on pension applications |

**In scope for 8.5:** hoarding rate calculator, LED slot booking, health fleet bookings (**ambulance** + **hearse**), Phase 8 hardening for delivered modules, docs/tests/smokes.

### Scope refinement (2026-06-18 — product)

| Item | Decision | Reason |
| ---- | -------- | ------ |
| **8.5D** — `ad-billboard` citizen workspace | **Deferred** | Sponsor priority — hoarding + LED + health first |
| **`crematorium`** health booking | **Deferred** | Not required for current pilot |
| Ambulance / hearse citizen UX | **Fleet pool** — no vehicle picker | Citizens book the **service + time slot**; system auto-assigns a free unit; UI shows **available unit count** only |

Sub-plans: [`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md) · [`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md) · deferred [`master-sprint-85d-plan.md`](./master-sprint-85d-plan.md)

---

## Primary user stories (non-negotiable)

### Hoarding rate calculator

> As an **advertiser**, I enter **ward, hoarding size, and duration**, see a **computed hoarding fee quote**, then continue to the **ad-hoarding permission** application — so I know the cost before applying.

### LED slot booking

> As an **advertiser**, I open an **LED board calendar**, pick a **free slot**, pay, and receive **confirmation** — reusing the booking engine from Sprint 8.1.

### Health bookings (ambulance + hearse)

> As a **citizen**, I book a **municipal ambulance** or **hearse van** for a **time slot** without choosing a specific vehicle — I see how many units are available, enter details (pickup address for ambulance), pay the listed fee (or **free for emergency ambulance** when flagged), and receive a **confirmation PDF** that does not expose internal fleet unit names.

### Phase 8 hardening

> As **engineering**, advertising + health modules pass **security contracts**, **cross-sprint smoke**, and contribute evidence toward **Phase 8 partial exit** — with deferred tender/pension items explicitly documented.

**Flow order (hoarding calculator — must not be reversed):**

```text
Ward + dimensions + duration → quote (ward × sqft × months) → apply for ad-hoarding → workflow scrutiny (existing BOC)
```

**Flow order (LED booking — must not be reversed):**

```text
Pick LED asset → calendar slot → quote → pay → confirm → PDF
```

**Flow order (health booking — must not be reversed):**

```text
Pick service (ambulance/hearse) → pooled calendar (N units available) → details → quote → pay (or emergency waive) → auto-assign unit → confirm → PDF
```

Citizens **never** pick `Ambulance 1` vs `Ambulance 2`. Admin still maintains individual fleet records; operations calendar shows which unit was assigned.

---

## Objective

Productionise **advertisement** and **health** citizen paths and run a **hardening pass** on Phase 8 modules already shipped in 8.1–8.2 plus this slice:

| Service code   | Pattern         | Sprint 8.5 focus                                              |
| -------------- | --------------- | ------------------------------------------------------------- |
| `ad-hoarding`  | `cert-issuance` | Rate **calculator** before apply (existing BOC workflow kept) |
| `ad-led`       | `booking`       | LED slot calendar + deferred apply + desk pay (8.5C)          |
| `ad-billboard` | `cert-issuance` | _**Deferred (8.5D)**_ — catalogue only; no PWA workspace      |
| `ambulance`    | `booking`       | **Fleet pool** slots; auto-assign unit; emergency **₹0** + audit |
| `hearse`       | `booking`       | **Fleet pool** slot; BPL subsidy metadata (desk verify v1)    |
| `crematorium`  | `booking`       | _**Deferred**_ — catalogue retained; not seeded in 8.5E       |
| _(cross-cut)_  | —               | Security, smoke, perf caps, partial Phase 8 exit evidence     |

Extend — do not replace — Sprint **8.1** bookings/deposits/PDF, Sprint **8.2** pricing evaluator patterns, existing hoarding desk workflow (`hoarding_clerk` → BOC).

---

## What already exists (do not re-build)

| Area                         | Evidence                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Bookings engine (8.1)        | `apps/api/src/modules/bookings/` — slots, holds, confirm, stub pay, PDF, `BookingWorkspace`   |
| Smart pricing (8.2B pattern) | `smart-pricing.util.ts` — whitelisted time bands; mirror for hoarding ward matrix             |
| Hoarding application flow    | `ad-hoarding` service, hoarding designations, BOC workflow templates, desk queue             |
| Hoarding smoke               | `scripts/smoke/hoarding-boc-e2e-smoke.mjs`                                                    |
| Fee-rule types               | `FeeRule`, slab/fixed/computed in `admin-tenant-config.contracts.ts`                          |
| Global service catalogue     | `ad-hoarding`, `ad-led`, `ad-billboard`, health services in `service-catalogue.seed.ts`       |
| Rental assets (hoarding ops) | `apps/admin-tenant/app/rental-assets/` — ward reference for rate matrix                       |
| Phase 8 security/smokes      | `master-sprint-81*.spec.ts`, `master-sprint-82.spec.ts`, `smoke-sprint-82-smart-city.mjs`     |

### Known gaps to close in 8.5

- No **hoarding rate calculator** API (ward × sqft × duration); `ad-hoarding` fee is fixed today.
- No **`ad-led`** bookable asset / slot calendar wired to citizen PWA.
- **`ad-billboard`** citizen workspace **deferred** (8.5D).
- No **bookable assets** linked to `ambulance`, `hearse` (crematorium deferred).
- No **fleet-pool** availability API or auto-assign hold path for health services.
- No citizen **Health** category booking UI (`HealthBookingsWorkspace`).
- No **consolidated Phase 8** security/smoke for advertising + health (8.1–8.2 covered separately).
- No **partial Phase 8 exit** runbook separating delivered vs deferred criteria.

---

## Key existing surfaces

- `apps/api/src/modules/bookings/bookings.service.ts` — slot/hold/confirm (LED + health reuse)
- `apps/api/src/modules/smart-parking/smart-pricing.util.ts` — reference for pure quote modules
- `apps/api/src/modules/services/service-catalogue.seed.ts` — adv + health service defs
- `apps/admin-tenant/lib/workflow-designer-templates.ts` — hoarding scrutiny Pattern C
- `apps/citizen-pwa/components/booking-workspace.tsx` — calendar UX for LED + health
- `apps/citizen-pwa/app/page.tsx` — category routing pattern from 8.2 workspaces
- `apps/admin-tenant/app/dashboard/operations/` — Operations shell for asset CRUD

---

## Sub-sprints

### 8.5A — Hoarding rate calculator foundation

**Deliverables:**

| ID  | Deliverable              | Detail                                                                                                                                                                                          |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **`HoardingRateService`** | Pure module: inputs `ward_code`, `width_ft`, `height_ft`, `duration_months`; outputs `tax_paise`, `revenue_head_code` (`TAX_AD_HOARDING`). Whitelisted slab lookup only — no DSL.               |
| A2  | **Pricing config shape**  | Tenant override / ward metadata: `hoarding_rate_matrix` JSON — `{ ward_code, rate_paise_per_sqft_per_month }[]`; **flat fallback** when ward absent (log + use tenant default).                  |
| A3  | **Admin matrix editor**   | Operations → Advertising (or extend hoarding ops): ward rate rows CRUD; validate max matrix size (e.g. 200 rows).                                                                               |
| A4  | **Unit tests**            | Ward hit/miss, sqft = W×H, month boundaries (1 and 12), zero/negative dimensions rejected, overflow guard on `tax_paise`.                                                                       |

**Edge cases & rules:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Unknown ward | Fallback flat rate; response includes `ward_matched: false` |
| `width_ft` or `height_ft` ≤ 0 | `400` validation error |
| `duration_months` < 1 or > 12 (config cap) | `400` |
| `tax_paise` overflow (> INT32) | `400` before persist |
| Fractional feet | Accept decimals; sqft = product rounded to 2 dp then × rate |

**Non-goals:** GIS auto-ward; replacing BOC workflow.

---

### 8.5B — Hoarding quote API, PWA calculator & BOC regression

**Deliverables:**

| ID  | Deliverable                              | Detail                                                                                                                                                                      |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **`POST …/advertising/hoarding/quote`**  | Citizen-authenticated; tenant scope via `resolveCitizenMunicipalityForWrite`; returns quote + metadata for application pre-fill.                                            |
| B2  | **`HoardingCalculatorWorkspace`**        | PWA Advertising category → calculator → ward picker → W×H → months → quote → **Continue to apply** opens existing `ad-hoarding` flow with amounts in form metadata.         |
| B3  | **Deferred fee alignment**               | Keep `payment_schedule: deferred_only` on `ad-hoarding`; quote stored on application; payment still at officer approval (existing BOC).                                     |
| B4  | **Desk metadata display**                | Desk application detail shows calculator quote snapshot (ward, sqft, months, tax_paise) for clerk review.                                                                   |
| B5  | **Regression**                           | `scripts/smoke/hoarding-boc-e2e-smoke.mjs` green after calculator touchpoints.                                                                                              |

**Edge cases:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Quote without auth | `401` |
| Cross-tenant ward matrix | Only active tenant matrix used |
| Re-quote after apply started | New quote does not mutate submitted application |
| Citizen changes ward after quote | Apply form uses latest quote at submit time only |

**Non-goals:** Online hoarding tax payment at quote time.

---

### 8.5C — LED slot booking (`ad-led`)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **LED bookable assets**             | Seed `bookable_assets` per board (`asset_type: LED_BOARD`, `rate_unit: HOUR` default); link via `tenant_services.override_config.bookable_asset_codes`.                               |
| C2  | **Reuse bookings API**              | Citizen: slots, hold, confirm, stub pay, PDF from 8.1 — filtered when entered via `ad-led` service code.                                                                              |
| C3  | **`LedBookingWorkspace`**           | Advertising category → LED Boards → reuse `BookingWorkspace` with LED-specific copy and asset filter.                                                                                 |
| C4  | **Admin**                           | Operations → Advertising → LED: asset CRUD + availability windows; optional prime-time blackout metadata.                                                                           |
| C5  | **Seed**                            | KMC: 2 LED boards, hourly slots 06:00–23:00 IST weekdays.                                                                                                                             |
| C6  | **Unit + integration tests**        | Hold TTL, overlap guard, confirm PDF metadata includes `service_code: ad-led`.                                                                                                        |

**Edge cases:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Slot overlaps existing hold/confirm | `409` / slot unavailable |
| Book hall asset via LED service code | Rejected — asset not in service mapping |
| Hold expires | Bay/slot released; citizen must re-hold |
| Past slot selected | `400` |
| LED asset inactive | Hidden from citizen list |

**Non-goals:** Creative upload CMS; ad network integration.

---

### 8.5D — Digital billboard citizen entry (`ad-billboard`) — **DEFERRED**

> **Status:** **deferred 2026-06-18** — see [`master-sprint-85d-plan.md`](./master-sprint-85d-plan.md). Catalogue entry remains; no implementation in active 8.5 slice.

**Deliverables (when unpaused):**

| ID  | Deliverable                         | Detail                                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **`BillboardApplyWorkspace`**       | PWA Advertising → Digital Billboard → existing cert-issuance apply path with service-specific form.                                                        |
| D2  | **Optional size slab quote**        | Reuse hoarding-style pure function with **size bands** (small/medium/large) if tenant configures `billboard_fee_slabs`; else catalogue fixed fee.          |
| D3  | **Admin**                           | Fee slab config in tenant service override (max 10 bands).                                                                                                   |

**Edge cases:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Slab boundary (exactly on edge) | Inclusive lower bound, exclusive upper — unit tested |
| No slabs configured | Fall back to catalogue `fee_lines.application` |

**Non-goals:** Structural engineering workflow redesign.

---

### 8.5E — Health bookable assets & schema

> **Implementer plan:** [`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                                 |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | **Fleet assets (admin-only units)** | Seed `bookable_assets`: `asset_type` `AMBULANCE` \| `HEARSE`, `rate_unit: HOUR`, `base_rate_paise`, `security_deposit_paise: 0`, availability windows. Units are **not** citizen-selectable.           |
| E2  | **Service ↔ fleet link**            | `tenant_services.override_config.bookable_asset_codes` — all ambulance unit codes on `ambulance`; hearse code on `hearse`.                                                                              |
| E3  | **Fleet pool API**                  | `GET …/bookings/fleet-availability?service_code=` — merge slots across linked units; each slot includes `available_units` count. Hold without `asset_code` → **auto-assign** first free unit (transactional). |
| E4  | **Emergency ambulance flag**        | Hold accepts `emergency: true` → `rent_paise = 0`, skip payment gate, still confirm; **audit** row + citizen declaration. Max **2 emergency bookings / citizen / day**.                                |
| E5  | **BPL subsidy hook (hearse)**       | Optional `bpl_subsidy_paise` on asset metadata; citizen declares BPL + uploads card; **desk verifies** before payment adjustment (v1: officer override on hold).                                       |
| E6  | **Admin CRUD**                      | Operations → **Health Bookings**: fleet count, availability, emergency policy toggle. Calendar shows **assigned unit** per reservation.                                                                |
| E7  | **Seed**                            | KMC: **2 ambulance units**, **1 hearse** (weekday windows). **No crematorium** in this slice.                                                                                                          |

**Edge cases:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Emergency declared without pickup address | `400` on ambulance |
| Emergency abuse (3rd same day) | `429` with clear message |
| Two citizens, one unit left for slot | DB overlap / transactional assign → one wins, other `409` |
| Citizen passes explicit `asset_code` for health service | Rejected or ignored — pool path only in PWA |
| All fleet units inactive | `available_units: 0`; citizen cannot proceed |
| Inactive single unit | Reduces pool count; hidden from assignment |

**Non-goals:** GPS dispatch; 108 network integration; **crematorium** booking (deferred).

---

### 8.5F — Health booking citizen API & PWA

> **Implementer plan:** [`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Fleet pool citizen APIs**         | Pooled availability + hold/quote/confirm via `service_code`; pickup address + contact on ambulance hold metadata. **No** per-vehicle list to citizens.                                |
| F2  | **`HealthBookingsWorkspace`**       | Health category → ambulance / hearse cards → `BookingWorkspace` `variant="fleet"` — **skip asset step**; show “**N units available**” for selected slot.                              |
| F3  | **Confirmation PDF variants**       | Ambulance (pickup time + location), hearse — **no vehicle name** on citizen PDF.                                                                                                      |
| F4  | **Tenant Admin calendar filter**    | Operations booking calendar: filter by `AMBULANCE` / `HEARSE`; row detail shows assigned unit code.                                                                                   |
| F5  | **Concurrency test**                | Two parallel holds on last free ambulance slot — exactly one succeeds.                                                                                                                |

**Edge cases:**

| Case | Expected behaviour |
| ---- | ------------------ |
| Non-emergency ambulance skips payment | Block confirm until stub pay settles |
| Emergency path attempts payment | Ignored / not offered in UI |
| Citizen deep-links hall asset for health service | `400` / `404` |
| Health booking confused with hall | Separate Health category + fleet pool UI (no asset names) |
| 0 units available for slot | Slot not selectable; message explains no fleet capacity |

**Non-goals:** Real-time ETA; multi-leg hearse routing; **crematorium** PWA; vehicle picker UX.

---

### 8.5F2 — Bookings portfolio & formatted receipts

> **Implementer plan:** [`master-sprint-85f2-plan.md`](./master-sprint-85f2-plan.md) · Exit: [`master-sprint-85f2-exit.md`](./master-sprint-85f2-exit.md)

**Insert before 8.5G.** Closes the gap where health/hall/LED bookings live in `booking_reservations` but citizens only see workflow **applications** in the PWA.

**Deliverables:**

| ID   | Deliverable | Detail |
| ---- | ----------- | ------ |
| F2-1 | **`GET /citizen/bookings`** | Citizen list of reservations (confirmed + optional holds); service_code from note; **no** health vehicle name on list |
| F2-2 | **PWA Applications / Bookings** | Rename nav tab; sub-tabs **My Applications** \| **My Bookings** (Hub + Workspace) |
| F2-3 | **My Bookings detail + receipt** | Download confirmation PDF from list detail |
| F2-4 | **PDFKit booking receipt** | Replace `renderSimplePdf` single-line blob with formatted layout (letterhead, sections, amounts) |
| F2-5 | **Admin dashboard Booking Summary** | Unified panel for **all** booking types (hall, LED, ambulance, hearse, parking) — counts + recent table |
| F2-6 | **Tests & smoke** | `smoke-citizen-my-bookings.mjs`; PDF + list unit tests |

**PDF root cause:** [`simple-pdf.ts`](../../apps/api/src/common/pdf/simple-pdf.ts) uses one `Tj` operator — `\n` is not interpreted as line breaks. Fix: **pdfkit** (same as [`lease-receipts.pdf.ts`](../../apps/api/src/modules/lease-receipts/lease-receipts.pdf.ts)).

**Non-goals:** Cancel-from-UI; hub booking_count KPI (stretch → 8.5G); separate payment receipt PDF.

---

### 8.5G — Phase 8 hardening (partial exit)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Security spec**                   | `tests/security/master-sprint-85.spec.ts` — tenant isolation on hoarding quote, LED/health bookings, **`GET /citizen/bookings`**, **`GET /admin/tenant/dashboard/booking-summary`** (8.5F2 F2-7); auth boundaries; **no tender/pension endpoints** (deferred).                     |
| G2  | **Perf / abuse caps**               | Document + enforce: quote rate limit (citizen), booking slot query max span, hoarding matrix max size — aligned with 8.1–8.2 patterns.                                                |
| G3  | **Combined smoke**                  | `scripts/smoke-sprint-85-adv-health.mjs` — hoarding quote → apply stub; LED book; ambulance book; regression legs for 8.1 hall + 8.2 smart-city (or call existing scripts).             |
| G4  | **Phase 8 partial exit runbook**    | `phase-8-partial-exit.md` — evidence for 8.1, 8.2, 8.5; **explicit deferred** table for tenders/pension; links all sprint exit docs.                                                  |
| G5  | **ROADMAP update**                  | Mark 8.5 closed when done; 8.3/8.4 remain **held**; Phase 8 EN-10 stays **in progress** until deferred slices ship or sponsor waives.                                                 |
| G6  | **Native mobile decision**          | Document PWA-only sign-off for 8.5 citizen surfaces; mobile deferral unchanged.                                                                                                         |

**Non-goals:** New feature scope in hardening slice; Phase 9 field app.

---

### 8.5H — Docs, tests, verification

**Deliverables:**

| ID  | Deliverable           | Detail                                                                                                                                                         |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Exit runbook**      | `master-sprint-85-exit.md` with evidence table + manual smoke sign-off.                                                                                        |
| H2  | **API unit tests**    | Hoarding quote boundaries, LED hold/confirm, health emergency waive, ambulance overlap guard.                                                                  |
| H3  | **Smoke scripts**     | `smoke-sprint-85-adv-health.mjs` + retain `hoarding-boc-e2e-smoke.mjs` + `smoke-sprint-82-smart-city.mjs` in regression matrix.                              |
| H4  | **Operator help**     | § hoarding rate matrix, LED asset setup, health fleet + emergency policy, BPL hearse note.                                                                       |
| H5  | **Sahayak seeds**     | Extend health booking help in `sahayak-service-help.seed.ts` (ambulance emergency disclaimer).                                                                 |

---

## Exit criteria

| ID  | Criterion                                                                 | Verification |
| --- | ------------------------------------------------------------------------- | ------------ |
| E1  | **Hoarding calculator** quote varies by ward/size/duration                  | Unit test + PWA manual |
| E2  | **`ad-hoarding` apply** still completes BOC workflow (no regression)      | `hoarding-boc-e2e-smoke.mjs` |
| E3  | **LED slot booking** confirm + PDF via bookings engine                    | `smoke-sprint-85-adv-health.mjs` |
| E4  | Citizen books **ambulance** slot E2E with confirmation PDF                  | same smoke |
| E5  | **Emergency ambulance** confirms with **₹0** payment + audit metadata       | API test + manual PWA |
| E6  | **Hearse** fleet-pool slot booking with stub pay                            | smoke + manual |
| E7  | **`master-sprint-85.spec.ts`** green + **81/82** specs green                | CI |
| E8  | **Partial Phase 8 exit** doc lists delivered vs deferred criteria         | `phase-8-partial-exit.md` |
| E9  | Operator help updated for advertising + health ops                        | HTML diff + admin public copy |
| E10 | `graphify update .` after API/UI code changes                             | Agent rule |

**Explicitly not exit criteria for 8.5 (deferred):** tender list ≥ 5; EMD held; vendor empanelment; pension disbursement rows.

---

## Out of scope (Sprint 8.5)

| Item | Target backlog |
| ---- | -------------- |
| **`ad-billboard` PWA** (`BillboardApplyWorkspace`) | **8.5D deferred** — future adv slice |
| **`crematorium` booking** | Future health slice — catalogue only |
| Tenders, EMD, form purchase, participations | Held **8.3A–B** / future **8.3′** |
| Vendor empanelment (`vendor-reg`) | Held **8.3C** |
| Deposit refund / security deposit | Held **8.3D** |
| Scrap sale lots | Held **8.3G** (EMD-tied) |
| Pension / widow / disability + disbursement | Held **8.4C–D** |
| Live PSP (**3.1B**) | Deferred globally |
| PFMS / NACH payout | v2 |
| Real IoT, OCPP, live meter SOAP | Phase 12 |
| Native mobile health/adv screens | Post-8.5 unless sponsor unpause |
| Smart waste, GIS licensing, rooftop solar | Later Phase 8+ |
| e-Tender portal integration | Deep link only when tenders ship |
| Push/SMS reminders | Out of scope |

---

## Dependencies

| Dependency                               | Status |
| ---------------------------------------- | ------ |
| Sprint 8.1 — bookings + PDF              | Closed (2026-06-03) |
| Sprint 8.2 — smart-city + pricing patterns | Closed (2026-06-18) |
| Phase 3 — payments (stub)                | Closed (3.1B deferred) |
| Phase 6 — fee rules + revenue heads      | Closed |
| Hoarding BOC workflow                    | Closed — must not regress |

---

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Hoarding calculator vs deferred fee confusion | Calculator informational + application metadata; payment at BOC approval only |
| Emergency ambulance abuse | Declaration checkbox + audit + 2/day rate limit + ops review flag |
| LED vs hall booking UX collision | Distinct `asset_type`, service mapping, PDF template labels |
| Health fleet contention | Seed ≥ 2 ambulance units; pooled availability + transactional auto-assign; citizen sees unit count not names |
| Citizen confused by vehicle list | Fleet pool UX — skip asset step; PDF omits unit name |
| Pricing matrix DSL creep | Whitelisted ward rows only; cap size; unit tests |
| Partial Phase 8 exit misread as full EN-10 close | `phase-8-partial-exit.md` deferred table + ROADMAP wording |
| Scope creep from held 8.3/8.4 | PR checklist references 8.5 plan only |

---

## Verification plan

```bash
pnpm --filter @enagar/api prisma:migrate:deploy
pnpm --filter @enagar/api prisma:generate
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/api test -- hoarding
pnpm --filter @enagar/api test -- bookings
pnpm --filter @enagar/admin-tenant typecheck
pnpm --filter @enagar/citizen-pwa typecheck
pnpm test:security -- master-sprint-85.spec.ts
pnpm test:security -- master-sprint-82.spec.ts
pnpm test:security -- master-sprint-81a.spec.ts master-sprint-81b.spec.ts master-sprint-81c.spec.ts master-sprint-81d.spec.ts master-sprint-81e.spec.ts master-sprint-81f.spec.ts
node scripts/smoke-sprint-85-adv-health.mjs
node scripts/smoke/hoarding-boc-e2e-smoke.mjs
node scripts/smoke-sprint-82-smart-city.mjs
graphify update .
```

---

## Manual smoke (after implementation)

1. `pnpm infra:up` · migrate · seed · API · Tenant Admin · Citizen PWA.
2. **Tenant Admin:** Set hoarding ward rate matrix; create 2 LED assets; seed 2 ambulances + 1 hearse under Health Bookings.
3. **Citizen — Hoarding:** Ward 12, 10×8 ft, 3 months → quote → apply `ad-hoarding` → desk BOC advances.
4. **Citizen — LED:** Pick board → free slot → pay → confirmation PDF.
5. **Citizen — Ambulance (paid):** See “2 units available” → pick slot (no vehicle name) → pickup address → pay → PDF.
6. **Citizen — Ambulance (emergency):** Declare emergency → confirm ₹0 → audit visible in admin session list.
7. **Citizen — Hearse:** Fleet pool book → optional BPL declare → pay → PDF (no van name on PDF).
8. **Admin:** Booking calendar shows which ambulance/hearse unit was auto-assigned.
9. **Regression:** Hall booking (8.1) + smart parking (8.2) smokes green.
10. **Security:** Cross-tenant hoarding quote / health fleet availability rejected.

---

## Decision defaults (locked for this sprint)

| Topic | Decision |
| ----- | -------- |
| Active slice | **8.5** replaces held **8.3 + 8.4** for implementation |
| Payment rail | **Stub only** (3.1B out of scope) |
| Hoarding tax basis | **sqft × months × ward rate**; dimensions from citizen |
| Hoarding payment timing | **Deferred** at approval (existing BOC) |
| LED slots | Reuse **8.1 bookings**; `rate_unit: HOUR` default |
| Health booking engine | Reuse **8.1 bookings** + **fleet pool** auto-assign — no parallel scheduler |
| Health citizen UX | **No vehicle picker** — pooled calendar + `available_units` count |
| Ambulance emergency | **₹0 rent** + declaration + 2/day cap |
| Hearse BPL | **Desk verification** v1 |
| Crematorium | **Deferred** — not in 8.5E/F seed or PWA |
| `ad-billboard` | **Deferred (8.5D)** |
| Phase 8 closure | **Partial** — `phase-8-partial-exit.md`; EN-10 remains open |
| Pilot tenant | **KMC** for matrix, LED, health fleet |
| Held plans | **8.3 / 8.4** unchanged on disk; status **held** |

---

## Jira

- Parent: [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) — Bookings, Smart-City & Tender Modules
- Sub-task: [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24) — Sprint 8.5 — Advertising, health bookings & Phase 8 hardening (merged 8.3+8.4)

---

_Last updated: 2026-06-18 — product refinement: **8.5D** and **crematorium** deferred; health **fleet pool** UX (no citizen vehicle picker). Sub-plans: [`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md), [`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md)._
