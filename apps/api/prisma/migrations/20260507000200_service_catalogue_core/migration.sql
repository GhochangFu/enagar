CREATE TABLE revenue_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  accounting_code VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE global_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  revenue_head_id UUID REFERENCES revenue_heads(id) ON DELETE SET NULL,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_pattern VARCHAR(50) NOT NULL,
  default_sla_days INTEGER CHECK (default_sla_days IS NULL OR default_sla_days >= 0),
  fee_type VARCHAR(30) NOT NULL DEFAULT 'fixed',
  fee_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  pushes_to_digilocker BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT global_services_code_format CHECK (code ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT global_services_fee_type_check CHECK (
    fee_type IN ('free', 'fixed', 'slab', 'computed', 'external')
  )
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  global_service_id UUID REFERENCES global_services(id) ON DELETE SET NULL,
  code VARCHAR(80) NOT NULL,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  revenue_head_id UUID REFERENCES revenue_heads(id) ON DELETE SET NULL,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  override_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_fee_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_sla_days INTEGER CHECK (effective_sla_days IS NULL OR effective_sla_days >= 0),
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  form_schema_additions JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT services_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT services_code_format CHECK (code ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

CREATE TABLE service_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_service_id UUID NOT NULL REFERENCES global_services(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  label JSONB NOT NULL,
  accept TEXT[] NOT NULL DEFAULT ARRAY['application/pdf', 'image/jpeg'],
  max_size_mb INTEGER NOT NULL DEFAULT 10 CHECK (max_size_mb > 0 AND max_size_mb <= 10),
  is_statutory BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_documents_global_code_unique UNIQUE (global_service_id, code),
  CONSTRAINT service_documents_code_format CHECK (code ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

CREATE TABLE service_form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  form_schema JSONB NOT NULL,
  ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT service_form_versions_tenant_service_version_unique UNIQUE (tenant_id, service_id, version),
  CONSTRAINT service_form_versions_status_check CHECK (status IN ('draft', 'published', 'retired'))
);

CREATE INDEX service_categories_sort_order_idx ON service_categories (sort_order);
CREATE INDEX global_services_category_active_idx ON global_services (category_id, is_active);
CREATE INDEX global_services_revenue_head_idx ON global_services (revenue_head_id);
CREATE INDEX services_tenant_category_active_idx ON services (tenant_id, category_id, is_active);
CREATE INDEX services_tenant_global_service_idx ON services (tenant_id, global_service_id);
CREATE INDEX service_form_versions_tenant_service_status_idx ON service_form_versions (tenant_id, service_id, status);

CREATE POLICY revenue_heads_public_read ON revenue_heads
  FOR SELECT
  USING (TRUE);
ALTER TABLE revenue_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_categories_public_read ON service_categories
  FOR SELECT
  USING (TRUE);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY global_services_public_read ON global_services
  FOR SELECT
  USING (TRUE);
ALTER TABLE global_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_documents_public_read ON service_documents
  FOR SELECT
  USING (TRUE);
ALTER TABLE service_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON services
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON service_form_versions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE service_form_versions ENABLE ROW LEVEL SECURITY;
