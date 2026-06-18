CREATE TYPE "EvSessionStatus" AS ENUM ('HELD', 'CHARGING', 'COMPLETED', 'CANCELLED');

CREATE TABLE ev_chargers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  connector_type VARCHAR(20) NOT NULL,
  max_kw NUMERIC(6, 2) NOT NULL,
  rate_paise_per_kwh INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ev_chargers_unique UNIQUE (tenant_id, code),
  CONSTRAINT ev_chargers_rate_check CHECK (rate_paise_per_kwh > 0),
  CONSTRAINT ev_chargers_max_kw_check CHECK (max_kw > 0)
);

CREATE INDEX ev_chargers_tenant_active_idx ON ev_chargers (tenant_id, is_active);

CREATE POLICY tenant_isolation ON ev_chargers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE ev_chargers ENABLE ROW LEVEL SECURITY;

CREATE TABLE ev_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  charger_id UUID NOT NULL REFERENCES ev_chargers(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  status "EvSessionStatus" NOT NULL DEFAULT 'HELD',
  hold_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  kwh_consumed NUMERIC(10, 3),
  amount_paise INTEGER,
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ev_sessions_amount_check CHECK (amount_paise IS NULL OR amount_paise >= 0)
);

CREATE INDEX ev_sessions_tenant_charger_status_idx ON ev_sessions (tenant_id, charger_id, status);
CREATE INDEX ev_sessions_tenant_citizen_status_idx ON ev_sessions (tenant_id, citizen_id, status);
CREATE INDEX ev_sessions_tenant_status_hold_expires_idx ON ev_sessions (tenant_id, status, hold_expires_at);

CREATE UNIQUE INDEX ev_sessions_active_charger_idx
  ON ev_sessions (charger_id)
  WHERE status IN ('HELD', 'CHARGING');

CREATE UNIQUE INDEX ev_sessions_active_citizen_idx
  ON ev_sessions (tenant_id, citizen_id)
  WHERE status IN ('HELD', 'CHARGING');

CREATE POLICY tenant_isolation ON ev_sessions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE ev_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE payments
  ADD COLUMN ev_session_id UUID REFERENCES ev_sessions(id) ON DELETE SET NULL;

CREATE INDEX payments_tenant_ev_session_idx ON payments (tenant_id, ev_session_id);
