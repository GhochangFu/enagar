-- Phase 12 (ADR-0012 §9.1): tenant vendors + linked work_orders per application.

CREATE TABLE tenant_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_vendors_tenant_code_uidx UNIQUE (tenant_id, code)
);

CREATE INDEX tenant_vendors_tenant_active_idx ON tenant_vendors (tenant_id, is_active);

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  work_order_no VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'issued',
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES tenant_vendors(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT work_orders_tenant_application_uidx UNIQUE (tenant_id, application_id),
  CONSTRAINT work_orders_application_id_uidx UNIQUE (application_id),
  CONSTRAINT work_orders_work_order_no_uidx UNIQUE (work_order_no),
  CONSTRAINT work_orders_status_check CHECK (
    status IN ('draft', 'issued', 'assigned', 'in_progress', 'completed', 'cancelled')
  )
);

CREATE INDEX work_orders_tenant_status_idx ON work_orders (tenant_id, status);

CREATE POLICY tenant_isolation ON tenant_vendors
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE tenant_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON work_orders
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Pilot vendor for KMC PWD smokes
INSERT INTO tenant_vendors (tenant_id, code, name, is_active)
SELECT t.id, 'pwd-contractor-alpha', '{"en":"PWD Contractor Alpha","bn":"PWD Contractor Alpha","hi":"PWD Contractor Alpha"}'::jsonb, TRUE
FROM tenants t
WHERE t.code = 'KMC'
ON CONFLICT (tenant_id, code) DO NOTHING;
