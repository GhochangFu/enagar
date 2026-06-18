ALTER TABLE receipts
  ADD COLUMN ev_session_id UUID REFERENCES ev_sessions(id) ON DELETE SET NULL;

CREATE INDEX receipts_tenant_ev_session_idx ON receipts (tenant_id, ev_session_id);

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_target_check;

ALTER TABLE receipts
  ADD CONSTRAINT receipts_target_check CHECK (
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
