CREATE TYPE "ParkingBayStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

CREATE TABLE smart_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
  geo JSONB DEFAULT '{}'::jsonb,
  capacity_bays INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT smart_zones_unique UNIQUE (tenant_id, code),
  CONSTRAINT smart_zones_capacity_check CHECK (capacity_bays > 0)
);

CREATE INDEX smart_zones_tenant_active_idx ON smart_zones (tenant_id, is_active);

CREATE POLICY tenant_isolation ON smart_zones
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE smart_zones ENABLE ROW LEVEL SECURITY;

CREATE TABLE parking_bays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES smart_zones(id) ON DELETE CASCADE,
  bay_code VARCHAR(40) NOT NULL,
  status "ParkingBayStatus" NOT NULL DEFAULT 'FREE',
  last_sensor_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_bays_unique UNIQUE (tenant_id, zone_id, bay_code)
);

CREATE INDEX parking_bays_tenant_zone_status_idx ON parking_bays (tenant_id, zone_id, status);

CREATE POLICY tenant_isolation ON parking_bays
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE parking_bays ENABLE ROW LEVEL SECURITY;
