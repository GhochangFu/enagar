CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  name JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT workflows_tenant_service_version_unique UNIQUE (tenant_id, service_id, version),
  CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'published', 'retired'))
);

CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  label JSONB NOT NULL,
  owner_role VARCHAR(80) NOT NULL,
  sla_hours INTEGER CHECK (sla_hours IS NULL OR sla_hours >= 0),
  is_initial BOOLEAN NOT NULL DEFAULT FALSE,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT workflow_stages_tenant_workflow_code_unique UNIQUE (tenant_id, workflow_id, code)
);

CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  verb VARCHAR(80) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  requires_comment BOOLEAN NOT NULL DEFAULT FALSE,
  side_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT workflow_transitions_tenant_from_verb_unique UNIQUE (tenant_id, workflow_id, from_stage_id, verb)
);

CREATE TABLE role_stage_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  role_code VARCHAR(80) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_act BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT role_stage_map_tenant_stage_role_unique UNIQUE (tenant_id, stage_id, role_code)
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  form_version_id UUID REFERENCES service_form_versions(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  current_stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL,
  docket_no VARCHAR(80) NOT NULL UNIQUE,
  service_code VARCHAR(80) NOT NULL,
  form_version INTEGER NOT NULL,
  workflow_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'submitted',
  status_label JSONB NOT NULL DEFAULT '{}'::jsonb,
  pending_role VARCHAR(80),
  form_data JSONB NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT applications_payment_status_check CHECK (
    payment_status IN ('not_required', 'mock_paid', 'pending', 'paid', 'failed')
  )
);

CREATE TABLE application_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_stage VARCHAR(80),
  to_stage VARCHAR(80) NOT NULL,
  verb VARCHAR(80) NOT NULL,
  actor_subject VARCHAR(255),
  actor_role VARCHAR(80),
  comment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE application_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_subject VARCHAR(255) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflows_tenant_status_idx ON workflows (tenant_id, status);
CREATE INDEX workflow_stages_tenant_workflow_sort_idx ON workflow_stages (tenant_id, workflow_id, sort_order);
CREATE INDEX workflow_transitions_tenant_workflow_role_idx ON workflow_transitions (tenant_id, workflow_id, actor_role);
CREATE INDEX role_stage_map_tenant_role_idx ON role_stage_map (tenant_id, role_code);
CREATE INDEX applications_tenant_citizen_submitted_idx ON applications (tenant_id, citizen_id, submitted_at);
CREATE INDEX applications_tenant_service_status_idx ON applications (tenant_id, service_id, status);
CREATE INDEX application_timeline_tenant_application_created_idx ON application_timeline (tenant_id, application_id, created_at);
CREATE INDEX application_comments_tenant_application_created_idx ON application_comments (tenant_id, application_id, created_at);

CREATE POLICY tenant_isolation ON workflows
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON workflow_stages
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON workflow_transitions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON role_stage_map
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE role_stage_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON applications
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON application_timeline
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE application_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON application_comments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE application_comments ENABLE ROW LEVEL SECURITY;
