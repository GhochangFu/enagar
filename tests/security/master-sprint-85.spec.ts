import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.5 — advertising, health bookings, and tenant isolation', () => {
  const advertisingService = readRepo('apps/api/src/modules/advertising/advertising.service.ts');
  const citizenAdvertising = readRepo(
    'apps/api/src/modules/advertising/citizen-advertising.controller.ts',
  );
  const hoardingRateUtil = readRepo('apps/api/src/modules/advertising/hoarding-rate.util.ts');
  const hoardingQuoteRateLimit = readRepo(
    'apps/api/src/modules/advertising/hoarding-quote-rate-limit.ts',
  );
  const bookingsService = readRepo('apps/api/src/modules/bookings/bookings.service.ts');
  const citizenBookingsController = readRepo(
    'apps/api/src/modules/bookings/citizen-bookings.controller.ts',
  );
  const bookingsTimeUtil = readRepo('apps/api/src/modules/bookings/bookings-time.util.ts');
  const citizenBookingListUtil = readRepo(
    'apps/api/src/modules/bookings/citizen-booking-list.util.ts',
  );
  const adminTenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const adminTenantController = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant.controller.ts',
  );
  const bookingSummaryUtil = readRepo(
    'apps/api/src/modules/admin-tenant/admin-tenant-booking-summary.util.ts',
  );

  describe('hoarding calculator', () => {
    it('scopes citizen quote to municipality and rejects staff principals', () => {
      expect(advertisingService).toContain('resolveCitizenMunicipalityForWrite');
      expect(advertisingService).toContain('isCitizenSelfServicePrincipal');
      expect(advertisingService).toContain('tenant_code must match active municipality scope');
      expect(advertisingService).toContain('assertHoardingQuoteRateLimit');
      expect(citizenAdvertising).toContain('citizen/advertising');
      expect(citizenAdvertising).toContain('hoarding/quote');
    });

    it('caps hoarding matrix size and validates ward rows', () => {
      expect(hoardingRateUtil).toContain('MAX_HOARDING_MATRIX_ROWS = 200');
      expect(hoardingRateUtil).toContain('validateHoardingRateMatrix');
      expect(hoardingRateUtil).toContain('duplicate ward_code');
    });

    it('enforces citizen quote rate limit', () => {
      expect(hoardingQuoteRateLimit).toContain('HOARDING_QUOTE_LIMIT_PER_HOUR');
      expect(hoardingQuoteRateLimit).toContain('HttpStatus.TOO_MANY_REQUESTS');
    });

    it('requires tenant portal staff for admin matrix APIs', () => {
      expect(advertisingService).toContain('assertTenantPortalStaff');
      expect(advertisingService).toContain('getHoardingRateMatrix');
      expect(advertisingService).toContain('replaceHoardingRateMatrix');
    });
  });

  describe('LED and health fleet bookings', () => {
    it('scopes citizen booking writes to municipality', () => {
      expect(bookingsService).toContain('resolveCitizenMunicipalityForWrite');
      expect(bookingsService).toContain('tenant_code must match active municipality scope');
      expect(citizenBookingsController).toContain('citizen/bookings');
    });

    it('uses fleet pool auto-assign and rejects direct asset_code for health services', () => {
      expect(bookingsService).toContain('createHealthFleetHold');
      expect(bookingsService).toContain('Do not pass asset_code for health fleet bookings');
      expect(bookingsService).toContain('No fleet units are available for the selected slot');
      expect(bookingsService).toContain('assigned_asset_code');
    });

    it('caps emergency ambulance bookings per citizen per day', () => {
      expect(bookingsService).toContain('MAX_EMERGENCY_BOOKINGS_PER_DAY = 2');
      expect(bookingsService).toContain('assertEmergencyDailyLimit');
      expect(bookingsService).toContain('HttpStatus.TOO_MANY_REQUESTS');
      expect(bookingsService).toContain('emergency bookings are only supported for ambulance');
    });

    it('limits slot query span for availability APIs', () => {
      expect(bookingsTimeUtil).toContain('MAX_SLOT_RANGE_DAYS = 90');
      expect(bookingsTimeUtil).toContain('Slot range must be <=');
    });
  });

  describe('citizen bookings list (8.5F2)', () => {
    it('filters list rows by scoped municipality and omits health vehicle names from list payload', () => {
      expect(bookingsService).toContain('listReservationsForCitizen');
      expect(bookingsService).toContain('resolveMunicipalityTenantIdFromScopeCode');
      expect(citizenBookingsController).toContain('@Get()');
      expect(citizenBookingsController).toContain('listReservationsForCitizen');
      expect(citizenBookingListUtil).toContain('toCitizenBookingListItem');
      expect(citizenBookingListUtil).not.toContain('assigned_asset_code');
    });
  });

  describe('admin booking summary (8.5F2)', () => {
    it('requires tenant portal staff and scopes queries to principal tenant', () => {
      expect(adminTenantController).toContain('dashboard/booking-summary');
      expect(adminTenantService).toContain('getBookingSummary');
      expect(adminTenantService).toContain('assertTenantPortalStaff');
      expect(adminTenantService).toContain('tenantId: principal.tenantId');
      expect(bookingSummaryUtil).toContain('buildTenantBookingSummary');
    });
  });

  describe('deferred scope boundaries', () => {
    it('does not ship tender or pension citizen endpoints in Sprint 8.5', () => {
      expect(citizenAdvertising).not.toContain('tender');
      expect(citizenBookingsController).not.toContain('pension');
      expect(adminTenantController).not.toContain('pension-disbursement');
    });
  });
});
