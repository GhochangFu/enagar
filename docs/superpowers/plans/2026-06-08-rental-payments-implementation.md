# Rental Payments & Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `LeaseInvoice` model into the payment system so rent can be collected online (citizen portal, via stub gateway), at the desk (cash/bank transfer/cheque), with auto-flip to OVERDUE and a flat late fee.

**Architecture:** Add a `lease-invoices` NestJS module that records payments against `LeaseInvoice` (mirroring the existing `Payment` flow). Extend the existing daily cron to flip PENDING → OVERDUE and apply a tenant-config flat late fee. Add a `lessorPhone` link from `LeaseAgreement` to `Citizen` for portal lookups. Build three operator UI surfaces (smart payment pill, Record Payment modal, full invoice ledger) and one citizen UI surface (lease/invoice list with online pay).

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 14 (admin-tenant & citizen-portal), class-validator, `@nestjs/schedule` cron, `StubPaymentGateway`.

**Builds on:**

- `docs/superpowers/specs/2026-06-08-rental-payments-design.md`
- `docs/superpowers/specs/2026-06-08-rental-assets-design.md`
- Existing `apps/api/src/modules/payments/` (mirror its patterns)
- Existing `apps/api/src/modules/rental-assets/` (extend the service & scheduler)

---

## File Structure

### New files (backend)

```
apps/api/src/modules/lease-invoices/
├── lease-invoices.module.ts
├── lease-invoices.controller.ts
├── lease-invoices.service.ts
├── lease-invoices.service.spec.ts
├── lease-invoices.controller.spec.ts
└── dto/
    ├── record-payment.dto.ts
    └── query-invoices.dto.ts
```

### Modified files (backend)

```
apps/api/prisma/schema.prisma                          (Payment.leaseInvoiceId, LeaseInvoice.lateFeePaise, LeaseAgreement.lessorPhone/lessorCitizenId)
apps/api/src/modules/rental-assets/rental-assets.service.ts   (getAssets: include latest invoice)
apps/api/src/modules/rental-assets/lease-scheduler.service.ts (add overdue pass)
apps/api/src/app.module.ts                              (register LeaseInvoicesModule)
```

### New files (admin-tenant UI)

```
apps/admin-tenant/app/rental-assets/invoices/page.tsx          (full invoice ledger)
apps/admin-tenant/app/rental-assets/invoices/_components/record-payment-modal.tsx
apps/admin-tenant/components/record-rent-payment-modal.tsx     (reusable, used in lease modal too)
```

### Modified files (admin-tenant UI)

```
apps/admin-tenant/app/rental-assets/page.tsx                   (smart payment pill, View Lease invoice section)
apps/admin-tenant/app/rental-assets/new/page.tsx               (optional lessorPhone input)
apps/admin-tenant/lib/tenant-admin-nav.ts                      (add Rental Invoices menu)
```

### New files (citizen-portal UI)

```
apps/citizen-portal/app/leases/page.tsx
apps/citizen-portal/app/leases/pay/page.tsx
```

---

## Task 1: Extend Prisma schema for payments & late fees

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `leaseInvoiceId` to Payment**

In `apps/api/prisma/schema.prisma`, inside the `model Payment { ... }` block (around line 981), add:

```prisma
  leaseInvoiceId      String?        @map("lease_invoice_id") @db.Uuid
  leaseInvoice        LeaseInvoice?  @relation(fields: [leaseInvoiceId], references: [id], onDelete: SetNull)
```

Then in the same model, add an index line:

```prisma
  @@index([tenantId, leaseInvoiceId, status])
```

- [ ] **Step 2: Add `lateFeePaise` and `payments` to LeaseInvoice**

In `model LeaseInvoice { ... }` (around line 1549), add:

```prisma
  lateFeePaise  Int      @default(0) @map("late_fee_paise")
  payments      Payment[]
```

- [ ] **Step 3: Add `lessorPhone` and `lessorCitizenId` to LeaseAgreement**

In `model LeaseAgreement { ... }` (around line 1526), add:

```prisma
  lessorPhone      String?  @map("lessor_phone") @db.VarChar(20)
  lessorCitizenId  String?  @map("lessor_citizen_id") @db.Uuid
  lessorCitizen    Citizen? @relation(fields: [lessorCitizenId], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Add the reverse relation on `Tenant` and `Citizen`**

In `model Tenant { ... }`, find the line `leaseInvoices       LeaseInvoice[]` and leave it. Find `leaseAgreements       LeaseAgreement[]` and leave it.

In `model Citizen { ... }`, add:

```prisma
  leaseAgreements  LeaseAgreement[]
```

(Look for the existing `applications` line on `Citizen` to find the right spot.)

- [ ] **Step 5: Push schema to dev DB**

Run from `apps/api`:

```bash
cd apps/api
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 6: Regenerate Prisma client**

```bash
cd apps/api
npx prisma generate
```

Expected: `Generated Prisma Client (vX.X.X) to ./src/generated/prisma`

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/generated/prisma
git commit -m "feat(rentals): add leaseInvoiceId, lateFeePaise, lessorPhone to schema"
```

---

## Task 2: Create the `record-payment.dto.ts`

**Files:**

- Create: `apps/api/src/modules/lease-invoices/dto/record-payment.dto.ts`

- [ ] **Step 1: Create the DTO file**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const leasePaymentMethods = ['ONLINE_GATEWAY', 'CASH_AT_DESK', 'BANK_TRANSFER', 'CHEQUE'] as const;
export type LeasePaymentMethod = (typeof leasePaymentMethods)[number];

export class RecordLeasePaymentDto {
  @ApiProperty({ enum: leasePaymentMethods, example: 'CASH_AT_DESK' })
  @IsIn(leasePaymentMethods)
  method!: LeasePaymentMethod;

  @ApiProperty({ required: false, example: 'NEFT-2026-0001' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  referenceNumber?: string;

  @ApiProperty({ required: false, example: 'Paid by lessor at counter' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

- [ ] **Step 2: Create the query DTO file**

Create `apps/api/src/modules/lease-invoices/dto/query-invoices.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum LeaseInvoiceFilterStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
}

export class QueryLeaseInvoicesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @ApiProperty({ required: false, enum: LeaseInvoiceFilterStatus })
  @IsOptional()
  @IsEnum(LeaseInvoiceFilterStatus)
  status?: LeaseInvoiceFilterStatus;

  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiProperty({ required: false, example: '2026-12-31' })
  @IsOptional()
  @IsString()
  toDate?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/lease-invoices/dto/
