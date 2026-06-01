-- Phase 13B (ADR-0013): per-line payment identity on payments rows.

ALTER TABLE payments
  ADD COLUMN fee_code VARCHAR(30);

UPDATE payments
SET fee_code = 'approval'
WHERE fee_code IS NULL;

ALTER TABLE payments
  ALTER COLUMN fee_code SET NOT NULL;

ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (fee_code IN ('application', 'approval'));

DROP INDEX IF EXISTS payments_one_active_application_payment_idx;

CREATE UNIQUE INDEX payments_one_active_application_fee_idx
  ON payments (application_id, fee_code)
  WHERE status = 'requires_action';
