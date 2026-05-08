ALTER TABLE applications
  DROP CONSTRAINT applications_payment_status_check,
  ADD CONSTRAINT applications_payment_status_check CHECK (
    payment_status IN ('not_required', 'pending', 'paid', 'failed')
  );

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  citizen_subject VARCHAR(255) NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'requires_action',
  gateway VARCHAR(80) NOT NULL,
  gateway_order_id VARCHAR(160) NOT NULL,
  gateway_payment_id VARCHAR(160),
  failure_code VARCHAR(80),
  failure_message VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_amount_paise_check CHECK (amount_paise > 0),
  CONSTRAINT payments_currency_check CHECK (currency = 'INR'),
  CONSTRAINT payments_method_check CHECK (
    method IN ('upi', 'card', 'netbanking', 'wallet')
  ),
  CONSTRAINT payments_status_check CHECK (
    status IN ('requires_action', 'settled', 'failed')
  ),
  CONSTRAINT payments_gateway_order_unique UNIQUE (tenant_id, gateway, gateway_order_id)
);

CREATE TABLE payment_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_subject VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT payment_idempotency_keys_unique UNIQUE (
    tenant_id,
    citizen_subject,
    idempotency_key
  ),
  CONSTRAINT payment_idempotency_keys_expiry_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX payments_one_active_application_payment_idx
  ON payments (application_id)
  WHERE status = 'requires_action';

CREATE INDEX payments_tenant_citizen_created_idx
  ON payments (tenant_id, citizen_subject, created_at);
CREATE INDEX payments_tenant_application_status_idx
  ON payments (tenant_id, application_id, status);
CREATE INDEX payment_idempotency_keys_tenant_payment_idx
  ON payment_idempotency_keys (tenant_id, payment_id);

CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON payment_idempotency_keys
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE payment_idempotency_keys ENABLE ROW LEVEL SECURITY;
