# Rental Payments & Collection Design (EN-17 Phase 2)

**Date:** 2026-06-08
**Author:** Assistant (drafted from user requirements)
**Status:** Draft
**Related Ticket:** EN-17 (Rental Assets)
**Builds on:** `2026-06-08-rental-assets-design.md`

---

## 1. Overview

The first phase of EN-17 introduced rental assets, lease agreements, and invoice generation. This design covers the **payment and collection lifecycle** for those invoices.

It answers three questions:

1. How is a lessor notified of rent due and how do they pay it?
2. How does the operator (ULB desk) record offline collections (cash, bank transfer, cheque)?
3. How does payment status surface in the operator UI?

### Confirmed Decisions

| Topic                           | Decision                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Payment methods                 | **Online gateway** + **Cash at desk** + **Bank transfer (NEFT/RTGS)** + **Cheque / DD**       |
| Citizen auth (online)           | **Citizen portal** (existing login)                                                           |
| Desk-only auth (offline)        | **Admin tenant** (operator records payment)                                                   |
| Overdue policy                  | **Auto-flip PENDING → OVERDUE after dueDate** (no auto-termination, no reminders)             |
| Late fee                        | **Flat late fee**, configurable per tenant (default 0)                                        |
| Gateway                         | **Existing `IPaymentGateway` interface** with `StubPaymentGateway` for now (real gateway TBD) |
| Lessor identification in portal | **By phone number** (linked to lease)                                                         |

---

## 2. Data Model Changes

### 2.1 `Payment` — add lease-invoice link

```prisma
model Payment {
  // ... existing fields ...
  leaseInvoiceId  String?  @map("lease_invoice_id") @db.Uuid
  leaseInvoice    LeaseInvoice? @relation(fields: [leaseInvoiceId], references: [id], onDelete: SetNull)

  @@index([tenantId, leaseInvoiceId, status])
}
```

`applicationId`, `bookingReservationId`, `leaseInvoiceId` are all optional. Exactly one should be populated per payment (enforced in service layer, not DB).

### 2.2 `LeaseInvoice` — add relation + `lateFeePaise`

```prisma
model LeaseInvoice {
  // ... existing fields ...
  lateFeePaise  Int  @default(0)  @map("late_fee_paise")
  payments      Payment[]
}
```

`amountPaise` is the base rent. Total payable = `amountPaise + lateFeePaise`. The flat late fee is applied when status flips from PENDING to OVERDUE.

### 2.3 `Tenant.config` (JSONB) — add late-fee config

```json
{
  "rentalLateFee": {
    "enabled": true,
    "flatAmountPaise": 50000
  }
}
```

`50000` paise = ₹500 flat. If `enabled = false` or absent, no late fee is applied.

---

## 3. Backend (NestJS)

### 3.1 New module: `lease-invoices`

```
apps/api/src/modules/lease-invoices/
├── lease-invoices.module.ts
├── lease-invoices.controller.ts
├── lease-invoices.service.ts
├── dto/
│   ├── record-payment.dto.ts
│   └── query-invoices.dto.ts
└── lease-invoices.service.spec.ts
```

#### Endpoints

| Method | Path                                 | Auth     | Purpose                                                                |
| ------ | ------------------------------------ | -------- | ---------------------------------------------------------------------- |
| GET    | `/api/lease-invoices`                | Operator | List invoices (filters: `agreementId`, `status`, `fromDate`, `toDate`) |
| GET    | `/api/lease-invoices/:id`            | Operator | Invoice detail                                                         |
| POST   | `/api/lease-invoices/:id/pay`        | Operator | Record a payment (online or offline)                                   |
| GET    | `/api/lease-invoices/lookup?phone=…` | Citizen  | Lookup own invoices by phone (gated by tenant citizen portal)          |

#### `POST /api/lease-invoices/:id/pay` body

```typescript
{
  method: 'ONLINE_GATEWAY' | 'CASH_AT_DESK' | 'BANK_TRANSFER' | 'CHEQUE',
  referenceNumber?: string,   // required for BANK_TRANSFER/CHEQUE
  notes?: string,
  // for ONLINE_GATEWAY: success/cancel return URLs
  returnUrl?: string,
}
```

#### Response shape (online)

```typescript
{
  paymentId: string,
  gatewayOrderId: string,
  redirectUrl: string,
  expiresAt: string,  // ISO
}
```

Mirrors the existing application-payment response.

#### Response shape (offline)

```typescript
{
  invoice: LeaseInvoice,  // status: 'PAID'
  payment: Payment,
  receipt: { receiptNumber: string, verificationToken: string }
}
```

