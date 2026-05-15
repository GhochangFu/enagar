-- Master Sprint 5.4 — persist Expo / web push registration targets for citizen JWTs.

CREATE TABLE citizen_push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens (id) ON DELETE CASCADE,
  platform VARCHAR(12) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizen_push_devices_citizen_token_unique UNIQUE (citizen_id, token)
);

CREATE INDEX citizen_push_devices_tenant_citizen_idx ON citizen_push_devices (tenant_id, citizen_id);

CREATE POLICY tenant_isolation ON citizen_push_devices
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);

ALTER TABLE citizen_push_devices ENABLE ROW LEVEL SECURITY;
