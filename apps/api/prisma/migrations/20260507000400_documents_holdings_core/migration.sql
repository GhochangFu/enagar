CREATE TABLE application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_code VARCHAR(80) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_mb DECIMAL(6, 2) NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  upload_status VARCHAR(30) NOT NULL DEFAULT 'intent_created',
  scan_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  scan_provider VARCHAR(80),
  scan_signature VARCHAR(160),
  scan_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT application_documents_size_check CHECK (size_mb > 0 AND size_mb <= 10),
  CONSTRAINT application_documents_upload_status_check CHECK (
    upload_status IN ('intent_created', 'uploaded', 'rejected')
  ),
  CONSTRAINT application_documents_scan_status_check CHECK (
    scan_status IN ('pending', 'clean', 'infected', 'failed')
  )
);

CREATE TABLE holding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  holding_number VARCHAR(80) NOT NULL,
  owner_display_name VARCHAR(255) NOT NULL,
  ward_number VARCHAR(20) NOT NULL,
  locality VARCHAR(150) NOT NULL,
  address JSONB NOT NULL,
  property_type VARCHAR(80) NOT NULL,
  outstanding_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  source VARCHAR(80) NOT NULL DEFAULT 'local_mirror',
  source_updated_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT holding_records_tenant_holding_unique UNIQUE (tenant_id, holding_number)
);

CREATE TABLE holding_lookup_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  holding_id UUID REFERENCES holding_records(id) ON DELETE SET NULL,
  holding_number VARCHAR(80) NOT NULL,
  actor_subject VARCHAR(255) NOT NULL,
  outcome VARCHAR(30) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'local_mirror',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT holding_lookup_audit_outcome_check CHECK (outcome IN ('found', 'not_found'))
);

CREATE INDEX application_documents_tenant_application_code_idx
  ON application_documents (tenant_id, application_id, document_code);
CREATE INDEX application_documents_tenant_scan_status_idx
  ON application_documents (tenant_id, scan_status);
CREATE INDEX holding_records_tenant_owner_idx
  ON holding_records (tenant_id, owner_display_name);
CREATE INDEX holding_records_tenant_ward_idx
  ON holding_records (tenant_id, ward_number);
CREATE INDEX holding_lookup_audit_tenant_holding_created_idx
  ON holding_lookup_audit (tenant_id, holding_number, created_at);
CREATE INDEX holding_lookup_audit_tenant_outcome_idx
  ON holding_lookup_audit (tenant_id, outcome);

CREATE POLICY tenant_isolation ON application_documents
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON holding_records
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE holding_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON holding_lookup_audit
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE holding_lookup_audit ENABLE ROW LEVEL SECURITY;
