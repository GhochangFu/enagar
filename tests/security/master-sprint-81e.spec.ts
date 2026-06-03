import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1E — hourly booking UI', () => {
  const page = readRepo('apps/citizen-pwa/app/page.tsx');
  const bookingWorkspace = readRepo('apps/citizen-pwa/components/booking-workspace.tsx');
  const hourGrid = readRepo('apps/citizen-pwa/components/booking-hour-grid.tsx');
  const bookingsApi = readRepo('apps/citizen-pwa/lib/bookings-api.ts');
  const slotGrid = readRepo('apps/citizen-pwa/lib/booking-slot-grid.ts');
  const operations = readRepo('apps/admin-tenant/app/dashboard/operations/operations-client.tsx');
  const calendarPanel = readRepo('apps/admin-tenant/components/bookings-calendar-panel.tsx');

  it('supports booking deep links from query params', () => {
    expect(page).toContain('urlBookingTenantCode');
    expect(page).toContain('urlBookingServiceCode');
    expect(page).toContain("params.get('tenant')");
    expect(page).toContain("params.get('book')");
    expect(page).toContain('other-facility-booking');
  });

  it('wires citizen booking flow to public slots and hold APIs', () => {
    expect(page).toContain('BookingWorkspace');
    expect(page).toContain('community-hall');
    expect(bookingWorkspace).toContain('fetchAssetSlots');
    expect(bookingWorkspace).toContain('createBookingHold');
    expect(bookingWorkspace).toContain('BookingConfirmationPanel');
    expect(bookingWorkspace).toContain("step === 'details'");
    expect(bookingWorkspace).toContain('createApplicationDraft');
    expect(bookingWorkspace).toContain('Pay fees (stub) & confirm booking');
    expect(bookingsApi).toContain('/public/bookings/assets');
    expect(bookingsApi).toContain('/citizen/bookings/holds');
    expect(bookingsApi).toContain('authHeaders(token');
    expect(bookingsApi).toContain('quoteBooking');
  });

  it('implements accessible hour grid with taken slots non-interactive', () => {
    expect(hourGrid).toContain('BookingHourGrid');
    expect(hourGrid).toContain("slot.status === 'taken'");
    expect(hourGrid).toContain('aria-live');
    expect(slotGrid).toContain('toggleSlotSelection');
    expect(slotGrid).toContain('min_duration_minutes');
  });

  it('upgrades tenant admin bookings calendar and guided asset fields', () => {
    expect(operations).toContain('BookingsCalendarPanel');
    expect(operations).toContain('ops-save-bookable-asset');
    expect(operations).toContain('ops-new-bookable-asset');
    expect(operations).toContain('rate_unit');
    expect(operations).toContain('slot_step_minutes');
    expect(operations).toContain('min_duration_hours');
    expect(calendarPanel).toContain('toCalendarEvents');
    expect(calendarPanel).toContain('booking-calendar-day-hours');
    expect(calendarPanel).toContain('eventsForIstHour');
    expect(calendarPanel).toContain('Asia/Kolkata');
  });
});
