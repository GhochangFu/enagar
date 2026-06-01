-- Align KMC trade-licence override_config with ADR-0013 catalogue (upfront_and_deferred).
-- Removes legacy fee_rule patches from phase9/11 smokes that inferred upfront_only.
UPDATE services s
SET override_config = (
  COALESCE(s.override_config, '{}'::jsonb) - 'fee_rule'
) || jsonb_build_object(
  'payment_schedule', 'upfront_and_deferred',
  'fee_lines', jsonb_build_object(
    'application', jsonb_build_object(
      'label', jsonb_build_object(
        'en', 'Application fee',
        'bn', 'আবেদন ফি',
        'hi', 'आवेदन शुल्क'
      ),
      'rule', jsonb_build_object(
        'type', 'fixed',
        'amount_paise', 50000,
        'currency', 'INR'
      )
    ),
    'approval', jsonb_build_object(
      'label', jsonb_build_object(
        'en', 'Licence fee',
        'bn', 'লাইসেন্স ফি',
        'hi', 'लाइसेंस शुल्क'
      ),
      'rule', jsonb_build_object(
        'type', 'fixed',
        'amount_paise', 100000,
        'currency', 'INR'
      )
    )
  )
)
FROM tenants t
WHERE s.tenant_id = t.id
  AND t.code = 'KMC'
  AND s.code = 'trade-licence';
