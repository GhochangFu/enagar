# Rental Assets (EN-17) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete lifecycle for long-term rental assets (hoardings, land, market stalls), including mandatory trade license linkage, document upload, and automated recurring invoice generation.

**Architecture:** Three new Prisma models (`RentalAsset`, `LeaseAgreement`, `LeaseInvoice`) will isolate lease logic from short-term bookings. A transactional API route ensures an asset cannot be double-rented, while a daily cron job handles expiry alerts and dynamic invoice creation based on the lease's rate period.

**Tech Stack:** Prisma, PostgreSQL, Next.js (App Router), Zod, Node-cron (or existing scheduler), shadcn/ui (or existing table/form components).

---

### Task 1: Prisma Schema - Enums and Models

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Test: N/A (Schema validation)

- [ ] **Step 1: Add new Enums to schema.prisma**

Add the following enums near the top of `schema.prisma` (after existing enums):

```prisma
enum RentalAssetType {
  HOARDING
  MARKET_STALL
  LAND
  COMMUNITY_HALL_LONG_TERM
  OTHER
}

enum RentalAssetStatus {
  AVAILABLE
  RENTED
  MAINTENANCE
  RESERVED
}

enum LeaseAgreementStatus {
  DRAFT
  ACTIVE
  EXPIRED
  TERMINATED
}

enum LeaseInvoiceStatus {
  PENDING
  PAID
  OVERDUE
  WAIVED
}

enum RatePeriod {
  MONTHLY
  QUARTERLY
  YEARLY
}
```

- [ ] **Step 2: Add `RentalAsset` model to schema.prisma**

Add this model to `schema.prisma`:

```prisma
model RentalAsset {
  id                 String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId           String            @map("tenant_id") @db.Uuid
  assetType          RentalAssetType   @map("asset_type") @db.VarChar(50)
  name               Json
  location           Json              @default(dbgenerated("'{}'::jsonb"))
  status             RentalAssetStatus @default(AVAILABLE)
  baseLeaseRatePaise Int               @default(0) @map("base_lease_rate_paise")
  ratePeriod         RatePeriod        @map("rate_period") @db.VarChar(20)
  metadata           Json              @default(dbgenerated("'{}'::jsonb"))
  createdAt          DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime          @updatedAt @map("updated_at") @db.Timestamptz(6)

  agreements         LeaseAgreement[]
  tenant             Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, status])
  @@map("rental_assets")
}
```

- [ ] **Step 3: Add `LeaseAgreement` model to schema.prisma**

Add this model to `schema.prisma`:

```prisma
model LeaseAgreement {
  id                   String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String                @map("tenant_id") @db.Uuid
  assetId              String                @map("asset_id") @db.Uuid
  tradeLicenseNo       String                @map("trade_license_no") @db.VarChar(100)
  lessorName           String                @map("lessor_name") @db.VarChar(255)
  startDate            DateTime              @map("start_date") @db.Timestamptz(6)
  endDate              DateTime              @map("end_date") @db.Timestamptz(6)
  securityDepositPaise Int                   @default(0) @map("security_deposit_paise")
  status               LeaseAgreementStatus  @default(DRAFT)
  agreementDocumentKey String?               @map("agreement_document_key") @db.Text
  createdAt            DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime              @updatedAt @map("updated_at") @db.Timestamptz(6)

  asset                RentalAsset           @relation(fields: [assetId], references: [id], onDelete: Restrict)
  invoices             LeaseInvoice[]
  tenant               Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, status])
  @@index([tenantId, tradeLicenseNo])
  @@map("lease_agreements")
}
```

- [ ] **Step 4: Add `LeaseInvoice` model to schema.prisma**

Add this model to `schema.prisma`:

```prisma
model LeaseInvoice {
  id            String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String              @map("tenant_id") @db.Uuid
  agreementId   String              @map("agreement_id") @db.Uuid
  invoiceNo     String              @map("invoice_no") @db.VarChar(100)
  periodStart   DateTime            @map("period_start") @db.Timestamptz(6)
  periodEnd     DateTime            @map("period_end") @db.Timestamptz(6)
  dueDate       DateTime            @map("due_date") @db.Timestamptz(6)
  amountPaise   Int                 @map("amount_paise")
  status        LeaseInvoiceStatus  @default(PENDING)
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  agreement     LeaseAgreement      @relation(fields: [agreementId], references: [id], onDelete: Cascade)
  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, invoiceNo])
  @@index([tenantId, status, dueDate])
  @@map("lease_invoices")
}
```

