# Master Sprint 8.4 Plan — Welfare, health bookings & Phase 8 hardening

> **HELD (2026-06-18)** — Do **not** implement this slice as written. **Health bookings** and **Phase 8 hardening** (adjusted) moved to active **[`master-sprint-85-plan.md`](./master-sprint-85-plan.md)**. **Pension / widow / disability** applications and **disbursement import** remain here for a **future welfare slice**. Health UX in **8.5** differs from this file: **fleet pool** (no citizen vehicle picker), **no crematorium** — see [`master-sprint-85e-plan.md`](./master-sprint-85e-plan.md). This file is retained as reference only.

**Status:** **held** — superseded for implementation by **8.5** · Original exit: [`master-sprint-84-exit.md`](./master-sprint-84-exit.md) _not started_  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)  
**ROADMAP:** [§ Phase 8](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Slice **8.4**  
**Builds on:** Sprint **8.3** ([`master-sprint-83-plan.md`](./master-sprint-83-plan.md) / exit _TBD_) — tenders, vendor empanelment, hoarding/LED; Sprint **8.2** — smart-city; Sprint **8.1** ([`master-sprint-81-exit.md`](./master-sprint-81-exit.md)) — bookings calendar engine  
**Architecture:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Bookings — Calendar-Based Inventory · [`docs/service-catalogue.md`](../service-catalogue.md) § `booking`, `pension` patterns

---

## Primary user stories (non-negotiable)

### Health bookings

> As a **citizen**, I book an **ambulance**, **hearse van**, or **crematorium slot** on a **calendar**, pay the listed fee (or **free for emergency ambulance** when flagged), and receive a **confirmation PDF** — using the same booking experience as community hall.

### Welfare pensions

> As a **citizen**, I apply for **old-age / widow / disability pension** with income proof, track officer verification, and once approved see **monthly disbursement status** — so I know whether this month's pension was credited.

### Phase 8 hardening

> As **engineering**, all Phase 8 modules pass a **consolidated security contract**, **cross-sprint smoke suite**, and **ROADMAP Phase 8 exit criteria** — so EN-10 can close with evidence.

**Flow order (health booking — must not be reversed):**

```text
Pick service (ambulance/hearse/crematorium) → calendar/slot → quote → pay (or emergency waive) → confirm → PDF
```

**Flow order (pension — must not be reversed):**

```text
Submit application + income cert → field verify → officer approve → scheduled disbursement → citizen status view
```

---

## Objective

Close Phase 8 by productionising **welfare** and **health** citizen paths and running a **hardening pass** across all 8.x slices:

| Service code         | Pattern   | Sprint 8.4 focus                                           |
| -------------------- | --------- | ---------------------------------------------------------- |
| `ambulance`          | `booking` | Asset + slot booking; emergency free path                  |
| `hearse`             | `booking` | Slot booking; BPL subsidy flag in metadata (manual v1)     |
| `crematorium`        | `booking` | Slot booking (ground/crematorium unit as bookable asset)   |
| `pension`            | `pension` | Old-age application + workflow                             |
| `widow-pension`      | `pension` | Widow application + workflow                               |
| `disability-pension` | `pension` | Disability application + workflow                          |
| _(cross-cutting)_    | —         | Security, smoke, perf caps, ROADMAP exit, EN-10 closure    |

Extend — do not replace — Sprint **8.1** `bookings` module, existing workflow/forms spine, and Sprint **8.3** tender/ad surfaces.

---

## What already exists (do not re-build)

| Area                         | Evidence                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Bookings engine (8.1)        | Slots, holds, confirm, deposit/stub pay, confirmation PDF, `BookingWorkspace`                 |
| Service catalogue            | `ambulance`, `hearse`, `crematorium` (`booking`); three `pension` services in catalogue       |
| Workflow patterns            | `booking`, `pension` documented in `docs/service-catalogue.md` §4.3, §4.4                     |
| Application + workflow spine | Phase 2 apply, desk queue, timeline, certificate issue                                        |
| Finance / payments           | Stub rail, receipts, revenue head resolution                                                  |
| Sahayak help seeds           | `sahayak-service-help.seed.ts` — pension FAQ stub                                             |
| Phase 8 sprint specs         | `master-sprint-81.spec.ts`, `master-sprint-82.spec.ts` (planned), `master-sprint-83.spec.ts` (planned) |

### Known gaps to close in 8.4

- No **bookable assets** linked to `ambulance`, `hearse`, `crematorium` services.
- No citizen **Health** category booking UI (catalogue entries exist only).
- No **`pension` workflow** instances seeded per tenant (submit → field-verify → approve → disburse).
- No **`pension_disbursements`** table or citizen disbursement status view.
- No **monthly Excel/CSV import** for disbursement records (ROADMAP v1).
- No **Phase 8 consolidated** security spec or exit runbook.
- **Native mobile** booking screens still deferred — document decision in exit.

---

## Key existing surfaces

- `apps/api/src/modules/bookings/` — reuse for health slots
- `apps/citizen-pwa/components/booking-workspace.tsx` — calendar UX reference
- `apps/api/src/modules/services/service-catalogue.seed.ts` — health/welfare service defs (partial)
- `apps/api/src/modules/applications/` — apply spine for pension services
- `packages/workflow` — `booking`, `pension` patterns
- `apps/admin-tenant/app/dashboard/operations/` — asset CRUD shell for health fleet/crematorium units

---

## Sub-sprints

### 8.4A — Health bookable assets & schema

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                                 |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Fleet / facility assets**         | Seed `bookable_assets`: `asset_type` (`AMBULANCE`, `HEARSE`, `CREMATORIUM`), `rate_unit: HOUR`, `base_rate_paise`, `security_deposit_paise: 0`, slot windows per service.                              |
| A2  | **Service ↔ asset link**            | `tenant_services.override_config.bookable_asset_codes` for `ambulance`, `hearse`, `crematorium`.                                                                                                        |
| A3  | **Emergency ambulance flag**        | Booking hold API accepts `emergency: true` → `rent_paise = 0`, skip payment gate, still confirm slot (audit metadata). UI requires explicit emergency declaration.                                      |
| A4  | **BPL subsidy hook (hearse)**       | Optional `bpl_subsidy_paise` on asset metadata; citizen declares BPL + uploads card → officer verifies offline; quote adjusted before pay (v1: staff desk override).                                    |
| A5  | **Admin CRUD**                      | Operations → Health Bookings: manage fleet count (e.g. 2 ambulances, 1 hearse, 1 crematorium slot pool).                                                                                              |
| A6  | **Seed**                            | KMC: ambulance fleet assets, one hearse, crematorium slot pool with weekday availability.                                                                                                                |

**Non-goals:**

- GPS dispatch / live fleet tracking.
- Integration with 108 emergency network.

---

### 8.4B — Health booking citizen API & PWA

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Reuse bookings APIs**             | `GET …/bookings/assets`, slots, quote, hold, confirm, PDF — filtered to health-linked assets when entered via service code.                                                           |
| B2  | **`HealthBookingsWorkspace`**       | Citizen PWA Health category → service cards → `BookingWorkspace` with service-specific copy (pickup address field on ambulance form).                                                 |
| B3  | **Confirmation PDF**                | Template variants: ambulance (pickup time + location), hearse, crematorium slot — extend existing PDF generator.                                                                      |
| B4  | **Tenant Admin calendar**           | Operations calendar shows health reservations distinct from halls/parking (asset type filter).                                                                                        |
| B5  | **Anti-double-booking**             | Same GiST/overlap guards as 8.1; concurrency test for single ambulance unit.                                                                                                          |

**Non-goals:**

- Real-time ambulance ETA.
- Multi-leg hearse routing.

---

### 8.4C — Welfare pension applications

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **Workflow seed**                   | Per tenant: `pension`, `widow-pension`, `disability-pension` workflows matching catalogue pattern (submit → field-verify → bank-validate → officer-approve → schedule-disbursement). |
| C2  | **Citizen apply**                   | PWA Welfare category → three service cards → forms with `income-cert`, identity, bank account (IFSC + account no.).                                          |
| C3  | **Desk queue**                      | Ward inspector field-verify stage; officer approve; certificate / approval letter metadata.                                                                  |
| C4  | **`pension_beneficiaries` table**   | On approval: `citizen_id`, `service_code`, `beneficiary_no`, `bank_account` JSON (encrypted/masked display), `status` (`ACTIVE`, `SUSPENDED`, `CLOSED`).     |
| C5  | **Seed**                            | KMC workflow templates + designation mapping (welfare department).                                                                                           |

**Non-goals:**

- PFMS / NACH live disbursement file generation.
- Automatic bank account verification API.

---

### 8.4D — Disbursement status (read-only v1)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                          |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **`pension_disbursements` table**   | `beneficiary_id`, `disbursement_month` (`YYYY-MM`), `amount_paise`, `status` (`SCHEDULED`, `CREDITED`, `FAILED`), `reference?`, `import_batch_id?`.                                             |
| D2  | **Admin CSV import**                | Tenant Admin → Welfare → Import disbursements: upload CSV (`beneficiary_no`, month, amount, status); validate; upsert batch.                                                                    |
| D3  | **`GET …/pensions/my-disbursements`** | Citizen JWT: list disbursement rows for linked beneficiaries (last 24 months).                                                                                                                  |
| D4  | **PWA status view**                 | “My pensions” → per scheme monthly grid (credited / failed / pending).                                                                                                                          |
| D5  | **Sample seed**                     | 3 months history for demo beneficiaries.                                                                                                                                                        |

**Non-goals:**

- BullMQ recurring disbursement cron (catalogue mentions — defer until PFMS adapter).
- Citizen dispute/reopen on failed disbursement (grievance link only).

---

### 8.4E — Phase 8 hardening & EN-10 exit

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **Consolidated security spec**      | `tests/security/master-sprint-84.spec.ts` — cross-tenant probes on bookings, smart-city, tenders, health, welfare endpoints; auth boundary table.                                       |
| E2  | **Perf / abuse caps**               | Document and enforce API span caps (slot `from`/`to`, tender list pagination, quote rate limits) consistent across 8.1–8.3.                                                           |
| E3  | **Combined smoke runner**           | `scripts/smoke-sprint-84-phase8-exit.mjs` — orchestrates hall, parking, tender, hoarding quote, health book, pension disbursement read.                                               |
| E4  | **Regression matrix**               | CI job runs `master-sprint-81` + `82` + `83` + `84` security specs in one path.                                                                                                       |
| E5  | **Phase 8 exit runbook**            | `phase-8-exit.md` — ROADMAP exit criteria evidence table; links all four sprint exit docs.                                                                                            |
| E6  | **ROADMAP update**                  | Mark Phase 8 slices 8.1–8.4 closed; note deferred items (3.1B, native mobile, PFMS, real IoT).                                                                                      |
| E7  | **Native mobile decision**          | Document deferral to post-8.4 backlog unless sponsor unpause; PWA-only sign-off for Phase 8.                                                                                          |

**Non-goals:**

- New feature scope beyond welfare/health + hardening.
- Phase 9 field app work.

---

### 8.4F — Docs, tests, verification

**Deliverables:**

| ID  | Deliverable           | Detail                                                                                                                                                         |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Exit runbook**      | `master-sprint-84-exit.md` with evidence table + manual smoke sign-off.                                                                                        |
| F2  | **API unit tests**    | Health emergency waive, hearse quote, pension beneficiary create on approve, disbursement import validation.                                                     |
| F3  | **Smoke script**      | `scripts/smoke-sprint-84-welfare-health.mjs` — ambulance book → PDF; pension apply stub; disbursement list non-empty after import.                             |
| F4  | **README / help**     | Operator help § health fleet setup, pension import CSV format, emergency booking policy.                                                                       |
| F5  | **Sahayak seeds**     | Extend pension/health help entries in `sahayak-service-help.seed.ts`.                                                                                          |

---

## Exit criteria

| ID  | Criterion                                                                 | Verification                              |
| --- | ------------------------------------------------------------------------- | ----------------------------------------- |
| E1  | Citizen books **ambulance** slot end-to-end with confirmation PDF           | `smoke-sprint-84-welfare-health.mjs`      |
| E2  | **Emergency ambulance** path confirms with **zero payment**                   | API test + manual PWA                     |
| E3  | **Hearse** and **crematorium** slot booking work with stub pay                | Smoke + manual                            |
| E4  | **Pension application** reaches officer-approve stage in desk                 | Manual desk + API test                    |
| E5  | Approved beneficiary sees **≥ 1 disbursement row** after CSV import         | Admin import + citizen PWA                |
| E6  | **`master-sprint-84.spec.ts`** green + **81/82/83** specs green               | CI                                        |
| E7  | **`smoke-sprint-84-phase8-exit.mjs`** passes (full Phase 8 journey)           | Smoke                                     |
| E8  | **ROADMAP Phase 8 exit criteria** met (hall, parking stub, tender list)       | `phase-8-exit.md` evidence table          |
| E9  | `graphify update .` after API/UI code changes                               | Agent rule                                |

---

## Out of scope (Sprint 8.4)

Per [`ROADMAP.md`](../../ROADMAP.md) and prior 8.x deferrals:

- Live payment gateway (**3.1B**)
- PFMS integrated pension payout / NACH files
- Real IoT, OCPP, live water meter SOAP (Phase 12)
- Native mobile apps for health/welfare (PWA only unless sponsor unpause)
- Smart waste, GIS licensing, rooftop solar, telecom NOC (Phase 8 long tail → later phases)
- e-Tender e-procurement integration
- Push/SMS for pension credited or ambulance dispatch
- Staff mobile / field enforcement (Phase 9)

---

## Dependencies

| Dependency                               | Status                 |
| ---------------------------------------- | ---------------------- |
| Sprint 8.1 — bookings engine               | Closed (2026-06-03)    |
| Sprint 8.2 — smart-city                    | Planned / in progress  |
| Sprint 8.3 — tenders + hoarding/LED        | Planned                |
| Phase 2 — workflow / forms                 | Closed                 |
| Phase 3 — payments (stub)                  | Closed (3.1B deferred) |
| Phase 6 — fee / revenue heads              | Closed                 |

---

## Risks & mitigations

| Risk                                   | Mitigation                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Emergency ambulance abuse              | Explicit citizen declaration + audit log; rate limit per citizen/day      |
| Single ambulance asset bottleneck      | Seed multiple units; overlap guard per asset not fleet                  |
| Pension PII in bank fields             | Mask account in API responses; encrypt at rest if column added          |
| CSV import errors                      | Dry-run preview + batch id; reject rows with unknown beneficiary_no     |
| Phase 8 scope creep in “hardening”     | E5 exit doc lists deferred items; no new features in 8.4E               |
| Health booking UX confusion with halls | Separate Health category; asset_type filter; distinct PDF templates     |

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
pnpm test:security -- --runTestsByPath tests/security/master-sprint-84.spec.ts tests/security/master-sprint-83.spec.ts tests/security/master-sprint-82.spec.ts tests/security/master-sprint-81.spec.ts
node scripts/smoke-sprint-84-welfare-health.mjs
node scripts/smoke-sprint-84-phase8-exit.mjs
graphify update .
```

---

## Manual smoke (after implementation)

1. `pnpm infra:up` · migrate · seed · API · Tenant Admin · Citizen PWA.
2. **Tenant Admin:** Seed ambulance/hearse/crematorium assets; import pension disbursement CSV for demo beneficiaries.
3. **Citizen PWA — Ambulance:** Book non-emergency slot → pay → PDF with pickup details.
4. **Citizen PWA — Ambulance emergency:** Declare emergency → confirm without payment → PDF shows ₹0.
5. **Citizen PWA — Hearse / Crematorium:** Book slot → pay → PDF.
6. **Citizen PWA — Pension:** Apply old-age pension → desk field-verify → approve → beneficiary created.
7. **Citizen PWA — Disbursements:** Open My pensions → see imported months.
8. **Phase 8 regression:** Run combined smoke (hall, parking, tender, LED, health) — all green.
9. **Security:** Cross-tenant health asset list returns 403/empty.

---

## Decision defaults (locked for this sprint)

| Topic                 | Decision                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| Health booking engine | **Reuse 8.1 bookings module** — no parallel scheduler                    |
| Ambulance emergency   | **₹0 rent** with citizen declaration; officer audit optional             |
| Hearse BPL subsidy    | **Manual desk verification** v1; metadata flag only                      |
| Pension disbursement  | **CSV import** monthly; citizen view **read-only**                       |
| PFMS                  | **Out of scope** — document v2 integration point in exit                 |
| Native mobile         | **Deferred** — PWA sign-off closes Phase 8 citizen surface               |
| Pilot tenant          | **KMC** for health assets, pension workflows, sample disbursements       |
| Payment rail          | **Stub only** (3.1B out of scope)                                        |
| Phase 8 closure       | **`phase-8-exit.md`** + EN-10 comment with links to four sprint exits    |

---

## Jira

- Parent: [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) — Bookings, Smart-City & Tender Modules
- Sub-task: _TBD_ — Sprint 8.4 — Welfare, health bookings & hardening

---

_Last updated: 2026-06-17 — drafted from Phase 8 ROADMAP slice 8.4, service catalogue health/welfare patterns, and Sprint 8.1 bookings foundation._
