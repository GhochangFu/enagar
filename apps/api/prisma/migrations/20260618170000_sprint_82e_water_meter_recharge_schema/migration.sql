CREATE TYPE "WaterMeterRechargeStatus" AS ENUM ('PENDING', 'CREDITED', 'CANCELLED');

CREATE TABLE water_meter_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  meter_id VARCHAR(80) NOT NULL,
  consumer_name VARCHAR(160) NOT NULL,
  consumer_phone VARCHAR(15),
  balance_paise INTEGER NOT NULL DEFAULT 0,
  last_reading_litres INTEGER,
  last_reading_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT water_meter_accounts_unique UNIQUE (tenant_id, meter_id),
  CONSTRAINT water_meter_accounts_balance_check CHECK (balance_paise >= 0),
  CONSTRAINT water_meter_accounts_last_reading_check CHECK (
    last_reading_litres IS NULL OR last_reading_litres >= 0
  )
);

CREATE INDEX water_meter_accounts_tenant_phone_idx
  ON water_meter_accounts (tenant_id, consumer_phone);
CREATE INDEX water_meter_accounts_tenant_active_idx
  ON water_meter_accounts (tenant_id, is_active);

CREATE POLICY tenant_isolation ON water_meter_accounts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE water_meter_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE water_meter_recharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES water_meter_accounts(id) ON DELETE CASCADE,
  citizen_subject VARCHAR(255) NOT NULL,
  amount_paise INTEGER NOT NULL,
  status "WaterMeterRechargeStatus" NOT NULL DEFAULT 'PENDING',
  payment_id UUID UNIQUE,
  balance_after_paise INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMPTZ,
  CONSTRAINT water_meter_recharges_amount_check CHECK (amount_paise > 0),
  CONSTRAINT water_meter_recharges_balance_after_check CHECK (
    balance_after_paise IS NULL OR balance_after_paise >= 0
  )
);

CREATE INDEX water_meter_recharges_tenant_account_created_idx
  ON water_meter_recharges (tenant_id, account_id, created_at DESC);
CREATE INDEX water_meter_recharges_tenant_status_created_idx
  ON water_meter_recharges (tenant_id, status, created_at);

CREATE POLICY tenant_isolation ON water_meter_recharges
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE water_meter_recharges ENABLE ROW LEVEL SECURITY;

ALTER TABLE payments
  ADD COLUMN water_meter_recharge_id UUID REFERENCES water_meter_recharges(id) ON DELETE SET NULL;

CREATE INDEX payments_tenant_water_meter_recharge_idx
  ON payments (tenant_id, water_meter_recharge_id);

ALTER TABLE water_meter_recharges
  ADD CONSTRAINT water_meter_recharges_payment_fk
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

ALTER TABLE receipts
  ADD COLUMN water_meter_recharge_id UUID REFERENCES water_meter_recharges(id) ON DELETE SET NULL;

CREATE INDEX receipts_tenant_water_meter_recharge_idx
  ON receipts (tenant_id, water_meter_recharge_id);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_fee_code_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_fee_code_check CHECK (
    fee_code IN (
      'application',
      'approval',
      'booking_deposit',
      'rental',
      'smart_parking',
      'ev_charging',
      'water_recharge'
    )
  );

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_target_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_target_check CHECK (
    (
      (application_id IS NOT NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NOT NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NOT NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NOT NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NOT NULL)
    )
  );

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_target_check;

ALTER TABLE receipts
  ADD CONSTRAINT receipts_target_check CHECK (
    (
      (application_id IS NOT NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NOT NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NOT NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NOT NULL)
      AND (water_meter_recharge_id IS NULL)
    )
    OR (
      (application_id IS NULL)
      AND (booking_reservation_id IS NULL)
      AND (lease_invoice_id IS NULL)
      AND (ev_session_id IS NULL)
      AND (water_meter_recharge_id IS NOT NULL)
    )
  );
