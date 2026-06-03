import type { Prisma } from '../../generated/prisma';

function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

/** Path-safe booking number (`BK/KMC/2026/00001` → `BK--KMC--2026--00001`). */
export function bookingNoToPathSegment(bookingNo: string): string {
  return bookingNo.replace(/\//g, '--');
}

export function bookingRefFromPathSegment(ref: string): string {
  return ref.includes('--') ? ref.replace(/--/g, '/') : ref;
}

export function jsonLabel(value: Prisma.JsonValue): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    const first = Object.values(record).find((v) => typeof v === 'string' && String(v).trim());
    if (typeof first === 'string') {
      return first.trim();
    }
  }
  return '—';
}

export function formatBookingSlotIst(
  startsAt: Date,
  endsAt: Date,
): { date: string; hours: string } {
  const dateFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'long',
  });
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return {
    date: dateFmt.format(startsAt),
    hours: `${timeFmt.format(startsAt)} – ${timeFmt.format(endsAt)} IST`,
  };
}

export type BookingConfirmationPdfInput = {
  tenantName: string;
  tenantCode: string;
  assetName: string;
  assetCode: string;
  bookingNo: string;
  status: string;
  slotDate: string;
  slotHours: string;
  rentPaise: number;
  depositPaise: number;
  generatedAt: Date;
};

export function buildBookingConfirmationPdfLines(input: BookingConfirmationPdfInput): string[] {
  return [
    'eNagarSeba — Booking Confirmation',
    `ULB: ${input.tenantName} (${input.tenantCode})`,
    `Generated: ${input.generatedAt.toISOString()}`,
    '',
    `Booking no: ${input.bookingNo}`,
    `Status: ${input.status}`,
    `Asset: ${input.assetName} (${input.assetCode})`,
    `Date: ${input.slotDate}`,
    `Hours: ${input.slotHours}`,
    '',
    `Rent: ${formatInrFromPaise(input.rentPaise)}`,
    `Security deposit: ${formatInrFromPaise(input.depositPaise)}`,
    `Total (rent + deposit): ${formatInrFromPaise(input.rentPaise + input.depositPaise)}`,
  ];
}
