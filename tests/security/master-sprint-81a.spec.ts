import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1A — bookable asset config and slot model', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260603120000_sprint_81a_bookings_slot_model/migration.sql',
  );
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const bookableWindow = readRepo('apps/api/src/modules/bookings/bookable-window.ts');
  const dto = readRepo('apps/api/src/modules/admin-tenant/dto/tenant-operations.dto.ts');
  const catalogueSeed = readRepo('apps/api/src/modules/services/service-catalogue.seed.ts');
  const bookableSeed = readRepo('apps/api/prisma/seed/bookable-assets.ts');

  it('extends bookable_assets with commercial and slot columns', () => {
    expect(schema).toContain('assetType');
    expect(schema).toContain('rateUnit');
    expect(schema).toContain('baseRatePaise');
    expect(schema).toContain('securityDepositPaise');
    expect(schema).toContain('slotStepMinutes');
    expect(schema).toContain('rules');
    expect(migration).toContain('bookable_assets_asset_type_check');
    expect(migration).toContain("rate_unit IN ('HOUR', 'DAY')");
  });

  it('extends booking_reservations with citizen identity and GiST anti-overlap', () => {
    expect(schema).toContain('bookingNo');
    expect(schema).toContain('citizenId');
    expect(schema).toContain('depositId');
    expect(schema).toContain('cancelledAt');
    expect(migration).toContain('booking_reservations_no_time_overlap');
    expect(migration).toContain('btree_gist');
    expect(migration).toContain('DROP INDEX IF EXISTS booking_reservations_no_overlap_idx');
  });

  it('enforces available windows and slot step alignment in assertBookableWindow', () => {
    expect(tenantService).toContain('assertBookableWindow');
    expect(bookableWindow).toContain('Requested window is outside available hours');
    expect(bookableWindow).toContain('Booking duration must be a positive multiple of');
    expect(bookableWindow).toContain("kind: 'available'");
    expect(bookableWindow).toContain('startsAt: { lte: startsAt }');
    expect(bookableWindow).toContain('endsAt: { gte: endsAt }');
  });

  it('exposes asset commercial fields on admin DTOs and rows', () => {
    expect(dto).toContain('asset_type');
    expect(dto).toContain('base_rate_paise');
    expect(dto).toContain('slot_step_minutes');
    expect(tenantService).toContain('asset_type: row.assetType');
    expect(tenantService).toContain('rate_unit: row.rateUnit');
  });

  it('links KMC community-hall to the seeded hall asset', () => {
    expect(catalogueSeed).toContain('bookable_asset_code');
    expect(catalogueSeed).toContain("'community-hall-main'");
    expect(bookableSeed).toContain('community-hall-main');
    expect(bookableSeed).toContain("code: 'community-hall'");
    expect(bookableSeed).toContain("rateUnit: 'HOUR'");
  });
});
