-- Sprint 3.2: receipt records, GL posting groundwork, reconciliation-friendly columns.
ALTER TABLE payments
ADD COLUMN settled_at TIMESTAMPTZ;

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(48) NOT NULL,
  verification_token UUID NOT NULL,
  revenue_head_code VARCHAR(50) NOT NULL,
  accounting_code VARCHAR(50) NOT NULL,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  service_code VARCHAR(80) NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  gateway VARCHAR(80) NOT NULL,
  gateway_order_id VARCHAR(160) NOT NULL,
  gateway_payment_ref VARCHAR(160),
  qr_payload_version SMALLINT NOT NULL DEFAULT 1,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT receipts_amount_paise_check CHECK (amount_paise > 0),
  CONSTRAINT receipts_currency_check CHECK (currency = 'INR'),
  CONSTRAINT receipts_payment_unique UNIQUE (payment_id),
  CONSTRAINT receipts_receipt_number_unique UNIQUE (tenant_id, receipt_number),
  CONSTRAINT receipts_verification_token_unique UNIQUE (verification_token)
);

CREATE INDEX receipts_tenant_issued_idx ON receipts (tenant_id, issued_at);
CREATE INDEX receipts_tenant_application_idx ON receipts (tenant_id, application_id);

CREATE POLICY tenant_isolation ON receipts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE gl_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  revenue_head_code VARCHAR(50) NOT NULL,
  debit_account_code VARCHAR(50) NOT NULL,
  credit_account_code VARCHAR(50) NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  settlement_reference VARCHAR(160) NOT NULL,
  gateway VARCHAR(80) NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gl_postings_amount_paise_check CHECK (amount_paise > 0),
  CONSTRAINT gl_postings_currency_check CHECK (currency = 'INR'),
  CONSTRAINT gl_postings_payment_unique UNIQUE (payment_id),
  CONSTRAINT gl_postings_receipt_unique UNIQUE (receipt_id)
);

CREATE INDEX gl_postings_tenant_posted_idx ON gl_postings (tenant_id, posted_at);
CREATE INDEX gl_postings_tenant_settlement_idx ON gl_postings (tenant_id, settlement_reference);

CREATE POLICY tenant_isolation ON gl_postings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE gl_postings ENABLE ROW LEVEL SECURITY;