#### Service behaviour

1. Load invoice; reject if not `PENDING` or `OVERDUE` (idempotency: cannot pay a `PAID` or `WAIVED` invoice).
2. Apply late fee if currently `OVERDUE` and `lateFeePaise` is 0 — read `tenant.config.rentalLateFee`, set `lateFeePaise = flatAmountPaise`, save.
3. Build a `Payment` row:
   - **Online**: `status = 'requires_action'`, then call `paymentGateway.initiate({...})` and return the redirect URL.
   - **Offline**: `status = 'succeeded'`, `settledAt = now()`. Immediately mark invoice `PAID`. Generate `Receipt` with `revenueHeadCode = 'RENT_LEASE'`, `accountingCode = 'RENT_LEASE_INCOME'`.
4. All inside `prisma.$transaction` to guarantee atomicity.

### 3.2 Extend `lease-scheduler.service.ts`

The existing cron runs daily at 2 AM. Add a second pass **after** invoice generation:

```typescript
// 3. Auto-flip PENDING → OVERDUE
const overdueCandidates = await this.prisma.leaseInvoice.findMany({
  where: { status: 'PENDING', dueDate: { lt: now } },
});
for (const inv of overdueCandidates) {
  await this.prisma.leaseInvoice.update({
    where: { id: inv.id },
    data: { status: 'OVERDUE' },
  });
  // apply late fee (if configured)
  if (tenant.config.rentalLateFee?.enabled) {
    await this.prisma.leaseInvoice.update({
      where: { id: inv.id },
      data: { lateFeePaise: tenant.config.rentalLateFee.flatAmountPaise },
    });
  }
  this.logger.warn(`[LEASE INVOICE] ${inv.invoiceNo} is now OVERDUE`);
}
```

Keep the existing expiry-alert and invoice-generation logic untouched.

### 3.3 `Payment` model — guard at service layer

In `PaymentsService.create()`, add a precondition: exactly one of `applicationId`, `bookingReservationId`, `leaseInvoiceId` must be set. This protects the existing flow from accidental misuse when we add the new lease-invoice code path.

---

## 4. Frontend — Admin Tenant (Operator)

### 4.1 Smart Payment Status pill in grid

Replace the static `RENTED` badge for rented assets with a derived `PaymentStatus` pill on the asset row.

| Condition                                                                 | Label         | Tone      |
| ------------------------------------------------------------------------- | ------------- | --------- |
| `asset.status === 'AVAILABLE'`                                            | `Available`   | `success` |
| `asset.status === 'MAINTENANCE'`                                          | `Maintenance` | `warning` |
| `asset.status === 'RESERVED'`                                             | `Reserved`    | `info`    |
| `asset.status === 'RENTED'`, latest invoice `PAID`                        | `Paid`        | `success` |
| `asset.status === 'RENTED'`, latest invoice `PENDING` AND due in ≤ 7 days | `Due`         | `warning` |
| `asset.status === 'RENTED'`, latest invoice `PENDING` AND due in > 7 days | `Upcoming`    | `info`    |
| `asset.status === 'RENTED'`, latest invoice `OVERDUE`                     | `Overdue`     | `danger`  |
| `asset.status === 'RENTED'`, no invoice yet                               | `No invoice`  | `neutral` |

To support this, the `GET /api/rental-assets` response must include the **latest invoice** for the active agreement. Update the backend `getAssets` `include`:

```typescript
include: {
  agreements: {
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      invoices: {
        orderBy: { periodStart: 'desc' },
        take: 1,  // latest invoice for status pill
      },
    },
  },
},
```

### 4.2 "View Lease" modal — invoice section + Record Payment

Extend the existing `LeaseDetailModal` (or add a `LeaseDetailDrawer` if you prefer) with:

- **Lease summary** (unchanged)
- **Invoices list** (latest 5): table with `Invoice #`, `Period`, `Amount`, `Late Fee`, `Total`, `Status`, `Due Date`, and a `Record Payment` action button per row
- **`Record Payment` opens a sub-modal** with:
  - Method dropdown (`Cash at desk` / `Bank transfer` / `Cheque` / `Online gateway`)
  - Conditional `Reference number` field (required for non-cash)
  - `Notes` textarea (optional)
  - Total displayed clearly: `Base ₹X + Late fee ₹Y = ₹Z`
  - `Record Payment` button → calls `POST /api/lease-invoices/:id/pay`
  - On success, shows a toast with the receipt number and refreshes the invoice list

### 4.3 New page: `/rental-assets/invoices` — full invoice ledger

A standalone page for the finance / rent-collection view:

