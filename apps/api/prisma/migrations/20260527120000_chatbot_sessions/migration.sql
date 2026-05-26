CREATE TABLE chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  session_key VARCHAR(64) NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chatbot_sessions_language_check CHECK (language IN ('en', 'bn', 'hi')),
  CONSTRAINT chatbot_sessions_tenant_session_key UNIQUE (tenant_id, session_key)
);

CREATE INDEX chatbot_sessions_citizen_idx
  ON chatbot_sessions (tenant_id, citizen_id, updated_at DESC);

CREATE TABLE chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chatbot_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX chatbot_messages_session_created_idx
  ON chatbot_messages (session_id, created_at ASC);
