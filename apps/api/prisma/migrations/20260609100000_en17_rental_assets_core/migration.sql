-- EN-17: rental assets core (RentalAsset, LeaseAgreement, LeaseInvoice)
-- Required before EN-18, which links payments to lease_invoices.

CREATE TYPE "RentalAssetType" AS ENUM ('HOARDING', 'MARKET_STALL', 'LAND', 'COMMUNITY_HALL_LONG_TERM', 'OTHER');
CREATE TYPE "RentalAssetStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RESERVED');
CREATE TYPE "LeaseAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');
CREATE TYPE "LeaseInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');
CREATE TYPE "RatePeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

CREATE TABLE "rental_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "asset_type" "RentalAssetType" NOT NULL,
    "name" JSONB NOT NULL,
    "location" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" "RentalAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "base_lease_rate_paise" INTEGER NOT NULL DEFAULT 0,
    "rate_period" "RatePeriod" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rental_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_agreements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "trade_license_no" VARCHAR(100) NOT NULL,
    "lessor_name" VARCHAR(255) NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "security_deposit_paise" INTEGER NOT NULL DEFAULT 0,
    "status" "LeaseAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "agreement_document_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lease_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lease_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "invoice_no" VARCHAR(100) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "status" "LeaseInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lease_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rental_assets_tenant_id_status_idx" ON "rental_assets"("tenant_id", "status");
CREATE INDEX "lease_agreements_tenant_id_status_idx" ON "lease_agreements"("tenant_id", "status");
CREATE INDEX "lease_agreements_tenant_id_trade_license_no_idx" ON "lease_agreements"("tenant_id", "trade_license_no");
CREATE INDEX "lease_invoices_tenant_id_status_due_date_idx" ON "lease_invoices"("tenant_id", "status", "due_date");
CREATE UNIQUE INDEX "lease_invoices_tenant_id_invoice_no_key" ON "lease_invoices"("tenant_id", "invoice_no");

ALTER TABLE "rental_assets" ADD CONSTRAINT "rental_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "rental_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_invoices" ADD CONSTRAINT "lease_invoices_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "lease_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lease_invoices" ADD CONSTRAINT "lease_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
