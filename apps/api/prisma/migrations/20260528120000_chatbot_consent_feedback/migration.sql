CREATE TABLE chatbot_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL,
  disclosure_version VARCHAR(20) NOT NULL DEFAULT '2026-05',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chatbot_consents_mode_check CHECK (mode IN ('llm', 'kb_only')),
  CONSTRAINT chatbot_consents_tenant_citizen_unique UNIQUE (tenant_id, citizen_id)
);

CREATE INDEX chatbot_consents_tenant_idx ON chatbot_consents (tenant_id, updated_at DESC);

CREATE TABLE chatbot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_key VARCHAR(64) NOT NULL,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL,
  assistant_message_id UUID REFERENCES chatbot_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chatbot_feedback_rating_check CHECK (rating IN (-1, 1))
);

CREATE INDEX chatbot_feedback_tenant_session_idx
  ON chatbot_feedback (tenant_id, session_key, created_at DESC);
