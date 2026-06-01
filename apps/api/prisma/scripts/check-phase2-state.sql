SELECT column_name
FROM information_schema.columns
WHERE table_name = 'services'
  AND column_name IN ('department_id', 'global_category_code', 'legacy_global_category_id');

SELECT COUNT(*)::text AS tenant_service_categories_count FROM tenant_service_categories;
