-- EN-18: extend Payment/Receipt with lease-invoice target & relax check constraints
--
-- The EN-18 schema migration (20260609110000) added payment.lease_invoice_id but
-- the corresponding column on receipts was never added. Receipts still require
-- an `application_id` or `booking_reservation_id` target (target_check) and
-- the payment table CHECK constraints only allow a fixed set of
-- `method`/`status`/`fee_code` values.
--
-- This migration:
--   1) adds receipts.lease_invoice_id (nullable; preserves the existing model
--      for application + booking reservation receipts);
--   2) extends payments_target_check and receipts_target_check so that
--      lease_invoice_id can be the third valid target. Exactly one of
--      {application_id, booking_reservation_id, lease_invoice_id} must be
--      NOT NULL on each row;
--   3) extends payments_method_check with `cash`, `bank_transfer`, `cheque`
--      for desk-collected rent;
--   4) extends payments_status_check with `succeeded` (alias for `settled`)
--      so that the EN-18 service contract matches the constraint;
--   5) extends payments_fee_code_check with `rental` for periodic lease
--      invoices.

-- 1) Add receipts.lease_invoice_id
ALTER TABLE receipts
  ADD COLUMN lease_invoice_id UUID REFERENCES lease_invoices(id) ON DELETE SET NULL;

CREATE INDEX receipts_tenant_id_lease_invoice_id_idx
  ON receipts (tenant_id, lease_invoice_id);

-- 2) Extend target_check on payments
ALTER TABLE payments
  DROP CONSTRAINT payments_target_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_target_check CHECK (
    (
      (application_id IS NOT NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NOT NULL)
      AND (lease_invoice_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NOT NULL)
    )
  );

-- 2b) Extend target_check on receipts
ALTER TABLE receipts
  DROP CONSTRAINT receipts_target_check;
ALTER TABLE receipts
  ADD CONSTRAINT receipts_target_check CHECK (
    (
      (application_id IS NOT NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NOT NULL)
      AND (lease_invoice_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NOT NULL)
    )
  );

-- 3) Extend method_check
ALTER TABLE payments
  DROP CONSTRAINT payments_method_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_method_check CHECK (
    method IN (
      'upi', 'card', 'netbanking', 'wallet',
      'cash', 'bank_transfer', 'cheque'
    )
  );

-- 4) Extend status_check
ALTER TABLE payments
  DROP CONSTRAINT payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check CHECK (
    status IN (
      'requires_action', 'settled', 'failed', 'succeeded'
    )
  );

-- 5) Extend fee_code_check
ALTER TABLE payments
  DROP CONSTRAINT payments_fee_code_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (
    fee_code IN (
      'application', 'approval', 'booking_deposit', 'rental'
    )
  );
