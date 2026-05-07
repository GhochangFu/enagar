-- Phase 2 exit-criteria proof: add a 77th service without application code changes.
--
-- This script assumes the Phase 2 catalogue schema from
-- apps/api/prisma/migrations/20260507000200_service_catalogue_core/migration.sql.
-- It creates one state-wide global service, publishes it to KMC, and publishes
-- the first form-schema snapshot. The citizen API/PWA should see the service
-- through the existing catalogue reads after these inserts.

BEGIN;

WITH service_category AS (
  SELECT id
  FROM service_categories
  WHERE code = 'water-sanitation'
),
revenue_head AS (
  SELECT id
  FROM revenue_heads
  WHERE code = 'water-charges'
),
inserted_global_service AS (
  INSERT INTO global_services (
    code,
    category_id,
    revenue_head_id,
    name,
    description,
    workflow_pattern,
    default_sla_days,
    fee_type,
    fee_config,
    required_documents,
    form_schema,
    workflow_config,
    pushes_to_digilocker,
    is_active
  )
  SELECT
    'water-connection',
    service_category.id,
    revenue_head.id,
    '{"en":"Water Connection","bn":"জল সংযোগ","hi":"जल कनेक्शन"}'::jsonb,
    '{"en":"Apply for a new municipal water connection.","bn":"নতুন পৌর জল সংযোগের জন্য আবেদন করুন।","hi":"नए नगरपालिका जल कनेक्शन के लिए आवेदन करें।"}'::jsonb,
    'cert-issuance',
    15,
    'fixed',
    '{"amount_paise": 25000, "currency": "INR"}'::jsonb,
    '["identity-proof", "address-proof", "plumbing-layout"]'::jsonb,
    '{
      "schema_version": 1,
      "service_code": "water-connection",
      "version": 1,
      "title": {"en":"Water Connection","bn":"জল সংযোগ","hi":"जल कनेक्शन"},
      "fields": [
        {"id":"applicant_name","type":"text","label":{"en":"Applicant name","bn":"আবেদনকারীর নাম","hi":"आवेदक का नाम"},"required":true,"min_length":2,"max_length":120},
        {"id":"mobile","type":"text","label":{"en":"Mobile number","bn":"মোবাইল নম্বর","hi":"मोबाइल नंबर"},"required":true,"pattern":"^[6-9][0-9]{9}$"},
        {"id":"holding_number","type":"text","label":{"en":"Holding number","bn":"হোল্ডিং নম্বর","hi":"होल्डिंग नंबर"},"required":true,"max_length":80},
        {"id":"connection_type","type":"select","label":{"en":"Connection type","bn":"সংযোগের ধরন","hi":"कनेक्शन प्रकार"},"required":true,"options":[
          {"value":"domestic","label":{"en":"Domestic","bn":"গার্হস্থ্য","hi":"घरेलू"}},
          {"value":"commercial","label":{"en":"Commercial","bn":"বাণিজ্যিক","hi":"व्यावसायिक"}}
        ]},
        {"id":"address_proof","type":"file","label":{"en":"Address proof","bn":"ঠিকানার প্রমাণ","hi":"पते का प्रमाण"},"required":true,"accept":["application/pdf","image/jpeg","image/png"],"max_size_mb":10}
      ]
    }'::jsonb,
    '{"pattern":"cert-issuance"}'::jsonb,
    false,
    true
  FROM service_category
  CROSS JOIN revenue_head
  RETURNING id, category_id, revenue_head_id, code, name, description, fee_config, required_documents, form_schema
),
inserted_tenant_service AS (
  INSERT INTO services (
    tenant_id,
    global_service_id,
    code,
    category_id,
    revenue_head_id,
    name,
    description,
    is_active,
    override_config,
    effective_fee_config,
    effective_sla_days,
    required_documents,
    form_schema_additions,
    workflow_overrides,
    version
  )
  SELECT
    tenants.id,
    inserted_global_service.id,
    inserted_global_service.code,
    inserted_global_service.category_id,
    inserted_global_service.revenue_head_id,
    inserted_global_service.name,
    inserted_global_service.description,
    true,
    '{}'::jsonb,
    inserted_global_service.fee_config,
    15,
    inserted_global_service.required_documents,
    '{}'::jsonb,
    '{}'::jsonb,
    1
  FROM inserted_global_service
  JOIN tenants ON tenants.code = 'KMC'
  RETURNING tenant_id, id AS service_id
)
INSERT INTO service_form_versions (
  tenant_id,
  service_id,
  version,
  form_schema,
  ui_schema,
  status,
  published_at
)
SELECT
  inserted_tenant_service.tenant_id,
  inserted_tenant_service.service_id,
  1,
  inserted_global_service.form_schema,
  '{}'::jsonb,
  'published',
  NOW()
FROM inserted_tenant_service
CROSS JOIN inserted_global_service;

COMMIT;
