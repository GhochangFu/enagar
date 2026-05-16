CREATE TABLE tenant_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  title JSONB NOT NULL,
  body JSONB NOT NULL,
  link_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_banners_unique UNIQUE (tenant_id, code),
  CONSTRAINT tenant_banners_code_format CHECK (code ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT tenant_banners_severity_check CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT tenant_banners_active_window_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

CREATE INDEX tenant_banners_active_window_idx
  ON tenant_banners (tenant_id, is_active, starts_at, ends_at);

CREATE POLICY tenant_isolation ON tenant_banners
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE tenant_banners ENABLE ROW LEVEL SECURITY;
