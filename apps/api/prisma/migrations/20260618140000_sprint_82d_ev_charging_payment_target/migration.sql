-- Sprint 8.2D: allow payments targeted at EV charging sessions
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_target_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_target_check CHECK (
    (
      (application_id IS NOT NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NOT NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NOT NULL)
      AND (ev_session_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NOT NULL)
    )
  );
