# Master Sprint 8.5F2 Implementation Plan — Bookings portfolio & formatted receipts

> **For implementers:** Execute **F2-1 → F2-8** after **8.5F** ([`master-sprint-85f-plan.md`](./master-sprint-85f-plan.md)) is merged and **before** **8.5G** hardening ([`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5G). Exit evidence: [`master-sprint-85f2-exit.md`](./master-sprint-85f2-exit.md).

**Goal:** Citizens see confirmed bookings under **Applications/Bookings → My Bookings** with downloadable receipts; admins get a unified **Booking Summary** on the dashboard for **all** booking types; booking confirmation PDFs are properly formatted (not a single text blob).

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5F2 · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Status:** **complete** (F2-7 → 8.5G; F2-8 done)

---

## Problem statement

| Gap | Today | Target |
| --- | ----- | ------ |
| Citizen history | Ambulance/hearse/hall/LED bookings live in `booking_reservations` only — **not** in My Applications | **My Bookings** list + receipt download |
| Nav label | Tab says **Applications** | **Applications / Bookings** with sub-tabs |
| Admin counts | Health fleet visible only via Operations calendar filter | **Dashboard → Booking Summary** (all asset types) |
| PDF quality | `renderSimplePdf` emits **one** PDF `Tj` operator; `\n` is literal — entire receipt is one unformatted line | **PDFKit** layout (letterhead, sections, line breaks) like lease receipts |

**Root cause (PDF):** [`apps/api/src/common/pdf/simple-pdf.ts`](../../apps/api/src/common/pdf/simple-pdf.ts) — not suitable for multi-line documents. [`lease-receipts.pdf.ts`](../../apps/api/src/modules/lease-receipts/lease-receipts.pdf.ts) is the reference pattern.

---

## Architecture decisions (locked for 8.5F2)

| Topic | Decision | Rationale |
| ----- | -------- | --------- |
| Data model | **No new tables** — read `booking_reservations` + `bookable_assets` + note JSON | 8.5E/F already store service_code, emergency, pickup in `note` |
| Citizen list scope | `GET /citizen/bookings` — municipality scope header (workspace) or hub-wide (no scope) | Matches applications/payments list pattern |
| Applications vs bookings | **Sub-tabs** under renamed nav item — do not merge dockets into booking cards | Different lifecycle (workflow vs slot confirm) |
| Receipt = confirmation PDF | Reuse `GET /citizen/bookings/:ref/confirmation.pdf` | Already implemented; only renderer changes |
| Admin summary location | **Tenant Admin Dashboard** new card/section — not Operations-only | User request; covers hall, LED, health, parking |
| Health fleet on admin detail | Admin row shows **assigned asset_code**; citizen list shows **service label** only | Consistent with 8.5F privacy rules |
| Smart parking | Include in summary when reservation uses `booking_reservations` + `PARKING_ZONE` asset type | Same table, same API |

---

## Sub-deliverables

### F2-1 — Citizen bookings list API

**Status:** ✅ complete (2026-06-19)

**Endpoint:** `GET /api/citizen/bookings`

| Query | Purpose |
| ----- | ------- |
| `status` (optional) | `confirmed` \| `hold` \| `cancelled` — default `confirmed` for My Bookings |
| `limit` (optional) | Default 50, max 100 |

**Response row:**

```typescript
{
  id: string;
  booking_no: string | null;
  tenant_code: string;
  service_code: string | null;      // from note JSON
  service_label: string;            // resolved from catalogue / asset type fallback
  asset_type: string;               // HALL | LED_BOARD | AMBULANCE | HEARSE | PARKING_ZONE | …
  status: string;
  starts_at: string;
  ends_at: string;
  holder_name: string;
  rent_paise: number;               // computed or from note override
  deposit_paise: number;
  emergency: boolean;
  pickup_address: string | null;    // citizen-safe; omit assigned vehicle
  can_download_receipt: boolean;    // true when status=confirmed && booking_no
}
```

**Implementation:**

| File | Change |
| ---- | ------ |
| `bookings.service.ts` | `listReservationsForCitizen(principal, scope, filters)` |
| `citizen-bookings.controller.ts` | `@Get()` list handler |
| `bookings.dto.ts` | `BookingListQueryDto` |
| `booking-reservation-note.util.ts` | Export `serviceCodeFromNote` helpers if needed |

**Rules:**

- Filter `citizenId = ensureMunicipalCitizenRow(...)`.
- Order by `starts_at DESC`.
- Never expose `assigned_asset_code` on citizen list (health fleet).
- Holds may appear with `can_download_receipt: false`.

---

### F2-2 — Citizen PWA: Applications / Bookings + My Bookings

**Status:** ✅ complete (2026-06-19)

**Nav rename (Hub + Workspace):**

| Before | After |
| ------ | ----- |
| `Applications` | `Applications / Bookings` (EN; i18n keys optional in same slice) |

**Sub-tabs** (mirror Payments pattern — `SegmentedControl`):

| Sub-tab | Content |
| ------- | ------- |
| **My Applications** | Existing application list + detail panel (unchanged behaviour) |
| **My Bookings** | New booking list + booking detail panel |

**Files:**

| File | Responsibility |
| ---- | -------------- |
| `citizen-pwa/app/page.tsx` | Nav labels; `ApplicationsSubTab` state; hub + workspace layouts |
| `citizen-pwa/components/my-bookings-panel.tsx` | List cards: booking no, service, slot IST, status badge |
| `citizen-pwa/components/booking-detail-panel.tsx` | Selected booking detail + **Download receipt** button |
| `citizen-pwa/lib/bookings-api.ts` | `fetchCitizenBookings()`, wire existing `downloadBookingConfirmationPdf` |

**My Bookings card (citizen):**

- Booking no (mono), service name (e.g. “Municipal ambulance”), slot date/time IST, status.
- KMC tenant stripe (hub) or current tenant (workspace).
- No vehicle name for ambulance/hearse.

**Detail panel actions:**

- **Download receipt** → existing PDF endpoint (uses booking no path ref).
- Empty state: “No confirmed bookings yet” + link to Health / Bookings services.

**Hub mode:** Call `GET /citizen/bookings` without scope (or per-tenant fan-out if list API is scope-only — prefer single query with `tenant_id` on each row like applications).

---

### F2-3 — Formatted booking confirmation PDF (PDFKit)

**Status:** ✅ complete (2026-06-19)

Replace `renderSimplePdf(buildBookingConfirmationPdfLines(...))` with **`renderBookingConfirmationPdf`** using **pdfkit** (already in `@enagar/api` dependencies).

**Layout (A4 portrait, 36pt margins):**

```
┌─────────────────────────────────────────────┐
│  [optional logo]     ULB Name (KMC)         │
│                      eNagarSeba             │
├─────────────────────────────────────────────┤
│  BOOKING CONFIRMATION                       │
│  Booking no: BK/KMC/2026/00020              │
│  Status: Confirmed                          │
├─────────────────────────────────────────────┤
│  Service        ambulance                   │
│  Date           22 June 2026                │
│  Time           10:00 am – 11:00 am IST     │
│  Pickup address …        (ambulance only)   │
│  Contact        …                           │
│  Emergency      Yes — no rent charged       │
├─────────────────────────────────────────────┤
│  Rent           ₹500.00                     │
│  Security dep.  ₹0.00                       │
│  Total          ₹500.00                     │
├─────────────────────────────────────────────┤
│  Generated: … · This is a system-generated  │
│  document.                                  │
└─────────────────────────────────────────────┘
```

**Variants:**

| Type | Hide asset line | Extra fields |
| ---- | --------------- | ------------ |
| Hall / LED | No — show asset name | Standard rent + deposit |
| Ambulance / Hearse | Yes — no vehicle name | Pickup, emergency, contact |
| Smart parking | Show bay/zone label | Vehicle reg if in note (future) |

**Files:**

| File | Change |
| ---- | ------ |
| `bookings-confirmation.pdf.ts` | **New** — PDFKit renderer |
| `bookings-pdf.util.ts` | Keep pure helpers; add `buildBookingConfirmationPdfModel()` |
| `bookings.service.ts` | `exportConfirmationPdf` → call PDFKit renderer |
| `bookings-pdf.util.spec.ts` | Model builder tests (keep); optional snapshot of PDF buffer length |
| `bookings-confirmation.pdf.spec.ts` | Assert PDF magic bytes `%PDF`, multi-page not required |

**Non-goals:** QR verify URL (lease receipt has it; bookings can add in v2); Bengali/Hindi PDF labels (English v1, same as lease receipt).

---

### F2-4 — Admin dashboard: Booking Summary

**Status:** ✅ complete (2026-06-19)

**New API:** `GET /api/admin/tenant/dashboard/booking-summary`

**Response:**

```typescript
{
  period_days: 30,
  totals: {
    confirmed: number;
    holds: number;
    cancelled: number;
  },
  by_asset_type: Array<{ asset_type: string; confirmed: number; holds: number }>,
  by_service_code: Array<{ service_code: string; confirmed: number }>,
  recent: Array<{
    id: string;
    booking_no: string | null;
    asset_code: string;
    asset_type: string;
    service_code: string | null;
    holder_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
    emergency: boolean;
  }>,
}
```

**Dashboard UI** ([`dashboard-client.tsx`](../../apps/admin-tenant/app/dashboard/dashboard-client.tsx)):

- New section **Booking Summary** below KPI row (or full-width card).
- KPI chips: Confirmed (30d), Active holds, Ambulance, Hearse, Halls, LED (from `by_asset_type`).
- Table: 10 recent bookings — columns: Booking no, Service, Asset, Slot, Status, Holder.
- Row click → deep link ` /dashboard/operations?section=bookings&booking=<id>` (optional query pre-fill).
- **Not** a separate “Health booking summary” — one panel for all booking types.

**Files:**

| File | Change |
| ---- | ------ |
| `admin-tenant.service.ts` | `getBookingSummary(principal)` |
| `admin-tenant.controller.ts` | `@Get('dashboard/booking-summary')` |
| `dashboard-client.tsx` | `BookingSummaryPanel` component |
| `booking-summary-panel.tsx` | **New** admin component |

---

### F2-5 — Hub dashboard booking counts (optional stretch)

If time permits in F2 slice:

- Add `booking_count` per municipality bucket on `GET /citizen/dashboard` (confirmed only).
- Hub home totals row: include bookings alongside applications/payments.

**Defer to 8.5G** if schedule tight — not blocking F2 exit.

---

**Status:** **complete** (F2-7 tenant isolation → 8.5G G1)

---

### F2-7 — Tenant isolation (deferred to 8.5G)

**Status:** ↪ **8.5G** — not blocking F2 exit

Unit-level tenant scoping is covered in service specs (`listReservationsForCitizen`, `getBookingSummary`). Full cross-tenant **security spec** (`tests/security/master-sprint-85.spec.ts`) extends in **8.5G G1** to cover:

- `GET /citizen/bookings` — hub vs `X-Enagar-Tenant-Code` scope; citizen A cannot read citizen B rows
- `GET /admin/tenant/dashboard/booking-summary` — KMC admin cannot read HMC counts

---

### F2-8 — Tests & smoke

**Status:** ✅ complete (2026-06-19)

| Test | Coverage |
| ---- | -------- |
| `bookings.service.spec.ts` | `listReservationsForCitizen` tenant isolation, health fleet omits asset |
| `bookings-confirmation.pdf.spec.ts` | PDF buffer valid, contains booking no text extractable |
| `admin-tenant booking-summary` | Counts by asset_type for seeded KMC data |
| `smoke-health-fleet-booking.mjs` | After confirm, `GET /citizen/bookings` returns row; PDF Content-Type pdf |
| **New** `smoke-citizen-my-bookings.mjs` | List + download PDF headers |

---

## File manifest (expected)

| File | Responsibility |
| ---- | -------------- |
| `apps/api/src/modules/bookings/bookings-confirmation.pdf.ts` | PDFKit booking receipt |
| `apps/api/src/modules/bookings/citizen-bookings.controller.ts` | `GET /citizen/bookings` |
| `apps/api/src/modules/admin-tenant/admin-tenant.service.ts` | Booking summary aggregation |
| `apps/admin-tenant/components/booking-summary-panel.tsx` | Dashboard section |
| `apps/citizen-pwa/components/my-bookings-panel.tsx` | Citizen list |
| `apps/citizen-pwa/components/booking-detail-panel.tsx` | Detail + download |
| `apps/citizen-pwa/app/page.tsx` | Nav rename + sub-tabs |
| `scripts/smoke/smoke-citizen-my-bookings.mjs` | E2E list + PDF |

---

## Edge cases

| Case | Expected |
| ---- | -------- |
| Booking confirmed but citizen on hub wrong ULB | Row still visible in hub My Bookings with tenant stripe |
| Hold not yet confirmed | Listed in My Bookings with status **Held**; download disabled |
| Emergency ambulance ₹0 | Receipt shows ₹0 rent + emergency line |
| Hall booking linked to application | My Applications shows docket; My Bookings shows booking no — both valid |
| Cancelled booking | Shown with cancelled badge; no download |
| PDF for old booking after redeploy | New PDFKit layout applies to all `exportConfirmationPdf` calls |

---

## Verification commands

```bash
pnpm --filter @enagar/api test -- bookings-confirmation booking-summary citizen-bookings
pnpm --filter @enagar/api typecheck
pnpm --filter @enagar/citizen-pwa typecheck
pnpm --filter @enagar/admin-tenant typecheck
node scripts/smoke/smoke-health-fleet-booking.mjs
node scripts/smoke/smoke-citizen-my-bookings.mjs
graphify update .
```

---

## Out of scope (8.5F2)

- Push/SMS booking reminders
- Cancel booking from My Bookings UI (API exists; UI defer)
- Separate payment receipt PDF (payments stay under My Payments)
- Tender/pension modules
- Crematorium bookings

---

## Execution order

```text
F2-1 API list → F2-3 PDFKit (fixes receipt download) → F2-2 PWA tabs → F2-4 Admin summary → F2-6 tests/smoke → exit runbook
```

PDF before PWA so manual smoke of download works as soon as My Bookings lands.

---

_Last updated: 2026-06-19_
