-- Sprint 8.5E: health fleet bookable asset types
ALTER TABLE "bookable_assets" DROP CONSTRAINT IF EXISTS "bookable_assets_asset_type_check";

ALTER TABLE "bookable_assets"
  ADD CONSTRAINT "bookable_assets_asset_type_check"
  CHECK ("asset_type" IN (
    'HALL',
    'AUDITORIUM',
    'GROUND',
    'EQUIPMENT',
    'PARKING_ZONE',
    'LED_BOARD',
    'AMBULANCE',
    'HEARSE'
  ));
