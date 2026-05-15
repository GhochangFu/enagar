ALTER TABLE localities
  ADD COLUMN mouza VARCHAR(120);

CREATE INDEX localities_tenant_mouza_idx ON localities (tenant_id, mouza);

CREATE TABLE tenant_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL,
  name JSONB NOT NULL,
  rate_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_tariffs_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT tenant_tariffs_code_format CHECK (code ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT tenant_tariffs_category_check CHECK (
    category IN ('property', 'water', 'conservancy', 'sewerage')
  )
);

CREATE INDEX tenant_tariffs_tenant_category_active_idx
  ON tenant_tariffs (tenant_id, category, is_active);

CREATE POLICY tenant_isolation ON tenant_tariffs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE tenant_tariffs ENABLE ROW LEVEL SECURITY;
