ALTER TABLE applications
  ADD COLUMN runtime_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
