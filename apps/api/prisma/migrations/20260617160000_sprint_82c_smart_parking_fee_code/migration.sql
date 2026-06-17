-- Sprint 8.2C: allow smart parking rent payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_fee_code_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (
    fee_code IN (
      'application', 'approval', 'booking_deposit', 'rental', 'smart_parking'
    )
  );
