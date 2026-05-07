CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  ward_count INTEGER CHECK (ward_count IS NULL OR ward_count >= 0),
  theme_color VARCHAR(7) CHECK (theme_color IS NULL OR theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url TEXT,
  languages_enabled TEXT[] NOT NULL DEFAULT ARRAY['en', 'bn', 'hi'],
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  default_language VARCHAR(5) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE boroughs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boroughs_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE TABLE wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  borough_id UUID REFERENCES boroughs(id) ON DELETE SET NULL,
  number VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  councillor VARCHAR(255),
  boundary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wards_tenant_number_unique UNIQUE (tenant_id, number)
);

CREATE TABLE citizens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mobile VARCHAR(15) NOT NULL,
  aadhaar_hash CHAR(64),
  name VARCHAR(255),
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  holding_number VARCHAR(50),
  language_pref VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizens_tenant_mobile_unique UNIQUE (tenant_id, mobile),
  CONSTRAINT citizens_aadhaar_hash_format CHECK (
    aadhaar_hash IS NULL OR aadhaar_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  keycloak_user_id UUID NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  mobile VARCHAR(15),
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled', 'invited'))
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_assignment_unique UNIQUE (tenant_id, user_id, role_id, ward_id)
);

CREATE TABLE localities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  pincode VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT localities_tenant_name_pincode_unique UNIQUE (tenant_id, name, pincode)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  deep_link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX tenant_config_tenant_id_idx ON tenant_config (tenant_id);
CREATE INDEX boroughs_tenant_id_idx ON boroughs (tenant_id);
CREATE INDEX wards_tenant_borough_idx ON wards (tenant_id, borough_id);
CREATE INDEX citizens_tenant_ward_idx ON citizens (tenant_id, ward_id);
CREATE INDEX users_tenant_status_idx ON users (tenant_id, status);
CREATE INDEX user_roles_tenant_role_idx ON user_roles (tenant_id, role_id);
CREATE INDEX localities_tenant_ward_idx ON localities (tenant_id, ward_id);
CREATE INDEX notifications_tenant_citizen_read_idx ON notifications (tenant_id, citizen_id, is_read);

CREATE POLICY tenant_public_read ON tenants
  FOR SELECT
  USING (TRUE);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_public_read ON roles
  FOR SELECT
  USING (TRUE);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_config
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON boroughs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE boroughs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON wards
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON citizens
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_roles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON localities
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE localities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

INSERT INTO roles (code, name, description)
VALUES
  ('citizen', 'Citizen', 'Citizen self-service user'),
  ('tenant_clerk', 'Tenant Clerk', 'Municipal clerk handling intake and processing'),
  ('tenant_admin', 'Tenant Admin', 'Municipal administrator for a tenant'),
  ('state_admin', 'State Admin', 'State-level administrator with cross-tenant duties')
ON CONFLICT (code) DO NOTHING;