git commit -m "feat(rentals): add DTOs for lease payment recording and invoice queries"
```

---

## Task 3: Write failing test for `LeaseInvoicesService.recordPayment`

**Files:**

- Create: `apps/api/src/modules/lease-invoices/lease-invoices.service.spec.ts`

- [ ] **Step 1: Create the spec file with the first test**

```typescript
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { LeaseInvoicesService } from './lease-invoices.service';

describe('LeaseInvoicesService.recordPayment', () => {
  let service: LeaseInvoicesService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    leaseInvoice: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    payment: { create: jest.Mock };
    receipt: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const TENANT_ID = 'tenant-1';
  const INVOICE_ID = 'invoice-1';
  const AGREEMENT_ID = 'agreement-1';
  const ASSET_ID = 'asset-1';

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      leaseInvoice: { findFirst: jest.Mock, update: jest.Mock, create: jest.Mock },
      payment: { create: jest.Mock },
      receipt: { create: jest.Mock },
      $transaction: jest.fn(),
    } as unknown as typeof prisma;
    // $transaction just invokes the callback with itself
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    service = new LeaseInvoicesService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when tenant does not exist', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.recordPayment('bad-tenant', INVOICE_ID, {
        method: 'CASH_AT_DESK',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when invoice is not in this tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue(null);

    await expect(service.recordPayment('tenant-1', INVOICE_ID, { method: 'CASH_AT_DESK' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ConflictException when invoice is already PAID', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PAID',
    });

    await expect(service.recordPayment('tenant-1', INVOICE_ID, { method: 'CASH_AT_DESK' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws BadRequestException when referenceNumber is missing for non-cash offline methods', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PENDING',
    });

    await expect(service.recordPayment('tenant-1', INVOICE_ID, { method: 'BANK_TRANSFER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run the test, expect compile failure (service does not exist yet)**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-invoices.service.spec --no-coverage
```

Expected: `Cannot find module './lease-invoices.service'` or similar TS error.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/api/src/modules/lease-invoices/lease-invoices.service.spec.ts
git commit -m "test(rentals): add failing tests for recordPayment guard conditions"
```

---

## Task 4: Implement `LeaseInvoicesService.recordPayment` (offline path)

**Files:**

- Create: `apps/api/src/modules/lease-invoices/lease-invoices.service.ts`

- [ ] **Step 1: Create the service skeleton with the validation guards**

```typescript
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { RecordLeasePaymentDto } from './dto/record-payment.dto';

@Injectable()
export class LeaseInvoicesService {
  private readonly logger = new Logger(LeaseInvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(tenantCode: string, invoiceId: string, dto: RecordLeasePaymentDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const invoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') {
      throw new ConflictException(`Invoice is already ${invoice.status}`);
    }

    if ((dto.method === 'BANK_TRANSFER' || dto.method === 'CHEQUE') && !dto.referenceNumber?.trim()) {
      throw new BadRequestException('Reference number is required for bank transfer and cheque payments');
    }

    // Online and offline flows diverge — for now return a stub
    // (next task implements the actual settlement logic)
    return { invoice, recorded: false };
  }
}
```

- [ ] **Step 2: Run the tests, expect them to pass**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-invoices.service.spec --no-coverage
```

Expected: 4 passing tests.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/lease-invoices/lease-invoices.service.ts
git commit -m "feat(rentals): add recordPayment validation guards"
```

---

## Task 5: Implement offline (cash/bank/cheque) settlement

**Files:**

- Modify: `apps/api/src/modules/lease-invoices/lease-invoices.service.ts`
- Modify: `apps/api/src/modules/lease-invoices/lease-invoices.service.spec.ts`

- [ ] **Step 1: Add the offline implementation in `recordPayment`**

Replace the trailing `return { invoice, recorded: false };` in `lease-invoices.service.ts` with:

```typescript
    if (dto.method === 'ONLINE_GATEWAY') {
      return this.startOnlinePayment(tenant, invoice);
    }
    return this.settleOffline(tenant, invoice, dto);
  }

  private async startOnlinePayment(
    tenant: { id: string; code: string },
    invoice: { id: string; tenantId: string; agreementId: string; amountPaise: number; lateFeePaise: number },
  ) {
    const totalPaise = invoice.amountPaise + invoice.lateFeePaise;
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        leaseInvoiceId: invoice.id,
        citizenSubject: `lease-invoice:${invoice.id}`,
        amountPaise: totalPaise,
        feeCode: 'rent',
        method: 'upi',
        status: 'requires_action',
        gateway: 'stub',
        gatewayOrderId: `stub_order_lease_${invoice.id}_${Date.now()}`,
      },
    });
    return {
      invoiceId: invoice.id,
      paymentId: payment.id,
      gatewayOrderId: payment.gatewayOrderId,
      redirectUrl: `/payments/stub/complete?payment_id=${payment.id}&order_id=${payment.gatewayOrderId}`,
    };
  }

  private async settleOffline(
    tenant: { id: string },
    invoice: { id: string; tenantId: string; amountPaise: number; lateFeePaise: number; invoiceNo: string; agreementId: string },
    dto: RecordLeasePaymentDto,
  ) {
    const totalPaise = invoice.amountPaise + invoice.lateFeePaise;
    const receiptNo = `RCP-${invoice.invoiceNo}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          leaseInvoiceId: invoice.id,
          citizenSubject: `lease-invoice:${invoice.id}`,
          amountPaise: totalPaise,
          feeCode: 'rent',
          method: 'cash',
          status: 'succeeded',
          gateway: 'desk',
          gatewayOrderId: `desk_${invoice.id}_${Date.now()}`,
          settledAt: new Date(),
        },
      });
      const receipt = await tx.receipt.create({
        data: {
          tenantId: tenant.id,
          paymentId: payment.id,
          receiptNumber: receiptNo,
          revenueHeadCode: 'RENT_LEASE',
          accountingCode: 'RENT_LEASE_INCOME',
          amountPaise: totalPaise,
        },
      });
      const updatedInvoice = await tx.leaseInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID' },
      });
      this.logger.log(
        `[LEASE PAYMENT] Invoice ${invoice.invoiceNo} settled offline via ${dto.method} (payment=${payment.id}, receipt=${receiptNo})`,
      );
      return { invoice: updatedInvoice, payment, receipt };
    });
  }
