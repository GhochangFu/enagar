ALTER TABLE "citizens"
  ADD COLUMN "pinned_tenant_codes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "pinned_services" JSONB NOT NULL DEFAULT '[]'::jsonb;
