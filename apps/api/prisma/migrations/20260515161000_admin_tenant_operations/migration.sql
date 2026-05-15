CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  trigger VARCHAR(80) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_templates_unique UNIQUE (tenant_id, code, channel, locale),
  CONSTRAINT notification_templates_channel_check CHECK (channel IN ('push', 'sms', 'email', 'whatsapp')),
  CONSTRAINT notification_templates_locale_check CHECK (locale IN ('en', 'bn', 'hi')),
  CONSTRAINT notification_templates_variables_array_check CHECK (jsonb_typeof(variables) = 'array')
);

CREATE INDEX notification_templates_tenant_channel_locale_idx
  ON notification_templates (tenant_id, channel, locale, is_active);
CREATE INDEX notification_templates_tenant_trigger_idx
  ON notification_templates (tenant_id, trigger);

CREATE POLICY tenant_isolation ON notification_templates
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug VARCHAR(120) NOT NULL,
  title JSONB NOT NULL,
  body JSONB NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kb_articles_unique UNIQUE (tenant_id, slug),
  CONSTRAINT kb_articles_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT kb_articles_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

CREATE INDEX kb_articles_tenant_status_idx ON kb_articles (tenant_id, status);
CREATE INDEX kb_articles_tenant_tags_idx ON kb_articles USING GIN (tags);

CREATE POLICY tenant_isolation ON kb_articles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
