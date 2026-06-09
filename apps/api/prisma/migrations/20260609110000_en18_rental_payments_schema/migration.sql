-- EN-18: rental invoice payments & late fees
-- Adds Payment↔LeaseInvoice link, late-fee column on LeaseInvoice, and
-- lessor contact fields on LeaseAgreement (phone + optional Citizen link
-- for in-app communication with the lessor).

-- Payment.lease_invoice_id (nullable; preserves the existing per-tenant payment
-- model for applications and booking reservations).
ALTER TABLE payments
  ADD COLUMN lease_invoice_id UUID REFERENCES lease_invoices(id) ON DELETE SET NULL;

CREATE INDEX payments_tenant_id_lease_invoice_id_status_idx
  ON payments (tenant_id, lease_invoice_id, status);

-- LeaseInvoice.late_fee_paise: tracked in paise (1/100 INR) alongside amountPaise.
ALTER TABLE lease_invoices
  ADD COLUMN late_fee_paise INTEGER NOT NULL DEFAULT 0;

-- LeaseAgreement.lessor_phone + lessor_citizen_id (optional link to a registered
-- Citizen for SMS/notification routing).
ALTER TABLE lease_agreements
  ADD COLUMN lessor_phone VARCHAR(20);

ALTER TABLE lease_agreements
  ADD COLUMN lessor_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL;
