-- Phase 3 (ADR-0011): designation columns on workflows + designation_stage_map + application runtime

ALTER TABLE workflow_stages
  ADD COLUMN owner_designation VARCHAR(80),
  ADD COLUMN stage_kind VARCHAR(20),
  ADD COLUMN allowed_verbs JSONB;

ALTER TABLE workflow_transitions
  ADD COLUMN actor_designation VARCHAR(80),
  ADD COLUMN guard JSONB;

ALTER TABLE applications
  ADD COLUMN pending_designation VARCHAR(80);

ALTER TABLE application_timeline
  ADD COLUMN actor_designation VARCHAR(80);

CREATE TABLE designation_stage_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
  designation_code VARCHAR(80) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_act BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT designation_stage_map_tenant_stage_code_uidx UNIQUE (tenant_id, stage_id, designation_code)
);

CREATE INDEX designation_stage_map_tenant_code_idx
  ON designation_stage_map (tenant_id, designation_code);

CREATE INDEX workflow_stages_owner_designation_idx
  ON workflow_stages (tenant_id, owner_designation)
  WHERE owner_designation IS NOT NULL;

CREATE INDEX workflow_transitions_actor_designation_idx
  ON workflow_transitions (tenant_id, actor_designation)
  WHERE actor_designation IS NOT NULL;

CREATE INDEX applications_pending_designation_idx
  ON applications (tenant_id, pending_designation)
  WHERE pending_designation IS NOT NULL;

CREATE POLICY tenant_isolation ON designation_stage_map USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE designation_stage_map ENABLE ROW LEVEL SECURITY;
