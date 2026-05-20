-- Sprint 6.21: configurable grievance categories + sub-types

CREATE TABLE global_grievance_categories (
  code VARCHAR(50) PRIMARY KEY,
  name JSONB NOT NULL,
  icon VARCHAR(80),
  docket_code VARCHAR(10),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX global_grievance_categories_sort_idx ON global_grievance_categories (sort_order);

CREATE TABLE global_grievance_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_category_code VARCHAR(50) NOT NULL REFERENCES global_grievance_categories(code) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT global_grievance_subtypes_code_uidx UNIQUE (global_category_code, code)
);

CREATE INDEX global_grievance_subtypes_cat_sort_idx ON global_grievance_subtypes (global_category_code, sort_order);

CREATE TABLE tenant_grievance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  global_category_code VARCHAR(50) REFERENCES global_grievance_categories(code) ON DELETE SET NULL,
  name JSONB NOT NULL,
  icon VARCHAR(80),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(30) NOT NULL DEFAULT 'global_adopted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_grievance_categories_tenant_code_uidx UNIQUE (tenant_id, code)
);

CREATE INDEX tenant_grievance_categories_tenant_sort_idx ON tenant_grievance_categories (tenant_id, sort_order);

CREATE TABLE tenant_grievance_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_code VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(30) NOT NULL DEFAULT 'global_adopted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_grievance_subtypes_tenant_cat_code_uidx UNIQUE (tenant_id, category_code, code),
  CONSTRAINT tenant_grievance_subtypes_category_fkey FOREIGN KEY (tenant_id, category_code)
    REFERENCES tenant_grievance_categories (tenant_id, code) ON DELETE CASCADE
);

CREATE INDEX tenant_grievance_subtypes_tenant_cat_sort_idx ON tenant_grievance_subtypes (tenant_id, category_code, sort_order);

ALTER TABLE grievances ADD COLUMN subtype_code VARCHAR(50);

CREATE POLICY tenant_isolation ON tenant_grievance_categories USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE tenant_grievance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_grievance_subtypes USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE tenant_grievance_subtypes ENABLE ROW LEVEL SECURITY;
