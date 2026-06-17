ALTER TABLE smart_zones
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
