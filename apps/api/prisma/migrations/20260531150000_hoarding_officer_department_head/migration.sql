-- Hoarding Officer issues deferred approval payment links (ADR-0013 Pattern C).
UPDATE tenant_designations
SET is_department_head = true
WHERE code = 'hoarding_officer';
