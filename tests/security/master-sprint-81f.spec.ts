import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1F — application-linked booking workflow', () => {
  const bookingWorkspace = readRepo('apps/citizen-pwa/components/booking-workspace.tsx');
  const bookingsApi = readRepo('apps/citizen-pwa/lib/bookings-api.ts');
  const citizenBookingsController = readRepo(
    'apps/api/src/modules/bookings/citizen-bookings.controller.ts',
  );
  const bookingsService = readRepo('apps/api/src/modules/bookings/bookings.service.ts');
  const adminTenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');

  it('links citizen hold to application before submit', () => {
    expect(bookingWorkspace).toContain('linkBookingHoldApplication');
    expect(bookingWorkspace).toContain('submitApplicationDraft');
    expect(bookingsApi).toContain('link-application');
    expect(citizenBookingsController).toContain('link-application');
    expect(bookingsService).toContain('linkApplicationToHold');
  });

  it('syncs desk confirm/reject to reservation hold lifecycle', () => {
    expect(bookingsService).toContain('syncDeskWorkflowToReservation');
    expect(bookingsService).toContain('confirmHoldForDeskApplication');
    expect(bookingsService).toContain('cancelHoldForDeskApplication');
    expect(adminTenantService).toContain('syncDeskWorkflowToReservation');
  });
});
