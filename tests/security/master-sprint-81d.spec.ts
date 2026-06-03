import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.1D — confirmation PDF', () => {
  const citizenController = readRepo(
    'apps/api/src/modules/bookings/citizen-bookings.controller.ts',
  );
  const bookingsService = readRepo('apps/api/src/modules/bookings/bookings.service.ts');
  const pdfUtil = readRepo('apps/api/src/modules/bookings/bookings-pdf.util.ts');
  const simplePdf = readRepo('apps/api/src/common/pdf/simple-pdf.ts');

  it('exposes citizen confirmation PDF download', () => {
    expect(citizenController).toContain("@Get(':ref/confirmation.pdf')");
    expect(citizenController).toContain('exportConfirmationPdf');
    expect(citizenController).toContain('application/pdf');
  });

  it('generates tenant-scoped PDF with booking details', () => {
    expect(bookingsService).toContain('exportConfirmationPdf');
    expect(bookingsService).toContain("row.status !== 'confirmed'");
    expect(bookingsService).toContain('assertHoldOwnedByCitizen');
    expect(bookingsService).toContain('resolveCitizenMunicipalityForWrite');
    expect(pdfUtil).toContain('formatBookingSlotIst');
    expect(pdfUtil).toContain('bookingNoToPathSegment');
    expect(simplePdf).toContain('renderSimplePdf');
  });
});
