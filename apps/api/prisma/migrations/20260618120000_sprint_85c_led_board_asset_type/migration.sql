-- Sprint 8.5C: LED board bookable asset type for ad-led slot booking.
ALTER TABLE "bookable_assets" DROP CONSTRAINT IF EXISTS "bookable_assets_asset_type_check";

ALTER TABLE "bookable_assets"
  ADD CONSTRAINT "bookable_assets_asset_type_check"
  CHECK ("asset_type" IN ('HALL', 'AUDITORIUM', 'GROUND', 'EQUIPMENT', 'PARKING_ZONE', 'LED_BOARD'));
