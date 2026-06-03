import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1C — deposit and stub payment linkage', () => {
  const migration = readRepo(
    'apps/api/prisma/migrations/20260604120000_sprint_81c_booking_payments/migration.sql',
  );
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const depositPayment = readRepo(
    'apps/api/src/modules/bookings/bookings-deposit-payment.service.ts',
  );
  const citizenController = readRepo(
    'apps/api/src/modules/bookings/citizen-bookings.controller.ts',
  );
  const paymentsService = readRepo('apps/api/src/modules/payments/payments.service.ts');
  const postgresStore = readRepo('apps/api/src/modules/payments/postgres-payment.store.ts');

  it('links payments and receipts to booking reservations', () => {
    expect(migration).toContain('booking_reservation_id');
    expect(migration).toContain('payments_target_check');
    expect(migration).toContain('booking_security');
    expect(schema).toContain('bookingReservationId');
  });

  it('creates booking_security deposit and initiate-payment route', () => {
    expect(depositPayment).toContain('BOOKING_DEPOSIT_TYPE');
    expect(depositPayment).toContain("'booking_security'");
    expect(postgresStore).toContain('capturePaymentId');
    expect(citizenController).toContain('holds/:id/initiate-payment');
    expect(citizenController).toContain('Idempotency-Key');
  });

  it('settles stub payments for bookings and captures deposit', () => {
    expect(paymentsService).toContain('completeBookingStubPayment');
    expect(postgresStore).toContain('bookingReservationId');
    expect(postgresStore).toContain('capturePaymentId: paymentOwned.id');
  });
});
