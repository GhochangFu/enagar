-- EN-19 / 2026-06-10: Applied manually because the shadow DB cannot replay the EN-18 history (the `lease_invoices` table was created out-of-band; the EN-18 migration references it but does not create it). To re-enable the normal `prisma migrate dev` flow, fix the EN-18 migration so it creates `lease_invoices` itself.
-- CreateEnum
CREATE TYPE "LeaseAgreementDocumentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaseAgreementDocumentEventType" AS ENUM ('UPLOADED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "generated_at" TIMESTAMPTZ(6),
ADD COLUMN     "sha256" CHAR(64),
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "storage_key" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "late_fee_paise" INTEGER;

-- Backfill: copy legacy Tenant.config.rentalLateFee.flatAmountPaise into the new column
UPDATE tenants
SET late_fee_paise = COALESCE((config -> 'rentalLateFee' ->> 'flatAmountPaise')::int, 0)
WHERE (config -> 'rentalLateFee' ->> 'flatAmountPaise') IS NOT NULL;

-- CreateTable
CREATE TABLE "lease_agreement_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "LeaseAgreementDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewer_note" TEXT,

    CONSTRAINT "lease_agreement_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease_agreement_document_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "event_type" "LeaseAgreementDocumentEventType" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lease_agreement_document_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lease_agreement_documents_tenant_id_status_uploaded_at_idx" ON "lease_agreement_documents"("tenant_id", "status", "uploaded_at");

-- CreateIndex
CREATE INDEX "lease_agreement_document_events_tenant_id_document_id_creat_idx" ON "lease_agreement_document_events"("tenant_id", "document_id", "created_at");

-- AddForeignKey
ALTER TABLE "lease_agreement_documents" ADD CONSTRAINT "lease_agreement_documents_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "lease_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreement_documents" ADD CONSTRAINT "lease_agreement_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreement_document_events" ADD CONSTRAINT "lease_agreement_document_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "lease_agreement_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_agreement_document_events" ADD CONSTRAINT "lease_agreement_document_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
