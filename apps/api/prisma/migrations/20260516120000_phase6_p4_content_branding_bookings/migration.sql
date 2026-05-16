CREATE TABLE kb_index_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  trigger VARCHAR(30) NOT NULL DEFAULT 'publish',
  requested_by VARCHAR(255),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT kb_index_jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CONSTRAINT kb_index_jobs_trigger_check CHECK (trigger IN ('publish', 'manual_requeue', 'nightly_reconcile'))
);

CREATE UNIQUE INDEX kb_index_jobs_open_unique
  ON kb_index_jobs (tenant_id, article_id, status)
  WHERE status IN ('queued', 'processing');
CREATE INDEX kb_index_jobs_tenant_status_created_idx ON kb_index_jobs (tenant_id, status, created_at);

CREATE POLICY tenant_isolation ON kb_index_jobs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE kb_index_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE tenant_branding_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  public_url TEXT NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_branding_assets_unique UNIQUE (tenant_id, code),
  CONSTRAINT tenant_branding_assets_kind_check CHECK (kind IN ('logo', 'hero')),
  CONSTRAINT tenant_branding_assets_mime_check CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  CONSTRAINT tenant_branding_assets_size_check CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  CONSTRAINT tenant_branding_assets_dimensions_check CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0))
);

CREATE INDEX tenant_branding_assets_tenant_kind_created_idx ON tenant_branding_assets (tenant_id, kind, created_at);

CREATE POLICY tenant_isolation ON tenant_branding_assets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE tenant_branding_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE bookable_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookable_assets_unique UNIQUE (tenant_id, code),
  CONSTRAINT bookable_assets_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);

CREATE INDEX bookable_assets_tenant_active_idx ON bookable_assets (tenant_id, is_active);

CREATE POLICY tenant_isolation ON bookable_assets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE bookable_assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE bookable_asset_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES bookable_assets(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL DEFAULT 'available',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookable_asset_availability_kind_check CHECK (kind IN ('available', 'blackout')),
  CONSTRAINT bookable_asset_availability_range_check CHECK (starts_at < ends_at)
);

CREATE INDEX bookable_asset_availability_tenant_asset_range_idx
  ON bookable_asset_availability (tenant_id, asset_id, starts_at, ends_at);

CREATE POLICY tenant_isolation ON bookable_asset_availability
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE bookable_asset_availability ENABLE ROW LEVEL SECURITY;

CREATE TABLE booking_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES bookable_assets(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  docket_no VARCHAR(80),
  holder_name VARCHAR(255) NOT NULL,
  holder_mobile VARCHAR(15),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'hold',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_reservations_status_check CHECK (status IN ('hold', 'confirmed', 'cancelled')),
  CONSTRAINT booking_reservations_range_check CHECK (starts_at < ends_at)
);

CREATE INDEX booking_reservations_tenant_asset_range_idx
  ON booking_reservations (tenant_id, asset_id, starts_at, ends_at);
CREATE INDEX booking_reservations_tenant_status_idx ON booking_reservations (tenant_id, status);
CREATE UNIQUE INDEX booking_reservations_no_overlap_idx
  ON booking_reservations (tenant_id, asset_id, starts_at, ends_at)
  WHERE status IN ('hold', 'confirmed');

CREATE POLICY tenant_isolation ON booking_reservations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID);
ALTER TABLE booking_reservations ENABLE ROW LEVEL SECURITY;
