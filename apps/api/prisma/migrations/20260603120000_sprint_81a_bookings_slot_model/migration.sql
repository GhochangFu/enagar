-- Sprint 8.1A: bookable asset commercial config, reservation identity, GiST anti-overlap

ALTER TABLE bookable_assets
  ADD COLUMN asset_type VARCHAR(50) NOT NULL DEFAULT 'HALL',
  ADD COLUMN rate_unit VARCHAR(10) NOT NULL DEFAULT 'HOUR',
  ADD COLUMN base_rate_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN security_deposit_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN slot_step_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN rules JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE bookable_assets
  ADD CONSTRAINT bookable_assets_asset_type_check
    CHECK (asset_type IN ('HALL', 'AUDITORIUM', 'GROUND', 'EQUIPMENT')),
  ADD CONSTRAINT bookable_assets_rate_unit_check
    CHECK (rate_unit IN ('HOUR', 'DAY')),
  ADD CONSTRAINT bookable_assets_base_rate_paise_check
    CHECK (base_rate_paise >= 0),
  ADD CONSTRAINT bookable_assets_security_deposit_paise_check
    CHECK (security_deposit_paise >= 0),
  ADD CONSTRAINT bookable_assets_slot_step_minutes_check
    CHECK (slot_step_minutes > 0);

ALTER TABLE booking_reservations
  ADD COLUMN booking_no VARCHAR(50),
  ADD COLUMN citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  ADD COLUMN deposit_id UUID REFERENCES deposits(id) ON DELETE SET NULL,
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancel_reason TEXT;

CREATE UNIQUE INDEX booking_reservations_tenant_booking_no_idx
  ON booking_reservations (tenant_id, booking_no)
  WHERE booking_no IS NOT NULL;

CREATE INDEX booking_reservations_tenant_citizen_idx
  ON booking_reservations (tenant_id, citizen_id);

CREATE INDEX booking_reservations_deposit_idx
  ON booking_reservations (deposit_id)
  WHERE deposit_id IS NOT NULL;

DROP INDEX IF EXISTS booking_reservations_no_overlap_idx;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_reservations
  ADD CONSTRAINT booking_reservations_no_time_overlap
  EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('hold', 'confirmed'));
