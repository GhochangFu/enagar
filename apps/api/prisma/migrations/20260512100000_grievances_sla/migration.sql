-- Sprint 4.1: grievances, SLA policies, routing rules, timeline, attachments + RLS

CREATE TABLE sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_match VARCHAR(50),
  grievance_priority_match VARCHAR(20),
  hours_to_resolve INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sla_policies_hours_check CHECK (hours_to_resolve > 0)
);

CREATE INDEX sla_policies_tenant_sort_idx ON sla_policies (tenant_id, sort_order);

CREATE TABLE grievance_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_match VARCHAR(50),
  grievance_priority_match VARCHAR(20),
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  target_role_code VARCHAR(50) NOT NULL,
  assign_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX grievance_routing_rules_tenant_sort_idx ON grievance_routing_rules (tenant_id, sort_order);

CREATE TABLE grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  grievance_no VARCHAR(64) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  grievance_priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  routed_role_code VARCHAR(50),
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  sla_breached_at TIMESTAMPTZ,
  rating INTEGER,
  feedback TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grievances_priority_check CHECK (
    grievance_priority IN ('low', 'medium', 'high', 'urgent')
  ),
  CONSTRAINT grievances_status_check CHECK (
    status IN (
      'submitted',
      'under_review',
      'in_progress',
      'resolved',
      'closed'
    )
  ),
  CONSTRAINT grievances_rating_check CHECK (
    rating IS NULL OR (rating >= 1 AND rating <= 5)
  )
);

CREATE UNIQUE INDEX grievances_tenant_no_uidx ON grievances (tenant_id, grievance_no);
CREATE INDEX grievances_tenant_citizen_created_idx ON grievances (tenant_id, citizen_id, created_at);
CREATE INDEX grievances_tenant_status_idx ON grievances (tenant_id, status);
CREATE INDEX grievances_tenant_sla_due_idx ON grievances (tenant_id, sla_due_at);

CREATE TABLE grievance_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grievance_id UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  actor_subject VARCHAR(255) NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX grievance_timeline_tenant_grievance_occurred_idx ON grievance_timeline (
  tenant_id,
  grievance_id,
  occurred_at
);

CREATE TABLE grievance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grievance_id UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  storage_key VARCHAR(500) NOT NULL,
  content_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX grievance_attachments_tenant_grievance_idx ON grievance_attachments (tenant_id, grievance_id);

CREATE POLICY tenant_isolation ON sla_policies USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON grievance_routing_rules USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE grievance_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON grievances USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON grievance_timeline USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE grievance_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON grievance_attachments USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE grievance_attachments ENABLE ROW LEVEL SECURITY;
