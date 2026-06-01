-- Undo partial apply of 20260530120000_tenant_service_categories (dev recovery)
DROP POLICY IF EXISTS tenant_isolation ON tenant_service_categories;
DROP TABLE IF EXISTS tenant_service_categories CASCADE;

ALTER TABLE services DROP COLUMN IF EXISTS department_id;
ALTER TABLE services DROP COLUMN IF EXISTS global_category_code;
ALTER TABLE services DROP COLUMN IF EXISTS legacy_global_category_id;

-- Re-add global FK if it was dropped mid-migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_category_id_fkey'
      AND conrelid = 'services'::regclass
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT;
  END IF;
END $$;
