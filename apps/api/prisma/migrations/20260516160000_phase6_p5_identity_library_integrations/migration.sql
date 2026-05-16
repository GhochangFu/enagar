CREATE TABLE staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  mobile VARCHAR(15),
  role_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ward_number VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  provisioning_mode VARCHAR(30) NOT NULL DEFAULT 'dry_run',
  keycloak_user_id UUID,
  invited_by_subject VARCHAR(255) NOT NULL,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_invites_unique_username UNIQUE (tenant_id, username),
  CONSTRAINT staff_invites_status_check CHECK (status IN ('draft', 'pending_keycloak', 'provisioned', 'failed', 'disabled')),
  CONSTRAINT staff_invites_mode_check CHECK (provisioning_mode IN ('dry_run', 'local_keycloak')),
  CONSTRAINT staff_invites_role_codes_check CHECK (cardinality(role_codes) > 0)
);

CREATE INDEX staff_invites_tenant_status_idx ON staff_invites (tenant_id, status);

CREATE POLICY tenant_isolation ON staff_invites
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE global_services
  ADD COLUMN lifecycle_status VARCHAR(30) NOT NULL DEFAULT 'published',
  ADD COLUMN curator_notes TEXT,
  ADD COLUMN library_version INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT global_services_lifecycle_status_check CHECK (lifecycle_status IN ('draft', 'published', 'deprecated'));

CREATE INDEX global_services_lifecycle_status_idx ON global_services (lifecycle_status, is_active);

CREATE TABLE state_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key VARCHAR(80) NOT NULL UNIQUE,
  environment VARCHAR(30) NOT NULL DEFAULT 'sandbox',
  status VARCHAR(30) NOT NULL DEFAULT 'not_configured',
  owner VARCHAR(120),
  notes TEXT,
  readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ,
  updated_by_subject VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT state_integrations_provider_key_check CHECK (provider_key ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT state_integrations_environment_check CHECK (environment IN ('sandbox', 'pilot', 'production')),
  CONSTRAINT state_integrations_status_check CHECK (status IN ('not_configured', 'manual_check_required', 'ready', 'blocked'))
);

CREATE INDEX state_integrations_status_environment_idx ON state_integrations (status, environment);
