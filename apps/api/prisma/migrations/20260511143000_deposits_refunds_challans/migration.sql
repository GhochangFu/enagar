-- Sprint 3.3A: refundable deposits, finance refund approval queue (no PSP calls), enforcement challans

CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  deposit_type VARCHAR(30) NOT NULL,
  reference_code VARCHAR(120),
  amount_paise INTEGER NOT NULL,
  capture_payment_id UUID UNIQUE REFERENCES payments(id) ON DELETE SET NULL,
  expected_release_at TIMESTAMPTZ,
  status VARCHAR(40) NOT NULL DEFAULT 'held',
  forfeiture_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deposits_amount_paise_check CHECK (amount_paise > 0),
  CONSTRAINT deposits_type_check CHECK (
    deposit_type IN ('emd', 'security', 'rent_deposit', 'other')
  ),
  CONSTRAINT deposits_status_check CHECK (
    status IN (
      'held',
      'eligible_for_release',
      'refund_pending_review',
      'refund_approved',
      'refunded',
      'forfeited'
    )
  )
);

CREATE INDEX deposits_tenant_citizen_status_idx ON deposits (tenant_id, citizen_id, status);
CREATE INDEX deposits_tenant_application_idx ON deposits (tenant_id, application_id);

CREATE TABLE refund_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending_review',
  requested_by_subject VARCHAR(255) NOT NULL,
  reviewed_by_subject VARCHAR(255),
  review_note TEXT,
  psp_completion_note TEXT,
  rejected_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refund_dispatches_amount_check CHECK (amount_paise > 0),
  CONSTRAINT refund_dispatches_status_check CHECK (
    status IN ('pending_review', 'approved', 'rejected', 'completed_without_psp')
  )
);

CREATE UNIQUE INDEX refund_dispatches_open_queue_idx ON refund_dispatches (deposit_id)
WHERE status NOT IN ('rejected', 'completed_without_psp');

CREATE INDEX refund_dispatches_tenant_deposit_status_idx ON refund_dispatches (
  tenant_id,
  deposit_id,
  status
);

CREATE TABLE challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  challan_no VARCHAR(64) NOT NULL,
  issued_to_name VARCHAR(255),
  issued_to_mobile VARCHAR(15),
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  violation_code VARCHAR(80) NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::JSONB,
  issued_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_paise INTEGER NOT NULL,
  photo_evidence JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'issued',
  paid_at TIMESTAMPTZ,
  paid_payment_id UUID UNIQUE REFERENCES payments(id) ON DELETE SET NULL,
  waived_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT challans_amount_check CHECK (amount_paise > 0),
  CONSTRAINT challans_status_check CHECK (status IN ('issued', 'paid', 'disputed', 'waived'))
);

CREATE UNIQUE INDEX challans_tenant_no_unique_idx ON challans (tenant_id, challan_no);
CREATE INDEX challans_tenant_status_idx ON challans (tenant_id, status);

CREATE POLICY tenant_isolation ON deposits
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON refund_dispatches
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE refund_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON challans
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;
