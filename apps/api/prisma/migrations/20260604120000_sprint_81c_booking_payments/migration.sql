-- Sprint 8.1C: booking-scoped payments, deposits, and receipt linkage

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_type_check;
ALTER TABLE deposits
  ADD CONSTRAINT deposits_type_check CHECK (
    deposit_type IN ('emd', 'security', 'rent_deposit', 'other', 'booking_security', 'hall_booking')
  );

ALTER TABLE payments
  ALTER COLUMN application_id DROP NOT NULL;

ALTER TABLE payments
  ADD COLUMN booking_reservation_id UUID REFERENCES booking_reservations(id) ON DELETE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT payments_target_check CHECK (
    (application_id IS NOT NULL AND booking_reservation_id IS NULL)
    OR (application_id IS NULL AND booking_reservation_id IS NOT NULL)
  );

CREATE INDEX payments_tenant_booking_reservation_idx
  ON payments (tenant_id, booking_reservation_id)
  WHERE booking_reservation_id IS NOT NULL;

ALTER TABLE receipts
  ALTER COLUMN application_id DROP NOT NULL;

ALTER TABLE receipts
  ADD COLUMN booking_reservation_id UUID REFERENCES booking_reservations(id) ON DELETE SET NULL;

ALTER TABLE receipts
  ADD CONSTRAINT receipts_target_check CHECK (
    (application_id IS NOT NULL AND booking_reservation_id IS NULL)
    OR (application_id IS NULL AND booking_reservation_id IS NOT NULL)
  );

CREATE INDEX receipts_tenant_booking_reservation_idx
  ON receipts (tenant_id, booking_reservation_id)
  WHERE booking_reservation_id IS NOT NULL;