```

- [ ] **Step 2: Add a passing test for the offline settlement happy path**

Append to `lease-invoices.service.spec.ts`:

```typescript
it('settles an offline cash payment and marks the invoice PAID', async () => {
  prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, code: 'kmc', config: {} });
  prisma.leaseInvoice.findFirst.mockResolvedValue({
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    agreementId: AGREEMENT_ID,
    invoiceNo: 'INV-TEST-1',
    amountPaise: 100000,
    lateFeePaise: 0,
    status: 'PENDING',
  });
  prisma.payment.create.mockResolvedValue({ id: 'payment-1' });
  prisma.receipt.create.mockResolvedValue({ receiptNumber: 'RCP-1', id: 'receipt-1' });
  prisma.leaseInvoice.update.mockResolvedValue({ id: INVOICE_ID, status: 'PAID' });

  const result = await service.recordPayment('kmc', INVOICE_ID, { method: 'CASH_AT_DESK' });

  expect(result.invoice.status).toBe('PAID');
  expect(prisma.payment.create).toHaveBeenCalledWith(
    expect.objectContaining({
      leaseInvoiceId: INVOICE_ID,
      amountPaise: 100000,
      status: 'succeeded',
    }),
  );
  expect(prisma.receipt.create).toHaveBeenCalledWith(
    expect.objectContaining({
      paymentId: 'payment-1',
      revenueHeadCode: 'RENT_LEASE',
    }),
  );
  expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: INVOICE_ID }, data: { status: 'PAID' } }),
  );
});

it('creates a requires_action payment for ONLINE_GATEWAY and returns redirectUrl', async () => {
  prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, code: 'kmc', config: {} });
  prisma.leaseInvoice.findFirst.mockResolvedValue({
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    agreementId: AGREEMENT_ID,
    invoiceNo: 'INV-TEST-1',
    amountPaise: 100000,
    lateFeePaise: 5000,
    status: 'OVERDUE',
  });
  prisma.payment.create.mockResolvedValue({ id: 'payment-2', gatewayOrderId: 'stub_order_x' });

  const result = await service.recordPayment('kmc', INVOICE_ID, { method: 'ONLINE_GATEWAY' });

  expect(result.redirectUrl).toContain('/payments/stub/complete');
  expect(prisma.payment.create).toHaveBeenCalledWith(
    expect.objectContaining({
      amountPaise: 105000, // 100000 base + 5000 late fee
      status: 'requires_action',
    }),
  );
});
```

- [ ] **Step 3: Run the tests**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-invoices.service.spec --no-coverage
```

Expected: 6 passing tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/lease-invoices/
git commit -m "feat(rentals): implement offline and online payment recording"
```

---

## Task 6: Implement late-fee application in `recordPayment`

**Files:**

- Modify: `apps/api/src/modules/lease-invoices/lease-invoices.service.ts`
- Modify: `apps/api/src/modules/lease-invoices/lease-invoices.service.spec.ts`

- [ ] **Step 1: Add `applyLateFeeIfOverdue` helper**

In `lease-invoices.service.ts`, add a private method:

```typescript
  private async applyLateFeeIfOverdue(
    tenantId: string,
    invoiceId: string,
    currentStatus: string,
    currentLateFee: number,
  ): Promise<number> {
    if (currentStatus !== 'OVERDUE' || currentLateFee > 0) {
      return currentLateFee;
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const config = (tenant?.config ?? {}) as {
      rentalLateFee?: { enabled?: boolean; flatAmountPaise?: number };
    };
    const cfg = config.rentalLateFee;
    if (!cfg?.enabled || !cfg.flatAmountPaise) {
      return 0;
    }
    await this.prisma.leaseInvoice.update({
      where: { id: invoiceId },
      data: { lateFeePaise: cfg.flatAmountPaise },
    });
    return cfg.flatAmountPaise;
  }
```

Then in `recordPayment`, after the existing guards and **before** the method switch, call:

```typescript
const updatedLateFee = await this.applyLateFeeIfOverdue(tenant.id, invoice.id, invoice.status, invoice.lateFeePaise);
const effectiveInvoice = { ...invoice, lateFeePaise: updatedLateFee };
```

And replace `this.startOnlinePayment(tenant, invoice)` and `this.settleOffline(tenant, invoice, dto)` with the updated `effectiveInvoice` variable.

- [ ] **Step 2: Add a test for the late-fee behaviour**

Append to the spec:

```typescript
it('applies the tenant flat late fee when paying an OVERDUE invoice with no late fee yet', async () => {
  prisma.tenant.findUnique
    .mockResolvedValueOnce({
      id: TENANT_ID,
      code: 'kmc',
      config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } },
    })
    .mockResolvedValueOnce({ id: TENANT_ID, config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } } });
  prisma.leaseInvoice.findFirst.mockResolvedValue({
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    agreementId: AGREEMENT_ID,
    invoiceNo: 'INV-TEST-2',
    amountPaise: 100000,
    lateFeePaise: 0,
    status: 'OVERDUE',
  });
  prisma.leaseInvoice.update.mockResolvedValue({ id: INVOICE_ID, status: 'PAID' });
  prisma.payment.create.mockResolvedValue({ id: 'payment-3' });
  prisma.receipt.create.mockResolvedValue({ receiptNumber: 'RCP-2' });

  await service.recordPayment('kmc', INVOICE_ID, { method: 'CASH_AT_DESK' });

  expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: INVOICE_ID }, data: { lateFeePaise: 50000 } }),
  );
  expect(prisma.payment.create).toHaveBeenCalledWith(
    expect.objectContaining({ amountPaise: 150000 }), // base 100000 + late 50000
  );
});
```

- [ ] **Step 3: Run the tests**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-invoices.service.spec --no-coverage
```

