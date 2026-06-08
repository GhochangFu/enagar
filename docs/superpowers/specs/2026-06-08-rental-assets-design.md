# Rental Assets (EN-17) Design Specification

**Date:** 2026-06-08  
**Author:** Bappaditya Dasgupta  
**Status:** Draft (Pending Implementation)  
**Related Ticket:** EN-17 (Rental Assets)

## 1. Overview

ULBs manage various assets (markets, fixed hoardings, land) that are rented to companies or individuals holding a valid Trade License. This feature introduces a dedicated lifecycle for lease-based rentals, including agreement management, document verification, automated recurring payment schedules (monthly/quarterly/yearly), and expiry alerts.

## 2. Data Model Design

Three new Prisma models will be introduced to isolate lease lifecycles from short-term `BookableAsset` bookings.

### 2.1 `RentalAsset`

Represents the physical or logical asset available for long-term lease.

- `id`: UUID
- `tenantId`: UUID
- `assetType`: Enum (`HOARDING`, `MARKET_STALL`, `LAND`, `COMMUNITY_HALL_LONG_TERM`, `OTHER`)
- `name`: JSON (Multilingual name)
- `location`: JSONB (Address, coordinates)
- `status`: Enum (`AVAILABLE`, `RENTED`, `MAINTENANCE`, `RESERVED`)
- `baseLeaseRatePaise`: Int (Standard recurring rate)
- `ratePeriod`: Enum (`MONTHLY`, `QUARTERLY`, `YEARLY`)
- `metadata`: JSONB (Flexible extra details: dimensions, area in sq ft, etc.)
- `createdAt`, `updatedAt`: DateTime

### 2.2 `LeaseAgreement`

Represents the active contract between the ULB and the lessee.

- `id`: UUID
- `tenantId`: UUID
- `assetId`: UUID (Relation to `RentalAsset`)
- `tradeLicenseNo`: String (**MANDATORY**)
- `lessorName`: String (Name of the company/individual)
- `startDate`, `endDate`: DateTime
- `securityDepositPaise`: Int (Optional)
- `status`: Enum (`DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`)
- `agreementDocumentKey`: String? (S3/Object storage key for the uploaded agreement copy)
- `createdAt`, `updatedAt`: DateTime

### 2.3 `LeaseInvoice`

Represents the generated payment schedule for a specific billing cycle.

- `id`: UUID
- `tenantId`: UUID
- `agreementId`: UUID (Relation to `LeaseAgreement`)
- `invoiceNo`: String (Unique per tenant)
- `periodStart`, `periodEnd`: DateTime (The billing cycle this covers)
- `dueDate`: DateTime
- `amountPaise`: Int
- `status`: Enum (`PENDING`, `PAID`, `OVERDUE`, `WAIVED`)
- `createdAt`, `updatedAt`: DateTime

## 3. API & Feature Flow

### 3.1 Asset Management

- **Create Asset**: `POST /api/rental-assets`  
  Admin creates a new rental asset. Defaults to `AVAILABLE`.
- **Marketing List**: `GET /api/rental-assets?status=AVAILABLE`  
  Returns assets not currently under an active lease, specifically for marketing and availability tracking.

### 3.2 Agreement Creation & Document Upload

- **Create Agreement**: `POST /api/lease-agreements`
  - _Validation_: Checks if the target `RentalAsset` is `AVAILABLE`. Ensures `tradeLicenseNo` is strictly provided and non-empty.
  - _Side Effect_: On successful creation, updates the `RentalAsset` status to `RENTED`.
- **Document Upload**: Utilizes the existing signed URL flow to upload the agreement copy to S3. The resulting `objectKey` is stored in `LeaseAgreement.agreementDocumentKey`.

## 4. Background Jobs & Automation

To handle recurring payments and expirations cleanly (Option B), a daily scheduled cron job will be implemented.

1. **Expiry Alerts**:  
   Daily query for `LeaseAgreement` where `status = 'ACTIVE'` and `endDate` is within the next 30 days. Triggers an in-app notification or email to the relevant admin desk to initiate renewal discussions.
2. **Invoice Generation**:  
   Daily query for `LeaseAgreement` where `status = 'ACTIVE'`. Checks if a `LeaseInvoice` already exists for the upcoming billing period (calculated based on `ratePeriod`). If not, it creates a new `PENDING` `LeaseInvoice` with the `dueDate` set to the start of that period.

## 5. Error Handling & Constraints

- **Concurrency Control**: Application-level transactions (or DB constraints) to prevent two administrative users from creating an active `LeaseAgreement` for the same `RentalAsset` simultaneously.
- **Validation**: Strict check that `tradeLicenseNo` is not null or empty before saving a `LeaseAgreement`. Rejection of agreement creation if the asset is not `AVAILABLE`.
- **Data Integrity**: Cascading deletes or soft-deletes handled carefully to preserve financial audit trails (e.g., if an asset is deleted, its historical invoices remain).

## 6. Testing Strategy

- **Unit Tests**:
  - Verify the "no double-renting" logic (concurrent agreement creation fails gracefully).
  - Validate strict requirement of `tradeLicenseNo`.
- **Integration Tests**:
  - Test the background job to ensure it correctly generates _only_ the next invoice and skips already-billed periods.
  - Test the marketing list endpoint to ensure `RENTED` or `MAINTENANCE` assets are correctly filtered out.
