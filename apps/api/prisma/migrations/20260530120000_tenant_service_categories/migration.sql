-- Phase 2 (ADR-0011): tenant service categories + department-scoped services

CREATE TABLE tenant_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES tenant_departments(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_service_categories_tenant_dept_code_uidx UNIQUE (tenant_id, department_id, code)
);

CREATE INDEX tenant_service_categories_tenant_dept_sort_idx
  ON tenant_service_categories (tenant_id, department_id, sort_order);

ALTER TABLE services
  ADD COLUMN department_id UUID REFERENCES tenant_departments(id) ON DELETE SET NULL,
  ADD COLUMN global_category_code VARCHAR(50),
  ADD COLUMN legacy_global_category_id UUID;

-- Preserve old FK target for backfill
UPDATE services SET legacy_global_category_id = category_id;

-- Backfill global_category_code from global service_categories
UPDATE services s
SET global_category_code = CASE sc.code
  WHEN 'certificates' THEN 'cert'
  WHEN 'tax-property' THEN 'tax'
  WHEN 'water-sanitation' THEN 'water'
  WHEN 'building-plan' THEN 'building'
  WHEN 'trade-licence' THEN 'cert'
  WHEN 'health' THEN 'health'
  WHEN 'welfare' THEN 'welfare'
  WHEN 'grievances' THEN 'misc'
  WHEN 'bookings' THEN 'rent'
  WHEN 'parking-transport' THEN 'smart'
  WHEN 'advertising' THEN 'adv'
  WHEN 'tenders' THEN 'tender'
  WHEN 'fines-challans' THEN 'fines'
  WHEN 'rti' THEN 'info'
  ELSE sc.code
END
FROM service_categories sc
WHERE sc.id = s.legacy_global_category_id;

-- Ensure every tenant with services has a general department (Phase 1 seed may be partial)
INSERT INTO tenant_departments (tenant_id, code, name, sort_order, is_active)
SELECT DISTINCT s.tenant_id, 'general', '{"en":"General Department","bn":"General Department","hi":"General Department"}'::jsonb, 999, TRUE
FROM services s
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_departments td WHERE td.tenant_id = s.tenant_id AND td.code = 'general'
);

-- Default department mapping from navigation category
UPDATE services s
SET department_id = td.id
FROM tenant_departments td
WHERE td.tenant_id = s.tenant_id
  AND td.code = CASE s.global_category_code
    WHEN 'cert' THEN 'birth-death'
    WHEN 'tax' THEN 'assessment'
    WHEN 'water' THEN 'water-works'
    WHEN 'building' THEN 'building'
    WHEN 'health' THEN 'health'
    WHEN 'adv' THEN 'advertisement-hoarding'
    WHEN 'rent' THEN 'market'
    WHEN 'smart' THEN 'parking'
    WHEN 'tender' THEN 'procurement'
    WHEN 'fines' THEN 'collection'
    WHEN 'info' THEN 'general'
    WHEN 'misc' THEN 'general'
    WHEN 'welfare' THEN 'nulm'
    ELSE 'general'
  END
  AND s.department_id IS NULL;

-- Create tenant_service_categories for each (tenant, department, nav code) in use
INSERT INTO tenant_service_categories (tenant_id, department_id, code, name, sort_order, is_active)
SELECT DISTINCT
  s.tenant_id,
  s.department_id,
  s.global_category_code,
  jsonb_build_object(
    'en', initcap(replace(s.global_category_code, '-', ' ')),
    'bn', initcap(replace(s.global_category_code, '-', ' ')),
    'hi', initcap(replace(s.global_category_code, '-', ' '))
  ),
  100,
  TRUE
FROM services s
WHERE s.department_id IS NOT NULL
  AND s.global_category_code IS NOT NULL
ON CONFLICT (tenant_id, department_id, code) DO NOTHING;

-- Repoint FK: category_id must reference tenant_service_categories (drop global FK first)
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_id_fkey;

UPDATE services s
SET category_id = tsc.id
FROM tenant_service_categories tsc
WHERE tsc.tenant_id = s.tenant_id
  AND tsc.department_id = s.department_id
  AND tsc.code = s.global_category_code;

ALTER TABLE services
  ADD CONSTRAINT services_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES tenant_service_categories(id) ON DELETE RESTRICT;

ALTER TABLE services
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN global_category_code SET NOT NULL;

ALTER TABLE services DROP COLUMN legacy_global_category_id;

CREATE POLICY tenant_isolation ON tenant_service_categories USING (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID
);
ALTER TABLE tenant_service_categories ENABLE ROW LEVEL SECURITY;