Expected: 7 passing tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/lease-invoices/
git commit -m "feat(rentals): apply tenant-config flat late fee on overdue invoice payment"
```

---

## Task 7: Add `listInvoices` and `getInvoice` service methods

**Files:**

- Modify: `apps/api/src/modules/lease-invoices/lease-invoices.service.ts`

- [ ] **Step 1: Add the two read methods**

Insert at the top of the `LeaseInvoicesService` class (before `recordPayment`):

```typescript
  async listInvoices(
    tenantCode: string,
    filters: { agreementId?: string; status?: string; fromDate?: string; toDate?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.prisma.leaseInvoice.findMany({
      where: {
        tenantId: tenant.id,
        ...(filters.agreementId ? { agreementId: filters.agreementId } : {}),
        ...(filters.status ? { status: filters.status as 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' } : {}),
        ...(filters.fromDate || filters.toDate
          ? {
              dueDate: {
                ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
                ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { dueDate: 'desc' },
      include: {
        agreement: {
          include: { asset: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async getInvoice(tenantCode: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const invoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
      include: {
        agreement: { include: { asset: true } },
        payments: { include: { receipt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/lease-invoices/lease-invoices.service.ts
git commit -m "feat(rentals): add listInvoices and getInvoice service methods"
```

---

## Task 8: Create the `LeaseInvoicesController`

**Files:**

- Create: `apps/api/src/modules/lease-invoices/lease-invoices.controller.ts`
- Create: `apps/api/src/modules/lease-invoices/lease-invoices.controller.spec.ts`

- [ ] **Step 1: Create the controller**

```typescript
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';

import { QueryLeaseInvoicesDto } from './dto/query-invoices.dto';
import { RecordLeasePaymentDto } from './dto/record-payment.dto';
import { LeaseInvoicesService } from './lease-invoices.service';

@ApiTags('lease-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lease-invoices')
export class LeaseInvoicesController {
  constructor(private readonly service: LeaseInvoicesService) {}

  @Get()
  @Roles('admin', 'staff', 'finance')
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: QueryLeaseInvoicesDto) {
    return this.service.listInvoices(principal.tenantCode!, query);
  }

  @Get(':id')
  @Roles('admin', 'staff', 'finance')
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.service.getInvoice(principal.tenantCode!, id);
  }

  @Post(':id/pay')
  @Roles('admin', 'staff', 'finance')
  pay(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: RecordLeasePaymentDto,
  ) {
    return this.service.recordPayment(principal.tenantCode!, id, dto);
  }
}
```

- [ ] **Step 2: Create the controller spec**

```typescript
import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { LeaseInvoicesService } from './lease-invoices.service';
import { LeaseInvoicesController } from './lease-invoices.controller';

describe('LeaseInvoicesController', () => {
  let controller: LeaseInvoicesController;
  let service: jest.Mocked<LeaseInvoicesService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LeaseInvoicesController],
      providers: [
        {
          provide: LeaseInvoicesService,
          useValue: {
            listInvoices: jest.fn(),
            getInvoice: jest.fn(),
            recordPayment: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(LeaseInvoicesController);
    service = moduleRef.get(LeaseInvoicesService);
  });

  it('delegates list to the service', async () => {
    const principal = { tenantCode: 'kmc' } as any;
    const dto = {} as any;
    service.listInvoices.mockResolvedValue([]);
    await controller.list(principal, dto);
    expect(service.listInvoices).toHaveBeenCalledWith('kmc', dto);
  });

  it('delegates get to the service', async () => {
    const principal = { tenantCode: 'kmc' } as any;
    service.getInvoice.mockResolvedValue({ id: 'i1' } as any);
    const result = await controller.get(principal, 'i1');
    expect(result).toEqual({ id: 'i1' });
    expect(service.getInvoice).toHaveBeenCalledWith('kmc', 'i1');
  });

  it('delegates pay to the service', async () => {
    const principal = { tenantCode: 'kmc' } as any;
    const dto = { method: 'CASH_AT_DESK' } as any;
    service.recordPayment.mockResolvedValue({ invoice: { id: 'i1' } } as any);
    await controller.pay(principal, 'i1', dto);
    expect(service.recordPayment).toHaveBeenCalledWith('kmc', 'i1', dto);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-invoices.controller.spec --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/lease-invoices/
git commit -m "feat(rentals): add lease-invoices controller with role-guarded endpoints"
```

---

## Task 9: Create the module and register it

**Files:**

- Create: `apps/api/src/modules/lease-invoices/lease-invoices.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common';

import { LeaseInvoicesController } from './lease-invoices.controller';
import { LeaseInvoicesService } from './lease-invoices.service';

@Module({
  controllers: [LeaseInvoicesController],
  providers: [LeaseInvoicesService],
  exports: [LeaseInvoicesService],
})
export class LeaseInvoicesModule {}
```

- [ ] **Step 2: Register the module in `app.module.ts`**

Open `apps/api/src/app.module.ts`, find the `imports: [...]` array, and add `LeaseInvoicesModule` alphabetically. Also add the import line at the top:

```typescript
import { LeaseInvoicesModule } from './modules/lease-invoices/lease-invoices.module';
```

- [ ] **Step 3: Verify the API compiles**

```bash
cd apps/api
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/lease-invoices/lease-invoices.module.ts apps/api/src/app.module.ts
git commit -m "feat(rentals): register LeaseInvoicesModule in app module"
```

---

## Task 10: Extend the existing scheduler to flip PENDING → OVERDUE

**Files:**

- Modify: `apps/api/src/modules/rental-assets/lease-scheduler.service.ts`
- Create: `apps/api/src/modules/rental-assets/lease-scheduler.service.spec.ts`

- [ ] **Step 1: Create the spec file with the overdue-flip test**

```typescript
import { PrismaService } from '../../common/database/prisma.service';

import { LeaseSchedulerService } from './lease-scheduler.service';

describe('LeaseSchedulerService overdue flip', () => {
  let service: LeaseSchedulerService;
  let prisma: {
    leaseAgreement: { findMany: jest.Mock };
    leaseInvoice: { findMany: jest.Mock; update: jest.Mock };
    tenant: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      leaseAgreement: { findMany: jest.Mock },
      leaseInvoice: { findMany: jest.Mock, update: jest.Mock },
      tenant: { findUnique: jest.Mock },
    } as unknown as typeof prisma;
    prisma.leaseAgreement.findMany.mockResolvedValue([]);
    prisma.leaseInvoice.findMany.mockResolvedValue([]);
    service = new LeaseSchedulerService(prisma as unknown as PrismaService);
  });

  it('flips PENDING invoices past dueDate to OVERDUE', async () => {
    prisma.leaseInvoice.findMany
      .mockResolvedValueOnce([]) // expiring agreements query
      .mockResolvedValueOnce([]) // active agreements for invoice gen
      .mockResolvedValueOnce([{ id: 'inv-1', invoiceNo: 'INV-1', tenantId: 't1' }]); // overdue candidates
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', config: {} });
    prisma.leaseInvoice.update.mockResolvedValue({});

    await (service as any).handleLeaseScheduler();

    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' }, data: { status: 'OVERDUE' } }),
    );
  });

  it('applies tenant flat late fee when flipping to OVERDUE if config enabled', async () => {
    prisma.leaseInvoice.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'inv-2', invoiceNo: 'INV-2', tenantId: 't1' }]);
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } },
    });
    prisma.leaseInvoice.update.mockResolvedValue({});

    await (service as any).handleLeaseScheduler();

    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-2' }, data: { status: 'OVERDUE' } }),
    );
    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-2' }, data: { lateFeePaise: 50000 } }),
    );
  });
});
```

- [ ] **Step 2: Run the test, expect it to fail**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-scheduler.service.spec --no-coverage
```

Expected: tests fail because the overdue-pass logic doesn't exist yet.

- [ ] **Step 3: Add the overdue pass to the scheduler**

In `apps/api/src/modules/rental-assets/lease-scheduler.service.ts`, replace the final `this.logger.log(...)` line (at the very end of `handleLeaseScheduler`) with:

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
      const tenant = await this.prisma.tenant.findUnique({ where: { id: inv.tenantId } });
      const config = (tenant?.config ?? {}) as {
        rentalLateFee?: { enabled?: boolean; flatAmountPaise?: number };
      };
      const lateFee = config.rentalLateFee;
      if (lateFee?.enabled && lateFee.flatAmountPaise) {
        await this.prisma.leaseInvoice.update({
          where: { id: inv.id },
          data: { lateFeePaise: lateFee.flatAmountPaise },
        });
      }
      this.logger.warn(`[LEASE INVOICE] ${inv.invoiceNo} is now OVERDUE`);
    }

    this.logger.log(
      `Lease scheduler completed. Created ${invoicesCreated} new invoice(s); flipped ${overdueCandidates.length} to OVERDUE.`,
    );
  }
```

- [ ] **Step 4: Run the tests, expect them to pass**

```bash
cd apps/api
pnpm test -- --testPathPattern=lease-scheduler.service.spec --no-coverage
```

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/rental-assets/lease-scheduler.service.ts apps/api/src/modules/rental-assets/lease-scheduler.service.spec.ts
git commit -m "feat(rentals): flip PENDING invoices to OVERDUE and apply tenant late fee"
```

---

## Task 11: Include latest invoice in `getAssets` response

**Files:**

- Modify: `apps/api/src/modules/rental-assets/rental-assets.service.ts`

- [ ] **Step 1: Update the include to fetch the latest invoice**

Find the `return this.prisma.rentalAsset.findMany({...})` in `getAssets` (around line 49). Replace its `include` block with:

```typescript
      include: {
        agreements: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            invoices: {
              orderBy: { periodStart: 'desc' },
              take: 1,
            },
          },
        },
      },
```

- [ ] **Step 2: Run the existing service tests to confirm no regression**

```bash
cd apps/api
pnpm test -- --testPathPattern=rental-assets.service.spec --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/rental-assets/rental-assets.service.ts
git commit -m "feat(rentals): include latest invoice in getAssets response for payment-status pill"
```

---

## Task 12: Add `lessorPhone` input to the New Lease Agreement form

**Files:**

- Modify: `apps/api/src/modules/rental-assets/dto/rental-assets.dto.ts`
- Modify: `apps/api/src/modules/rental-assets/rental-assets.service.ts`
- Modify: `apps/admin-tenant/app/rental-assets/new/page.tsx`

- [ ] **Step 1: Add the optional DTO field**

In `rental-assets.dto.ts`, inside `CreateLeaseAgreementDto`, after `agreementDocumentKey?`, add:

```typescript
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lessorPhone?: string;
```

(Add `MaxLength` to the existing `class-validator` import line.)

- [ ] **Step 2: Persist the field on the agreement**

In `rental-assets.service.ts`, in the `tx.leaseAgreement.create({ data: { ... } })` call inside `createAgreement`, add:

```typescript
          lessorPhone: dto.lessorPhone,
```

- [ ] **Step 3: Add a phone field to the UI form**

In `apps/admin-tenant/app/rental-assets/new/page.tsx`:

- Add `'lessorPhone'` to the `formData` state initializer (`''`)
- Add a `TextField` block in the Lessor Name column (or as a new row) with label "Lessor Phone (for portal access)" and an info note: "Optional. Enter phone to let the lessor view & pay rent online."

- [ ] **Step 4: Pass the field in the submission**

In the same file, inside the `body: JSON.stringify({...})` call, add `lessorPhone: formData.lessorPhone.trim() || undefined`.

- [ ] **Step 5: Run the linter**

```bash
cd apps/admin-tenant
pnpm lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/rental-assets/dto/rental-assets.dto.ts apps/api/src/modules/rental-assets/rental-assets.service.ts apps/admin-tenant/app/rental-assets/new/page.tsx
git commit -m "feat(rentals): capture lessor phone for citizen portal lookup"
```

---

## Task 13: Build the smart payment-status pill in the operator grid

**Files:**

- Modify: `apps/admin-tenant/app/rental-assets/page.tsx`

- [ ] **Step 1: Add the derivation helper**

At the top of `page.tsx` (after the existing `STATUS_LABELS` constant), add:

```typescript
type PaymentHealth = 'PAID' | 'DUE' | 'UPCOMING' | 'OVERDUE' | 'NO_INVOICE';

function derivePaymentHealth(asset: RentalAsset): PaymentHealth {
  if (asset.status !== 'RENTED') return 'NO_INVOICE';
  const lease = asset.agreements?.[0];
  const inv = lease?.invoices?.[0];
  if (!inv) return 'NO_INVOICE';
  if (inv.status === 'PAID') return 'PAID';
  if (inv.status === 'OVERDUE') return 'OVERDUE';
  // PENDING
  const due = new Date(inv.dueDate);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return due <= sevenDaysFromNow ? 'DUE' : 'UPCOMING';
}

const PAYMENT_HEALTH_LABEL: Record<PaymentHealth, string> = {
  PAID: 'Paid',
  DUE: 'Due',
  UPCOMING: 'Upcoming',
  OVERDUE: 'Overdue',
  NO_INVOICE: '—',
};

const PAYMENT_HEALTH_TONE: Record<PaymentHealth, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  PAID: 'success',
  DUE: 'warning',
  UPCOMING: 'info',
  OVERDUE: 'danger',
  NO_INVOICE: 'neutral',
};
```

- [ ] **Step 2: Replace the static Status badge with the smart pill**

Find the `DataTableRow` block in the table and replace the cell that renders the static `Badge` with a pill that uses the new derivation. Use the existing `Badge` component with `tone={PAYMENT_HEALTH_TONE[health]}` and `PAYMENT_HEALTH_LABEL[health]`. Show the underlying status (e.g. `Maintenance`) when the asset is not `RENTED` (i.e. `health === 'NO_INVOICE'`).

- [ ] **Step 3: Run the linter**

```bash
cd apps/admin-tenant
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-tenant/app/rental-assets/page.tsx
git commit -m "feat(rentals): smart payment-health pill in operator grid"
```

---

## Task 14: Build the `RecordRentPaymentModal` component

**Files:**

- Create: `apps/admin-tenant/components/record-rent-payment-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { Button, FieldLabel, SelectField, TextField, useToast } from '@enagar/ui';
import { useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type LeaseInvoice = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'WAIVED';
  dueDate: string;
};

const METHOD_OPTIONS = [
  { value: 'CASH_AT_DESK', label: 'Cash at desk' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer (NEFT/RTGS)' },
  { value: 'CHEQUE', label: 'Cheque / DD' },
  { value: 'ONLINE_GATEWAY', label: 'Online gateway (citizen will pay)' },
];

export function RecordRentPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: LeaseInvoice | null;
  onClose: () => void;
  onRecorded: () => void;
}): JSX.Element | null {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [method, setMethod] = useState<typeof METHOD_OPTIONS[number]['value']>('CASH_AT_DESK');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;
  const total = invoice.amountPaise + invoice.lateFeePaise;
  const requiresRef = method === 'BANK_TRANSFER' || method === 'CHEQUE';

  const handleSubmit = async () => {
    if (requiresRef && !referenceNumber.trim()) {
      toast('Reference number is required for this method.', 'danger');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/lease-invoices/${invoice.id}/pay`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          method,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        toast('Session expired — please sign in again.', 'danger');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        toast(msg || 'Could not record payment.', 'danger');
        return;
      }
      const data = await res.json();
      if (method === 'ONLINE_GATEWAY') {
        window.location.assign(data.redirectUrl);
        return;
      }
      toast(
        `Payment recorded. Receipt #${data.receipt?.receiptNumber ?? 'generated'}.`,
        'success',
      );
      onRecorded();
      onClose();
    } catch (err) {
      console.error(err);
      toast('Could not reach the API.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-warm-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted hover:bg-canvas"
        >
          ✕
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Record Payment
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink-primary">{invoice.invoiceNo}</h2>
        <dl className="mt-4 space-y-1 rounded-xl border border-warm-border bg-canvas/40 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-secondary">Base rent</dt>
            <dd className="font-semibold">₹{(invoice.amountPaise / 100).toLocaleString('en-IN')}</dd>
          </div>
          {invoice.lateFeePaise > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">Late fee</dt>
              <dd className="font-semibold text-danger">
                ₹{(invoice.lateFeePaise / 100).toLocaleString('en-IN')}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-warm-border pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold">₹{(total / 100).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel htmlFor="method">Method</FieldLabel>
            <SelectField
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </SelectField>
          </div>
          {requiresRef ? (
            <div>
              <FieldLabel htmlFor="ref">Reference number *</FieldLabel>
              <TextField
                id="ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., NEFT-2026-0001"
              />
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
            <TextField
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lessor name, ID, remarks…"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting}>
            {method === 'ONLINE_GATEWAY' ? 'Generate payment link' : 'Record payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the linter**

```bash
cd apps/admin-tenant
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-tenant/components/record-rent-payment-modal.tsx
git commit -m "feat(rentals): add reusable RecordRentPaymentModal component"
```

---

## Task 15: Wire invoice section into the View Lease modal

**Files:**

- Modify: `apps/admin-tenant/app/rental-assets/page.tsx`

- [ ] **Step 1: Add state for the invoice being paid**

Inside `RentalAssetsContent`, add:

```typescript
const [payingInvoice, setPayingInvoice] = useState<LeaseInvoice | null>(null);
```

(Extend the `LeaseAgreement` type to include `invoices: LeaseInvoice[]`.)

- [ ] **Step 2: Extend `LeaseDetailModal` to show invoices + a Record Payment button**

Replace the existing `LeaseDetailModal` body (between `<h2>` and the closing buttons) with:

```tsx
<div className="mt-5">
  <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Invoices</p>
  {lease.invoices && lease.invoices.length > 0 ? (
    <ul className="mt-2 divide-y divide-warm-border rounded-xl border border-warm-border">
      {lease.invoices.map((inv) => (
        <li key={inv.id} className="flex items-center justify-between gap-2 p-3 text-sm">
          <div>
            <p className="font-mono text-xs text-ink-primary">{inv.invoiceNo}</p>
            <p className="text-xs text-ink-muted">
              Due {formatDate(inv.dueDate)} · ₹{((inv.amountPaise + inv.lateFeePaise) / 100).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning'}>
              {inv.status}
            </Badge>
            {inv.status === 'PENDING' || inv.status === 'OVERDUE' ? (
              <Button size="sm" onClick={() => onRecordPayment(inv)}>
                Record Payment
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-ink-muted">No invoices yet.</p>
  )}
</div>
```

Update the component signature to accept `onRecordPayment: (inv: LeaseInvoice) => void` and the parent call site accordingly.

- [ ] **Step 3: Render the new modal at the bottom of the page**

At the bottom of `RentalAssetsContent`, after `LeaseDetailModal`, add:

```tsx
<RecordRentPaymentModal
  invoice={payingInvoice}
  onClose={() => setPayingInvoice(null)}
  onRecorded={() => {
    // Trigger a refetch by toggling a refresh counter
    setRefreshKey((k) => k + 1);
  }}
/>
```

Add `const [refreshKey, setRefreshKey] = useState(0);` at the top and add `refreshKey` to the dependency array of the `fetchAssets` `useEffect`.

Import the new component at the top:

```typescript
import { RecordRentPaymentModal } from '../../components/record-rent-payment-modal';
```

- [ ] **Step 4: Run the linter**

```bash
cd apps/admin-tenant
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-tenant/app/rental-assets/page.tsx
git commit -m "feat(rentals): add invoice list and Record Payment action in lease modal"
```

---

## Task 16: Build the full invoice ledger page

**Files:**

- Create: `apps/admin-tenant/app/rental-assets/invoices/page.tsx`
- Modify: `apps/admin-tenant/lib/tenant-admin-nav.ts`

- [ ] **Step 1: Create the ledger page**

```tsx
'use client';

import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  KpiCard,
  PageHeader,
  SegmentedControl,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RecordRentPaymentModal } from '../../../../components/record-rent-payment-modal';
import { useTenantAdminSession } from '../../../../components/tenant-admin-session';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
type InvoiceRow = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: InvoiceStatus;
  dueDate: string;
  agreement: { id: string; lessorName: string; asset: { name: Record<string, string> } };
  payments: Array<{ id: string }>;
};

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'danger',
  WAIVED: 'neutral',
};

function InvoicesContent() {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ALL' | InvoiceStatus>('ALL');
  const [paying, setPaying] = useState<InvoiceRow | null>(null);

  const headers = useCallback((): HeadersInit => ({ authorization: `Bearer ${token}` }), [token]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`${apiBase}/lease-invoices${qs}`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as InvoiceRow[]);
    } catch (err) {
      console.error(err);
      toast('Could not load invoices.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers, status, toast]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    for (const r of rows) {
      const total = r.amountPaise + r.lateFeePaise;
      if (r.status === 'PAID') {
        collected += total;
        if (new Date(r.dueDate) >= monthStart) billed += total;
      } else if (r.status === 'PENDING' || r.status === 'OVERDUE') {
        outstanding += total;
        if (r.status === 'OVERDUE') overdue += total;
      }
    }
    return { billed, collected, outstanding, overdue };
  }, [rows]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rental Invoices"
        description="All rent invoices across active lease agreements."
        actions={
          <Button variant="secondary" onClick={() => void fetchInvoices()}>
            Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Billed (this month)" value={fmt(kpis.billed)} accent="default" />
        <KpiCard label="Collected" value={fmt(kpis.collected)} accent="success" />
        <KpiCard label="Outstanding" value={fmt(kpis.outstanding)} accent="warning" />
        <KpiCard label="Overdue" value={fmt(kpis.overdue)} accent="danger" />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-warm-border p-4">
          <SegmentedControl
            aria-label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'PAID', label: 'Paid' },
              { value: 'WAIVED', label: 'Waived' },
            ]}
          />
        </div>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Invoice</DataTableHeaderCell>
              <DataTableHeaderCell>Asset / Lessor</DataTableHeaderCell>
              <DataTableHeaderCell>Due Date</DataTableHeaderCell>
              <DataTableHeaderCell>Amount</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  Loading…
                </DataTableCell>
              </DataTableRow>
            ) : rows.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  No invoices match the current filter.
                </DataTableCell>
              </DataTableRow>
            ) : (
              rows.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>
                    <span className="font-mono text-xs">{r.invoiceNo}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{r.agreement.asset.name?.en ?? '—'}</span>
                      <span className="text-xs text-ink-muted">{r.agreement.lessorName}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {new Date(r.dueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="font-semibold">{fmt(r.amountPaise + r.lateFeePaise)}</span>
                    {r.lateFeePaise > 0 ? <span className="ml-1 text-xs text-danger">(incl. late fee)</span> : null}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {r.status === 'PENDING' || r.status === 'OVERDUE' ? (
                      <Button size="sm" onClick={() => setPaying(r)}>
                        Record Payment
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Card>
      <RecordRentPaymentModal
        invoice={paying}
        onClose={() => setPaying(null)}
        onRecorded={() => void fetchInvoices()}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ToastProvider>
      <InvoicesContent />
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Add to the sidebar nav**

In `apps/admin-tenant/lib/tenant-admin-nav.ts`, add a new entry after `rental-assets`:

```typescript
  {
    id: 'rental-invoices',
    label: 'Rental Invoices',
    href: '/rental-assets/invoices',
    icon: 'receipt',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/rental-assets/invoices'),
  },
```

- [ ] **Step 3: Run the linter**

```bash
cd apps/admin-tenant
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-tenant/app/rental-assets/invoices/ apps/admin-tenant/lib/tenant-admin-nav.ts
git commit -m "feat(rentals): add full invoice ledger page with KPIs and payment recording"
```

---

## Task 17: Citizen portal — leases list page

**Files:**

- Create: `apps/citizen-portal/app/leases/page.tsx`
- Create: `apps/citizen-portal/app/leases/_components/lease-card.tsx` (if needed)

- [ ] **Step 1: Inspect the existing citizen portal auth pattern**

```bash
ls apps/citizen-portal/lib
ls apps/citizen-portal/components
```

Identify the session/auth helper. Note the file paths for use in the next step.

- [ ] **Step 2: Create the leases page**

Create `apps/citizen-portal/app/leases/page.tsx`:

```tsx
'use client';

import { AlertBanner, Badge, Button, Card, PageHeader, useToast } from '@enagar/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Import the existing session helper you identified in step 1.
// Example (adjust to actual path):
// import { useCitizenSession } from '../../lib/citizen-session';

type LeaseRow = {
  id: string;
  lessorName: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'DRAFT';
  asset: { name: Record<string, string>; assetType: string };
  invoices: Array<{
    id: string;
    invoiceNo: string;
    amountPaise: number;
    lateFeePaise: number;
    status: 'PENDING' | 'OVERDUE' | 'PAID' | 'WAIVED';
    dueDate: string;
  }>;
};

export default function CitizenLeasesPage() {
  // Replace with the real session hook from your codebase
  const session = { token: '', phone: '' } as { token: string; phone: string };
  // const session = useCitizenSession();

  const { toast } = useToast();
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.token || !session.phone) {
      setLoading(false);
      return;
    }
    const fetchLeases = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/lease-invoices/lookup?phone=${encodeURIComponent(session.phone)}`,
          { headers: { authorization: `Bearer ${session.token}` } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setLeases((await res.json()) as LeaseRow[]);
      } catch (err) {
        console.error(err);
        toast('Could not load your leases.', 'danger');
      } finally {
        setLoading(false);
      }
    };
    void fetchLeases();
  }, [session.token, session.phone, toast]);

  if (!session.token) {
    return (
      <div className="p-6">
        <AlertBanner tone="warning" title="Please sign in">
          You must be signed in to view your leases.
        </AlertBanner>
      </div>
    );
  }

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="My Leases" description="Your active rental agreements with the ULB." />
      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : leases.length === 0 ? (
        <AlertBanner tone="info" title="No leases found">
          We could not find any active leases linked to your phone number. Contact the ULB desk if this is unexpected.
        </AlertBanner>
      ) : (
        leases.map((lease) => (
          <Card key={lease.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{lease.asset.name?.en ?? 'Asset'}</h2>
                <p className="text-sm text-ink-muted">
                  {new Date(lease.startDate).toLocaleDateString('en-IN')} →{' '}
                  {new Date(lease.endDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <Badge tone={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>{lease.status}</Badge>
            </div>
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-secondary">Invoices</h3>
            <ul className="mt-2 divide-y divide-warm-border rounded-xl border border-warm-border">
              {lease.invoices.length === 0 ? (
                <li className="p-3 text-sm text-ink-muted">No invoices yet.</li>
              ) : (
                lease.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-mono text-xs">{inv.invoiceNo}</p>
                      <p className="text-xs text-ink-muted">
                        Due {new Date(inv.dueDate).toLocaleDateString('en-IN')} ·{' '}
                        {fmt(inv.amountPaise + inv.lateFeePaise)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'warning'}>
                        {inv.status}
                      </Badge>
                      {inv.status === 'PENDING' || inv.status === 'OVERDUE' ? (
                        <Button asChild size="sm">
                          <Link href={`/leases/pay?invoiceId=${inv.id}`}>Pay Now</Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the linter**

```bash
cd apps/citizen-portal
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/citizen-portal/app/leases/
git commit -m "feat(citizen-portal): add leases list page with invoice and Pay Now"
```

---

## Task 18: Citizen portal — payment page

**Files:**

- Create: `apps/citizen-portal/app/leases/pay/page.tsx`

- [ ] **Step 1: Create the payment page**

```tsx
'use client';

import { AlertBanner, Button, Card, PageHeader, useToast } from '@enagar/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PayPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const invoiceId = search.get('invoiceId');
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setError('No invoice specified.');
      setLoading(false);
      return;
    }
    const startPayment = async () => {
      try {
        const session = { token: '' };
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/lease-invoices/${invoiceId}/pay`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${session.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            method: 'ONLINE_GATEWAY',
            returnUrl: `${window.location.origin}/leases/pay/return`,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        window.location.assign(data.redirectUrl);
      } catch (err) {
        console.error(err);
        setError('Could not start payment. Please try again from the leases page.');
        setLoading(false);
      }
    };
    void startPayment();
  }, [invoiceId, toast]);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Redirecting…" description="Taking you to the payment gateway." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <AlertBanner tone="danger" title="Payment error">
          {error}
        </AlertBanner>
        <Button className="mt-4" onClick={() => router.push('/leases')}>
          Back to my leases
        </Button>
      </div>
    );
  }
  return null;
}

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Run the linter**

```bash
cd apps/citizen-portal
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/citizen-portal/app/leases/pay/
git commit -m "feat(citizen-portal): add invoice payment page that redirects to gateway"
```

---

## Task 19: Manual smoke test the full flow

**Files:** none (verification)

- [x] **Step 1: Start the API and admin-tenant dev servers**

```bash
pnpm --filter @enagar/api dev
pnpm --filter @enagar/admin-tenant dev
```

- [ ] **Step 2: Sign in to the admin tenant, navigate to Rental Assets**

- Verify a rented asset now shows the **Lessor** column.
- Verify the smart **Payment** pill shows the correct health.

- [ ] **Step 3: Click "View Lease" on a rented asset**

- Verify the modal shows the active lease.
- Verify the **Invoices** list is populated.

- [ ] **Step 4: Click "Record Payment" on a PENDING or OVERDUE invoice**

- Verify the **RecordRentPaymentModal** opens.
- Choose **Cash at desk**, click **Record payment**.
- Verify the success toast and that the invoice disappears from the unpaid list.

- [ ] **Step 5: Navigate to "Rental Invoices" in the sidebar**

- Verify the ledger page loads with KPIs and the table.
- Apply a status filter, verify the list updates.

- [ ] **Step 6: Run the lease scheduler manually (or wait for 2 AM)**

Add a one-time test invocation (or use `npx nest start --entryFile` with a CLI test wrapper if available). Confirm:

- A new PENDING invoice appears for a future period of an ACTIVE lease.
- An invoice past its `dueDate` flips to `OVERDUE` and a late fee is applied.

- [ ] **Step 7: Sign in to the citizen portal, navigate to /leases**

- Verify the lessor's phone lookup returns their active lease.
- Click **Pay Now** on a PENDING invoice, verify the redirect to the stub gateway.
- Complete the stub payment, verify the invoice shows PAID.

- [ ] **Step 8: Commit any final tweaks**

```bash
git status
# If there are fixes from the smoke test:
git add -A
git commit -m "chore(rentals): smoke-test fixes"
```

---

## Self-Review

**1. Spec coverage:**

- Section 2 (Data Model): covered by Task 1 ✅, Task 6 (late fee field added by applyLateFeeIfOverdue) ✅
- Section 3 (Backend): covered by Tasks 3–9 (recordPayment, listInvoices, getInvoice, controller, module) ✅
- Section 3.2 (overdue pass): covered by Task 10 ✅
- Section 4.1 (smart pill): covered by Task 13 ✅
- Section 4.2 (Record Payment modal in lease view): covered by Tasks 14–15 ✅
- Section 4.3 (full invoice ledger): covered by Task 16 ✅
- Section 5 (citizen portal): covered by Tasks 17–18 ✅
- Section 6 (edge cases): Concurrent payment is handled by `status === 'PAID'` check inside `recordPayment` (Task 4) ✅
- Section 7 (testing): unit (Tasks 3, 5, 6, 8), integration (none in this plan — left for follow-up), smoke (Task 19) ✅
- Section 8 (migration): Tasks 1 and 12 handle the schema and the lessorPhone field ✅
- Section 9 (out of scope): explicitly excluded ✅

**2. Placeholder scan:** No "TBD", "TODO", or "similar to" placeholders remain.

**3. Type consistency:** `LeaseInvoice` and `LeaseAgreement` types are defined consistently in `rental-assets.service.ts` (Task 11), `record-rent-payment-modal.tsx` (Task 14), `rental-assets/page.tsx` (Task 15), `invoices/page.tsx` (Task 16), and `leases/page.tsx` (Task 17). The `LeaseAgreement.invoices` property is added in Task 11 (backend) and used in Task 13/15 (frontend).

**4. Note on the LeaseInvoice.invoices path:** Task 11 includes `invoices: { take: 1 }` on the active agreement in `getAssets`. Task 15's UI reads `lease.invoices` from this nested structure. The types in `rental-assets/page.tsx` need to be updated in Task 15 to include `invoices: LeaseInvoice[]` on the agreement — done as part of Step 1 of that task.
