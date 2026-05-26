CREATE TABLE chatbot_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID,
  session_id VARCHAR(64) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(80) NOT NULL,
  input_tokens INT,
  output_tokens INT,
  latency_ms INT NOT NULL,
  redaction_count INT NOT NULL DEFAULT 0,
  query_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chatbot_audit_logs_provider_check CHECK (provider IN ('openai', 'gemini', 'ollama'))
);

CREATE INDEX chatbot_audit_logs_tenant_created_idx
  ON chatbot_audit_logs (tenant_id, created_at DESC);

CREATE INDEX chatbot_audit_logs_session_idx
  ON chatbot_audit_logs (tenant_id, session_id, created_at DESC);
