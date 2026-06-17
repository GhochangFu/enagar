-- Sprint 8.2C: allow smart-parking zone assets in bookable_assets catalogue
ALTER TABLE bookable_assets DROP CONSTRAINT IF EXISTS bookable_assets_asset_type_check;

ALTER TABLE bookable_assets
  ADD CONSTRAINT bookable_assets_asset_type_check
    CHECK (asset_type IN ('HALL', 'AUDITORIUM', 'GROUND', 'EQUIPMENT', 'PARKING_ZONE'));
