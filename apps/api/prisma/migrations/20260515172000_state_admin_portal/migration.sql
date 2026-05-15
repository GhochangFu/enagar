CREATE TABLE state_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_subject VARCHAR(255) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  target_code VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX state_audit_logs_actor_created_idx
  ON state_audit_logs (actor_subject, created_at);
CREATE INDEX state_audit_logs_target_created_idx
  ON state_audit_logs (target_tenant_id, created_at);
CREATE INDEX state_audit_logs_action_created_idx
  ON state_audit_logs (action, created_at);

CREATE TABLE impersonation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_subject VARCHAR(255) NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  token_id UUID NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX impersonation_tokens_target_expires_idx
  ON impersonation_tokens (target_tenant_id, expires_at);
CREATE INDEX impersonation_tokens_actor_created_idx
  ON impersonation_tokens (actor_subject, created_at);
