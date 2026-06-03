-- Sprint 8.1C: allow booking_deposit fee line on payments

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_fee_code_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (fee_code IN ('application', 'approval', 'booking_deposit'));