- [ ] **Step 5: Run Prisma Migration**

Run the following command in the `apps/api` directory:

```bash
cd apps/api
npx prisma migrate dev --name add_rental_assets_and_leases
```

Expected: Migration succeeds, new tables and enums are created in the local database.

---

### Task 2: Zod Validation Schemas

**Files:**

- Create: `apps/api/src/zod/rental-assets.schema.ts`

- [ ] **Step 1: Create Zod schemas for validation**

Create the file `apps/api/src/zod/rental-assets.schema.ts` with the following content:

```typescript
import { z } from 'zod';
import { RentalAssetType, RatePeriod } from '@prisma/client';

export const createRentalAssetSchema = z.object({
  assetType: z.nativeEnum(RentalAssetType),
  name: z.record(z.string()), // Multilingual JSON
  location: z.record(z.unknown()), // JSONB location
  baseLeaseRatePaise: z.number().int().min(0),
  ratePeriod: z.nativeEnum(RatePeriod),
  metadata: z.record(z.unknown()).optional(),
});

export const createLeaseAgreementSchema = z
  .object({
    assetId: z.string().uuid(),
    tradeLicenseNo: z.string().min(1, 'Trade License Number is mandatory'),
    lessorName: z.string().min(1, 'Lessor name is required'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    securityDepositPaise: z.number().int().min(0).default(0),
    agreementDocumentKey: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
```

- [ ] **Step 2: Commit changes**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/zod/rental-assets.schema.ts
git commit -m "feat: add prisma models and zod schemas for rental assets"
```

---

### Task 3: Backend API Routes

**Files:**

- Create: `apps/api/src/routes/rental-assets.routes.ts` (or modify existing route registration)
- Modify: `apps/api/src/index.ts` (or main app entry point to register routes)

- [ ] **Step 1: Implement Rental Asset Routes**

Create or update the route handlers. Example structure:

```typescript
import { Router } from 'express'; // Or Next.js App Router equivalent
import { prisma } from '../db';
import { createRentalAssetSchema } from '../zod/rental-assets.schema';

const router = Router();

router.post('/', async (req, res) => {
  const validated = createRentalAssetSchema.parse(req.body);
  const asset = await prisma.rentalAsset.create({
    data: {
      tenantId: req.user.tenantId, // Assuming auth context
      ...validated,
    },
  });
  res.status(201).json(asset);
});

