-- EN-18 follow-up: apply the constraint extensions from
-- 20260609140000_en18_relax_payment_constraints that didn't run when the
-- migration failed at `ADD COLUMN receipts.lease_invoice_id` (the column
-- already existed on the dev DB, so the rest of the migration was
-- effectively skipped). We mark the original migration as applied
-- (see `prisma migrate resolve --applied`) and re-apply the constraint
-- parts here, idempotently.

-- 1) Make sure the lease_invoice_id index from the original migration exists
--    (it is also idempotent, so re-running is safe).
CREATE INDEX IF NOT EXISTS receipts_tenant_id_lease_invoice_id_idx
  ON receipts (tenant_id, lease_invoice_id);

-- 2) Extend target_check on payments
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_target_check;
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

-- 3) Extend target_check on receipts
ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_target_check;
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

-- 4) Extend method_check (additive: cash, bank_transfer, cheeque)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_method_check CHECK (
    method IN (
      'upi', 'card', 'netbanking', 'wallet',
      'cash', 'bank_transfer', 'cheque'
    )
  );

-- 5) Extend status_check (additive: succeeded)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check CHECK (
    status IN (
      'requires_action', 'settled', 'failed', 'succeeded'
    )
  );

-- 6) Extend fee_code_check (additive: rental)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_fee_code_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (
    fee_code IN (
      'application', 'approval', 'booking_deposit', 'rental'
    )
  );