- Top KPI strip: `Total billed this month`, `Collected this month`, `Outstanding`, `Overdue` (all in ₹)
- Filter bar: status segmented control, period range, agreement (search/select)
- DataTable: `Invoice #`, `Asset`, `Lessor`, `Period`, `Amount + Late Fee`, `Status`, `Due`, `Actions`
- Action: `View` (invoice detail), `Record Payment` (if not paid)
- Sidebar: add `Rental Invoices` menu item under `Rental Assets`

---

## 5. Frontend — Citizen Portal (Online Payments)

### 5.1 New page: `/citizen/leases`

- Citizen logs in (existing flow)
- Page queries `GET /api/lease-invoices/lookup?phone=<user.phone>` (or the citizen-id-keyed equivalent based on how `Citizen` is currently linked)
- Shows a card per active lease: `Asset name`, `Lessor name (you)`, `Period`, `Amount`, `Status`, `Pay Now` button (only if `PENDING`/`OVERDUE`)
- Below cards: **Invoice history** table

### 5.2 Payment flow

- `Pay Now` → `POST /api/lease-invoices/:id/pay` with `method = 'ONLINE_GATEWAY'` and `returnUrl`
- Server returns `{ redirectUrl }` → frontend `window.location.assign(redirectUrl)`
- Stub gateway route `/payments/stub/complete` (existing) settles the payment and redirects back
- On return: show success screen with `Receipt #` and **Download Receipt** link (uses existing `public-receipts.controller.ts`)

### 5.3 Linking lessor to citizen

- The `LeaseAgreement.lessorName` is a free-text string today
- Add optional columns `lessorPhone String?` and `lessorCitizenId String?` to `LeaseAgreement` (Prisma migration)
- Form: when creating a lease, the operator can optionally enter a phone number and "link to existing citizen" (search by phone, dropdown of matches)
- The citizen-portal lookup joins on `lessorPhone = :phone` (since citizens can have leases under different legal names, phone is the stable identifier)

---

## 6. Error Handling & Edge Cases

- **Concurrent payment**: `leaseInvoice.status = 'PAID'` is checked inside a transaction; if a parallel request flips it first, the second returns `409 Conflict`.
- **Partial payment**: out of scope for v1. The full amount (base + late fee) must be paid in one transaction.
- **Refunds**: not in scope. If a payment is recorded in error, the operator voids the `Payment` and re-opens the invoice (manual SQL for now; UI later).
- **Receipt numbering**: reuse the existing `Receipt` sequence per tenant — no separate counter needed.
- **Cancelled leases**: do not generate new invoices for `TERMINATED` or `EXPIRED` leases. The cron already filters by `status: 'ACTIVE'`.

---

## 7. Testing Strategy

### Unit (Jest)

- `LeaseInvoicesService.recordPayment`:
  - Rejects `PAID` invoice
  - Applies late fee on first overdue flip
  - Generates receipt for offline methods
  - Calls gateway for online and returns redirect URL
- `LeaseSchedulerService`:
  - Existing tests still pass
  - New: `OVERDUE` flip test
  - New: late fee applied on overdue flip

### Integration (Supertest)

- Full flow: create asset → create agreement → run cron manually → `POST /pay` with `CASH_AT_DESK` → invoice `PAID` → receipt downloadable
- Online flow: `POST /pay` with `ONLINE_GATEWAY` → returns stub URL → complete stub → webhook (if any) → invoice `PAID`

### Smoke (manual via browser-agent)

- Hard-coded token login
- Navigate to `/rental-assets`, see `Paid` / `Due` / `Overdue` pills
- Open a rented asset → `View Lease` → see invoice → `Record Payment` → choose `Cash` → see success toast
- Navigate to `/rental-assets/invoices` → see ledger

---

## 8. Rollout / Migration

1. Prisma migration: add `leaseInvoiceId` to `Payment`, add `lateFeePaise` to `LeaseInvoice`, add `lessorPhone` / `lessorCitizenId` to `LeaseAgreement`
2. Backfill: optional one-time script to populate `lessorPhone` from `Citizen.phone` where `Citizen.name` matches `lessorName` (best-effort, log matches)
3. Cron adds the overdue pass — no config needed
4. UI is additive (new "Invoices" menu, new modals) — no breaking changes to existing pages

---

## 9. Out of Scope (Future)

- Real payment gateway integration (Razorpay/Stripe/PayU)
- Tenant-configurable late fee policy UI
- SMS/Email notifications for due/overdue invoices
- Auto-termination after grace period
- Refunds and adjustments
- PDF receipt download from citizen portal
- Receipt tax/GST breakdown
- Partial payments and installments