router.get('/', async (req, res) => {
  const { status } = req.query;
  const assets = await prisma.rentalAsset.findMany({
    where: {
      tenantId: req.user.tenantId,
      ...(status ? { status: status as string } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(assets);
});

export default router;
```

- [ ] **Step 2: Implement Transactional Lease Agreement Route**

Add this to the same router file:

```typescript
import { createLeaseAgreementSchema } from '../zod/rental-assets.schema';
import { Prisma } from '@prisma/client';

router.post('/agreements', async (req, res) => {
  const validated = createLeaseAgreementSchema.parse(req.body);
  const tenantId = req.user.tenantId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if asset is available
      const asset = await tx.rentalAsset.findUnique({
        where: { id: validated.assetId, tenantId },
      });
      if (!asset || asset.status !== 'AVAILABLE') {
        throw new Error('Asset is not available for lease');
      }

      // 2. Create agreement
      const agreement = await tx.leaseAgreement.create({
        data: {
          tenantId,
          assetId: validated.assetId,
          tradeLicenseNo: validated.tradeLicenseNo,
          lessorName: validated.lessorName,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          securityDepositPaise: validated.securityDepositPaise,
          status: 'ACTIVE',
          agreementDocumentKey: validated.agreementDocumentKey,
        },
      });

      // 3. Update asset status to RENTED
      await tx.rentalAsset.update({
        where: { id: validated.assetId },
        data: { status: 'RENTED' },
      });

      return agreement;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      res.status(400).json({ error: 'Database constraint violated' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
});
```

- [ ] **Step 3: Commit changes**

```bash
git add apps/api/src/routes/rental-assets.routes.ts apps/api/src/zod/rental-assets.schema.ts
git commit -m "feat: add transactional API routes for rental assets and agreements"
```

---

### Task 4: Background Cron Job for Invoices and Alerts

**Files:**

- Create: `apps/api/src/jobs/lease-scheduler.ts`
- Modify: `apps/api/src/index.ts` (to start the scheduler)

- [ ] **Step 1: Create the scheduler logic**

Create `apps/api/src/jobs/lease-scheduler.ts`:

```typescript
import { prisma } from '../db';

export async function runLeaseScheduler() {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  // 1. Expiry Alerts (Log or trigger notification system)
  const expiringAgreements = await prisma.leaseAgreement.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: thirtyDaysFromNow },
    },
    include: { asset: true },
  });

  if (expiringAgreements.length > 0) {
    console.log(`[LEASE ALERT] ${expiringAgreements.length} agreements expiring within 30 days.`);
    // TODO: Integrate with actual notification service here
  }

  // 2. Invoice Generation
  const activeAgreements = await prisma.leaseAgreement.findMany({
    where: { status: 'ACTIVE' },
    include: {
      invoices: {
        orderBy: { periodStart: 'desc' },
        take: 1,
      },
    },
  });

  for (const agreement of activeAgreements) {
    const lastInvoice = agreement.invoices[0];
    let nextPeriodStart: Date;
    let nextPeriodEnd: Date;

    if (!lastInvoice) {
      nextPeriodStart = agreement.startDate;
    } else {
      nextPeriodStart = new Date(lastInvoice.periodEnd);
      nextPeriodStart.setDate(nextPeriodStart.getDate() + 1); // Next day
    }

    // Calculate next period end based on ratePeriod
    nextPeriodEnd = new Date(nextPeriodStart);
    if (agreement.ratePeriod === 'MONTHLY') nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    else if (agreement.ratePeriod === 'QUARTERLY') nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 3);
    else if (agreement.ratePeriod === 'YEARLY') nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);

    // Only generate if the next period has started or is very close (e.g., within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    if (nextPeriodStart <= sevenDaysFromNow) {
      // Check if invoice already exists for this period to prevent duplicates
      const existing = await prisma.leaseInvoice.findFirst({
        where: {
          agreementId: agreement.id,
          periodStart: { equals: nextPeriodStart },
        },
      });

      if (!existing) {
        await prisma.leaseInvoice.create({
          data: {
            tenantId: agreement.tenantId,
            agreementId: agreement.id,
            invoiceNo: `INV-${agreement.id.slice(0, 8)}-${Date.now()}`,
            periodStart: nextPeriodStart,
            periodEnd: nextPeriodEnd,
            dueDate: nextPeriodStart,
            amountPaise: agreement.baseLeaseRatePaise,
            status: 'PENDING',
          },
        });
        console.log(`[LEASE INVOICE] Generated for agreement ${agreement.id}`);
      }
    }
  }
}
```

- [ ] **Step 2: Integrate with existing cron setup**

Modify your main entry point or cron registry to call `runLeaseScheduler` daily. Example using `node-cron`:

```typescript
import cron from 'node-cron';
import { runLeaseScheduler } from './jobs/lease-scheduler';

// Run daily at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running lease scheduler...');
  await runLeaseScheduler();
});
```

- [ ] **Step 3: Commit changes**

```bash
git add apps/api/src/jobs/lease-scheduler.ts apps/api/src/index.ts
git commit -m "feat: add daily cron job for lease expiry alerts and invoice generation"
```

---

### Task 5: Frontend UI - Asset Management and Marketing View

**Files:**

- Create: `apps/admin-tenant/app/rental-assets/page.tsx`
- Create: `apps/admin-tenant/components/rental-assets-table.tsx`

- [ ] **Step 1: Create the data fetching hook/utility**

Create a utility or hook to fetch assets. Example `apps/admin-tenant/lib/rental-assets.ts`:

```typescript
export async function getRentalAssets(status?: string) {
  const url = status ? `/api/rental-assets?status=${status}` : '/api/rental-assets';
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch assets');
  return res.json();
}
```

- [ ] **Step 2: Create the Asset Management Page**

Create `apps/admin-tenant/app/rental-assets/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { RentalAssetsTable } from '@/components/rental-assets-table';

