# Master Sprint 8.1 Plan — Bookings calendar, hourly slots & deposit linkage

**Status:** **closed — engineering (2026-06-03)** · Exit record: [`master-sprint-81-exit.md`](./master-sprint-81-exit.md) · Jira [**EN-15**](https://ghochangfu.atlassian.net/browse/EN-15) **Done**  
**Phase:** 8 — Bookings, Smart-City & Tenders · Jira [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10)  
**ROADMAP:** [§ Phase 8](../../ROADMAP.md#phase-8--bookings-smart-city--tender-modules) · Slice **8.1**  
**Builds on:** Sprint **6.11** ([`master-sprint-611-exit.md`](./master-sprint-611-exit.md)) — bookable assets MVP (admin-only)  
**Architecture:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Bookings — Calendar-Based Inventory

---

## Primary user story (non-negotiable)

> As a **citizen** booking a **community hall**, I open a **calendar** for that hall, see **hour-by-hour** which slots are **free or already taken**, select **only a free slot**, see rent + deposit, **pay**, and receive a **confirmation PDF** — so I can plan my event before money is taken.

**Flow order (must not be reversed):**

```text
See hourly availability on calendar → select free slot → quote → pay deposit → confirm & lock slot → PDF
```

Deposit payment must **not** precede visible slot availability.

---

## Objective

Productionise the **citizen booking path** for tenant bookable assets (starting with **community hall**), with:

1. **Hour-wise** slot discovery and booking (`rate_unit: HOUR` as the default for hall MVP).
2. **Calendar UI** (citizen + tenant admin) driven by merged availability, blackouts, and reservations.
3. **Deposit linkage** via existing `deposits` + **stub payment** rail (Sprint 3.1B PSP remains deferred).
4. **Booking confirmation PDF** after successful confirm.

Extend — do not replace — the Sprint 6.11 admin MVP (`bookable_assets`, `bookable_asset_availability`, `booking_reservations`).

---

## What already exists (do not re-build)

| Area                    | Evidence                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Tables + RLS            | `bookable_assets`, `bookable_asset_availability`, `booking_reservations`                           |
| Overlap guard (partial) | Unique index on `(tenant_id, asset_id, starts_at, ends_at)` where `status IN ('hold','confirmed')` |
| Tenant Admin APIs       | `GET/PATCH …/admin/tenant/bookings/*`                                                              |
| Operations UI           | JSON forms + list labelled “Booking calendar” (not a real grid)                                    |
| Global service          | `community-hall` · category `bookings` · workflow pattern `booking` · revenue head `booking-fee`   |
| Deposits                | `deposits` + `FinanceDepositsService` + stub payments                                              |

### Known gaps to close in 8.1

- No **citizen** booking or availability APIs/UI.
- Reservations are **not** required to fall inside an `available` window (only blackouts + overlap checked today).
- No `rate_unit`, hourly slot generator, or pricing/deposit fields on assets.
- No `deposit_id` / `citizen_id` / `booking_no` on reservations.
- No confirmation PDF for bookings.
- Admin “calendar” is a **list**, not month/week/**hour** grid.

---

## Key existing surfaces

- `apps/api/src/modules/admin-tenant/admin-tenant.service.ts` — `listBookableAssets`, `assertBookableWindow`, reservations
- `apps/admin-tenant/app/dashboard/operations/operations-client.tsx` — Bookings tab (JSON)
- `apps/api/src/modules/finance/` — deposits lifecycle, stub payment capture
- `apps/api/src/modules/services/service-catalogue.seed.ts` — `community-hall`
- `apps/citizen-pwa` — service apply spine; bookings category icon exists; no booking calendar yet
- `packages/workflow` — `booking` pattern (reuse for application-linked path where needed)

---

## Sub-sprints

### 8.1A — Schema, asset config & slot model

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Asset commercial + slot config**  | Extend `bookable_assets` (columns and/or validated `metadata`): `asset_type` (`HALL`, `AUDITORIUM`, `GROUND`, `EQUIPMENT`), `rate_unit` (`HOUR` required for hall MVP; `DAY` optional for future assets), `base_rate_paise`, `security_deposit_paise`, `slot_step_minutes` (default 60), `rules` JSON (`min_duration_minutes`, `max_duration_minutes`, `advance_booking_hours`, cancellation policy). |
| A2  | **Reservation identity**            | Add `booking_no` (tenant-scoped), `citizen_id` (FK), `deposit_id` (FK nullable), `cancelled_at`, `cancel_reason`. Keep `application_id` / `docket_no` for workflow-linked bookings.                                                                                                                                                                                                                   |
| A3  | **Service ↔ asset link**            | Tenant config linking `community-hall` (and future booking services) to `bookable_asset` code — e.g. `tenant_services.override_config.bookable_asset_code`.                                                                                                                                                                                                                                           |
| A4  | **Anti-double-booking (hardening)** | Add GiST `EXCLUDE` on `tstzrange(starts_at, ends_at)` for active statuses per `ARCHITECTURE.md`, or equivalent constraint tested under concurrency; retain app-level checks.                                                                                                                                                                                                                          |
| A5  | **Enforce `available` windows**     | Update `assertBookableWindow`: booking range must lie inside at least one overlapping `kind = 'available'` window for that asset (unless sponsor waives for pilot seed only).                                                                                                                                                                                                                         |
| A6  | **Seed**                            | KMC sample hall asset with hourly availability (e.g. 09:00–21:00 weekdays), linked to adopted `community-hall` tenant service.                                                                                                                                                                                                                                                                        |

**Non-goals:**

- Full recurring RRULE engine.
- Cross-tenant asset sharing.

---

### 8.1B — Availability API & hourly slot generation

**Deliverables:**

| ID  | Deliverable                             | Detail                                                                                                                                                                                                                                                          |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **`GET …/bookings/assets`**             | Citizen + public: list active bookable assets for tenant (code, localized name, location, `rate_unit`).                                                                                                                                                         |
| B2  | **`GET …/bookings/assets/:code/slots`** | Query `from` / `to` (ISO dates). Server merges `available` windows, subtracts `blackout` and `hold`/`confirmed` reservations, emits **discrete bookable slots** at `slot_step_minutes` granularity. Each slot: `starts_at`, `ends_at`, `status: free \| taken`. |
| B3  | **`POST …/bookings/quote`**             | Input: asset code + selected slot range. Output: `rent_paise` (hourly rate × duration), `deposit_paise`, `total_daise`, revenue head code. Whitelisted math only — no pricing DSL.                                                                              |
| B4  | **`POST …/bookings/holds`**             | Create `hold` for citizen + exact window; validate B2 slot still free; TTL optional (e.g. 15 min) documented in runbook.                                                                                                                                        |
| B5  | **`POST …/bookings/holds/:id/confirm`** | After deposit captured → `confirmed`; assign `booking_no`.                                                                                                                                                                                                      |
| B6  | **`POST …/bookings/:id/cancel`**        | Citizen (own booking) or staff; apply per-asset cancellation rules.                                                                                                                                                                                             |
| B7  | **Tenant isolation + auth**             | Citizen JWT + `tenant_code`; staff routes unchanged; extend `tests/security/tenant-isolation.spec.ts` for new tables/fields.                                                                                                                                    |

**Slot algorithm (document in exit runbook):**

1. Expand `available` ranges in `[from, to]`.
2. Remove `blackout` ranges.
3. Remove existing `hold` / `confirmed` ranges.
4. Split remainder into steps of `slot_step_minutes` (default 60).
5. Mark each step `free` or `taken` (adjacent multi-hour selection merges on client before hold).

**Non-goals:**

- Real-time WebSocket updates (refresh on navigation is enough for v1).
- Smart-parking / sensor pricing (Sprint 8.2).

---

### 8.1C — Deposit & stub payment linkage

**Deliverables:**

| ID  | Deliverable                      | Detail                                                                                                                                                                                                   |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Deposit on hold/confirm path** | Create `deposits` row (`deposit_type: `hall_booking`or`booking_security`), `citizen_id`, `amount_paise`from asset,`reference_code`=`booking_no`, link `booking_reservations.deposit_id`.                 |
| C2  | **Pay before confirm**           | Citizen flow: after hold → `POST /payments/initiate` + stub complete (existing rail) → deposit `held` with `capture_payment_id` → then confirm reservation.                                              |
| C3  | **Zero-deposit path**            | If `security_deposit_paise = 0`, skip payment gate but still confirm slot.                                                                                                                               |
| C4  | **Rent fee (optional v1)**       | If rent > 0, either separate payment line item or combined stub payment document in metadata; minimum: deposit captured for exit criteria. Full rent settlement can follow confirm in same stub session. |

**Non-goals:**

- Sprint **3.1B** live PSP.
- PFMS refund integration (finance staff APIs remain).

---

### 8.1D — Confirmation PDF

**Deliverables:**

| ID  | Deliverable                                      | Detail                                                                                                                                                                                   |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **`GET …/bookings/:bookingNo/confirmation.pdf`** | Citizen-authenticated, tenant-scoped. Template: ULB name, asset, slot (date + **hours**), `booking_no`, amounts, status, generated at. Reuse HTML→PDF approach from Sprint 6.11 reports. |
| D2  | **PWA download**                                 | Post-confirm screen: “Download confirmation” + display `booking_no`.                                                                                                                     |

**Non-goals:**

- Email/SMS delivery (notification templates later).

---

### 8.1E — UI: hourly calendar (citizen + tenant admin)

**Deliverables:**

| ID  | Deliverable                         | Detail                                                                                                                                                                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **Citizen PWA — booking flow**      | Entry: Bookings category and/or `community-hall` apply path. Steps: pick asset → **month/week calendar + day view with hour grid** (free vs taken) → select contiguous hours (respect min/max) → quote → pay → confirm → PDF. Use B2 slot API; disable taken cells. |
| E2  | **Tenant Admin — calendar upgrade** | Replace list-only “Booking calendar” with **calendar component** (ROADMAP: React Big Calendar or FullCalendar): view reservations + blackouts per asset; filter by asset. Keep or improve guided asset/availability forms (reduce raw ISO JSON as default).         |
| E3  | **Admin asset form**                | Guided fields: `rate_unit` (default **HOUR** for new halls), `slot_step_minutes`, open hours template, deposit, base hourly rate, min/max duration.                                                                                                                 |
| E4  | **Accessibility**                   | Taken slots not focusable; selected slot announced; locale dates (en/bn where applicable).                                                                                                                                                                          |

**Non-goals:**

- Native mobile booking UI (defer to 8.4 unless time allows).
- Marketplace / multi-asset cart.

---

### 8.1F — Application / workflow touchpoint (minimal)

**Deliverables:**

| ID  | Deliverable                  | Detail                                                                                                                                                                                           |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | **Link hold to application** | When citizen applies for `community-hall`, form captures desired slot (or deep-link from calendar); `application_id` set on reservation; workflow `booking` pattern unchanged for officer steps. |
| F2  | **No regression**            | Non-booking services and existing apply flows remain green in CI.                                                                                                                                |

**Non-goals:**

- Redesigning full workflow designer for bookings.

---

### 8.1G — Docs, tests, verification

**Deliverables:**

| ID  | Deliverable           | Detail                                                                                                                                                    |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Exit runbook**      | `master-sprint-81-exit.md` with evidence table + manual smoke sign-off.                                                                                   |
| G2  | **Security contract** | `tests/security/master-sprint-81.spec.ts` — tenant isolation, slot API shape, overlap rejection, deposit linkage, PDF auth, hourly `rate_unit` on assets. |
| G3  | **API unit tests**    | Hold/confirm/cancel, slot generation, available-window enforcement, quote math, blackout respect.                                                         |
| G4  | **DB tests**          | Overlap + GiST/unique under `RUN_DB_TESTS=1` where practical.                                                                                             |
| G5  | **Smoke script**      | `scripts/smoke-sprint-81-bookings.mjs` — seed hall → list slots → hold free hour → stub pay → confirm → PDF 200 → second hold same hour fails.            |
| G6  | **README / help**     | `apps/citizen-pwa/README.md`, `apps/admin-tenant/README.md`, operator help § hourly hall booking.                                                         |
| G7  | **ROADMAP queue row** | Add **8.1** closed line under Phase 8 when done.                                                                                                          |

---

## Exit criteria

| ID  | Criterion                                                                  | Verification                   |
| --- | -------------------------------------------------------------------------- | ------------------------------ |
| E1  | Citizen sees **hour grid** for hall; **taken hours not selectable**        | Manual PWA + component test    |
| E2  | Citizen books **only a free hourly slot** end-to-end                       | `smoke-sprint-81-bookings.mjs` |
| E3  | Second booking overlapping same hour **rejected**                          | API test + smoke               |
| E4  | Booking **inside `available` window** enforced                             | API test                       |
| E5  | **Deposit** created and **stub-captured** before `confirmed`               | API + deposit status           |
| E6  | **Confirmation PDF** returns 200 with correct `booking_no` and hour range  | HTTP smoke                     |
| E7  | Tenant Admin **calendar view** shows confirmed reservation on correct hour | Manual Operations              |
| E8  | `pnpm test:security -- master-sprint-81.spec.ts` green                     | CI                             |
| E9  | No regression: `master-sprint-611.spec.ts` + core citizen apply tests      | CI                             |
| E10 | `graphify update .` after API/UI code changes                              | Agent rule                     |

---

## Out of scope (Sprint 8.1)

Defer to **8.2–8.4** per [`ROADMAP.md`](../../ROADMAP.md):

- Smart parking, EV charging, IoT water meter, waste subscription
- Tenders / EMD / vendor empanelment
- Hoarding rate calculator / LED slot calendar
- Welfare / health (ambulance, crematorium) bookings
- Extended zone/time/kWh **pricing-rule engine** (hourly hall rent + fixed deposit only)
- Live payment gateway (**3.1B**)
- Staff rostering, recurring RRULE CMS, booking marketplace
- Push/email notifications for booking confirmations

---

## Dependencies

| Dependency                                      | Status                      |
| ----------------------------------------------- | --------------------------- |
| Phase 2 — workflow / forms                      | Closed                      |
| Phase 3 — deposits + stub payments              | Closed (3.1B deferred)      |
| Phase 6 — fee / revenue heads                   | Closed                      |
| Sprint 6.11 — bookable asset tables + admin MVP | Closed                      |
| Phase 7                                         | Closed — does not block 8.1 |

---

## Risks & mitigations

| Risk                                  | Mitigation                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Calendar UX complexity                | Use established library (FullCalendar / React Big Calendar); hour view only for v1 hall |
| Slot API performance over long ranges | Cap `from`/`to` span (e.g. 31 days); paginate by week in UI                             |
| Race: two citizens same hour          | Short `hold` TTL + DB exclusion constraint + confirm only after pay                     |
| 6.11 JSON admin UX confusion          | Guided asset form + calendar; keep JSON fallback                                        |
| `available` window not enforced today | Explicit 8.1A5 + tests                                                                  |

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
pnpm test:security -- --runTestsByPath tests/security/master-sprint-81.spec.ts tests/security/master-sprint-611.spec.ts
node scripts/smoke-sprint-81-bookings.mjs
graphify update .
```

---

## Manual smoke (after implementation)

1. `pnpm infra:up` · migrate · seed · API · Tenant Admin · Citizen PWA.
2. **Tenant Admin:** Create hall asset with `rate_unit: HOUR`, step 60, deposit, hourly rate; add weekday `available` 09:00–21:00; add one-hour blackout; view **calendar** — blackout visible.
3. **Citizen PWA:** OTP login KMC → Bookings / Community Hall → pick date → hour grid shows free/taken → select 2 consecutive free hours → quote → stub pay deposit → confirm.
4. Download **confirmation PDF** — matches selected hours and `booking_no`.
5. **Second citizen** (or same after cancel): same hour shows **taken**; cannot select.
6. **Tenant Admin:** Reservation appears on calendar at correct time.
7. Regression: file unrelated service application; still works.

---

## Decision defaults (locked for this sprint)

| Topic              | Decision                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Slot granularity   | **Hour-wise required** for community hall MVP (`rate_unit: HOUR`, `slot_step_minutes: 60`) |
| Citizen flow order | **Calendar → slot → pay → confirm** (never pay before visibility)                          |
| Payment rail       | **Stub only** (3.1B out of scope)                                                          |
| Pilot service      | **`community-hall`** linked to one seeded hall asset per tenant                            |
| Day-only booking   | Optional later per asset; **not** sufficient alone for hall exit                           |
| Calendar library   | Pick one in implementation (FullCalendar or React Big Calendar); document in exit          |
| Hold TTL           | 15 minutes default (configurable constant); documented in exit                             |

---

## Jira

- Parent: [**EN-10**](https://ghochangfu.atlassian.net/browse/EN-10) — Bookings, Smart-City & Tender Modules
- Sub-task: [**EN-15**](https://ghochangfu.atlassian.net/browse/EN-15) — Sprint 8.1 — Hourly booking calendar, deposit linkage & confirmation PDF

---

_Last updated: 2026-06-03 — drafted from Phase 8 ROADMAP slice 8.1 and product review (hourly slots before pay)._
