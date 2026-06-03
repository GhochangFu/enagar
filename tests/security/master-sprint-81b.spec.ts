import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1B — availability API and hourly slot generation', () => {
  const publicController = readRepo('apps/api/src/modules/bookings/public-bookings.controller.ts');
  const citizenController = readRepo(
    'apps/api/src/modules/bookings/citizen-bookings.controller.ts',
  );
  const bookingsService = readRepo('apps/api/src/modules/bookings/bookings.service.ts');
  const slotUtil = readRepo('apps/api/src/modules/bookings/bookings-slot.util.ts');
  const appModule = readRepo('apps/api/src/app.module.ts');
  const tenantIsolation = readRepo('tests/security/tenant-isolation.spec.ts');

  it('registers public and citizen booking routes', () => {
    expect(publicController).toContain("@Controller('public/bookings')");
    expect(publicController).toContain("@Get('assets')");
    expect(publicController).toContain('service_code');
    expect(publicController).toContain("@Get('assets/:code/slots')");
    expect(bookingsService).toContain('resolveBookableAssetCodesForService');
    expect(bookingsService).toContain('assertAssetAllowedForService');
    expect(citizenController).toContain("@Controller('citizen/bookings')");
    expect(citizenController).toContain("@Post('quote')");
    expect(citizenController).toContain("@Post('holds')");
    expect(citizenController).toContain("@Post('holds/:id/confirm')");
    expect(citizenController).toContain("@Post(':id/cancel')");
    expect(appModule).toContain('BookingsModule');
  });

  it('implements slot grid generation and whitelisted quote math', () => {
    expect(slotUtil).toContain('generateBookableSlots');
    expect(slotUtil).toContain("'free'");
    expect(slotUtil).toContain("'taken'");
    expect(bookingsService).toContain('computeBookingAmounts');
    expect(bookingsService).toContain('rent_paise');
    expect(bookingsService).toContain('revenue_head_code');
    expect(bookingsService).toContain('assertBookableWindow');
    expect(bookingsService).toContain('resolveCitizenMunicipalityForWrite');
  });

  it('extends tenant isolation contract for booking tables', () => {
    expect(tenantIsolation).toContain('bookable_assets');
    expect(tenantIsolation).toContain('bookable_asset_availability');
    expect(tenantIsolation).toContain('booking_reservations');
  });
});