export default function RentalAssetsPage() {
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE'>('ALL');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Rental Assets</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded ${filter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            All Assets
          </button>
          <button
            onClick={() => setFilter('AVAILABLE')}
            className={`px-3 py-1 rounded ${filter === 'AVAILABLE' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Available for Rent (Marketing)
          </button>
        </div>
      </div>

      <RentalAssetsTable statusFilter={filter === 'ALL' ? undefined : 'AVAILABLE'} />
    </div>
  );
}
```

- [ ] **Step 3: Create the Table Component**

Create `apps/admin-tenant/components/rental-assets-table.tsx` (using your existing table patterns, e.g., shadcn/ui):

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getRentalAssets } from '@/lib/rental-assets';

export function RentalAssetsTable({ statusFilter }: { statusFilter?: string }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRentalAssets(statusFilter)
      .then(setAssets)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (loading) return <div>Loading...</div>;

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {assets.map((asset) => (
          <tr key={asset.id}>
            <td className="px-6 py-4 whitespace-nowrap">{asset.name.en || 'Unnamed'}</td>
            <td className="px-6 py-4 whitespace-nowrap">{asset.assetType}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              {(asset.baseLeaseRatePaise / 100).toFixed(2)} / {asset.ratePeriod}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                ${asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
              >
                {asset.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Commit changes**

```bash
git add apps/admin-tenant/app/rental-assets/page.tsx apps/admin-tenant/components/rental-assets-table.tsx
git commit -m "feat: add rental assets management and marketing view UI"
```

---

### Task 6: Frontend UI - Lease Agreement Creation Form

**Files:**

- Create: `apps/admin-tenant/app/rental-assets/new-agreement/page.tsx`

- [ ] **Step 1: Create the Agreement Form**

Create `apps/admin-tenant/app/rental-assets/new-agreement/page.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { getRentalAssets } from '@/lib/rental-assets';

export default function NewAgreementPage() {
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    assetId: '',
    tradeLicenseNo: '',
    lessorName: '',
    startDate: '',
    endDate: '',
    securityDepositPaise: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getRentalAssets('AVAILABLE').then(setAvailableAssets);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rental-assets/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Agreement created successfully!');
      // Redirect to agreements list or asset details
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Lease Agreement</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Available Asset *</label>
          <select
            required
            className="w-full border rounded p-2"
            value={formData.assetId}
            onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
          >
            <option value="">Select an asset</option>
            {availableAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name.en} ({asset.assetType})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Trade License Number *</label>
          <input
            type="text"
            required
            className="w-full border rounded p-2"
            value={formData.tradeLicenseNo}
            onChange={(e) => setFormData({ ...formData, tradeLicenseNo: e.target.value })}
            placeholder="e.g., TL-2023-XYZ"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lessor Name *</label>
          <input
            type="text"
            required
            className="w-full border rounded p-2"
            value={formData.lessorName}
            onChange={(e) => setFormData({ ...formData, lessorName: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date *</label>
            <input
              type="date"
              required
              className="w-full border rounded p-2"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date *</label>
            <input
              type="date"
              required
              className="w-full border rounded p-2"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
        </div>

        {/* Note: Document upload would integrate the existing S3 signed URL component here, 
            setting the returned objectKey to a state variable and including it in formData */}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Agreement'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit changes**

```bash
git add apps/admin-tenant/app/rental-assets/new-agreement/page.tsx
git commit -m "feat: add lease agreement creation form with mandatory trade license"
```

---

### Task 7: Testing and Quality Assurance

**Files:**

- Create: `apps/api/src/modules/rental-assets/rental-assets.service.spec.ts`

- [ ] **Step 1: Write validation and concurrency tests**

Create the test file to ensure the business rules are strictly enforced:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'; // Or jest
import { prisma } from '../../db';
import { createLeaseAgreementSchema } from '../../zod/rental-assets.schema';

describe('Rental Assets Validation', () => {
  it('should reject agreement creation without tradeLicenseNo', () => {
    const invalidData = {
      assetId: '123e4567-e89b-12d3-a456-426614174000',
      lessorName: 'Test Corp',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    };

    const result = createLeaseAgreementSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('tradeLicenseNo');
  });
});

// Note: A full integration test for the $transaction concurrency
// would require a test database and parallel execution harness.
```

- [ ] **Step 2: Run tests**

Run the test suite to verify the new schemas and logic:

```bash
cd apps/api
npm test -- rental-assets.service.spec.ts
```

Expected: Tests PASS, confirming the Zod schema correctly rejects missing mandatory fields.

- [ ] **Step 3: Final Commit**

```bash
git add apps/api/src/modules/rental-assets/rental-assets.service.spec.ts
git commit -m "test: add validation tests for rental asset agreements"
```
