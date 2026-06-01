-- Phase 1 (ADR-0011): tenant departments, designations, user_designations

CREATE TABLE tenant_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_departments_tenant_code_uidx UNIQUE (tenant_id, code)
);

CREATE INDEX tenant_departments_tenant_sort_idx ON tenant_departments (tenant_id, sort_order);

CREATE TABLE tenant_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  scope VARCHAR(20) NOT NULL,
  department_id UUID REFERENCES tenant_departments(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_department_head BOOLEAN NOT NULL DEFAULT FALSE,
  can_reject_municipal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_designations_tenant_code_uidx UNIQUE (tenant_id, code),
  CONSTRAINT tenant_designations_scope_check CHECK (scope IN ('department', 'municipality')),
  CONSTRAINT tenant_designations_dept_scope_check CHECK (
    (scope = 'department' AND department_id IS NOT NULL)
    OR (scope = 'municipality' AND department_id IS NULL)
  )
);

CREATE INDEX tenant_designations_tenant_dept_idx ON tenant_designations (tenant_id, department_id);
CREATE INDEX tenant_designations_tenant_scope_idx ON tenant_designations (tenant_id, scope);

CREATE TABLE user_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designation_id UUID NOT NULL REFERENCES tenant_designations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_designations_tenant_user_designation_uidx UNIQUE (tenant_id, user_id, designation_id)
);

CREATE INDEX user_designations_tenant_user_idx ON user_designations (tenant_id, user_id);
CREATE INDEX user_designations_tenant_designation_idx ON user_designations (tenant_id, designation_id);

CREATE POLICY tenant_isolation ON tenant_departments USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE tenant_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_designations USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE tenant_designations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_designations USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE user_designations ENABLE ROW LEVEL SECURITY;
