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
  serviceCode?: string;
  generatedAt: Date;
  /** Health fleet citizen PDF — omit assigned vehicle. */
  hideAssetLine?: boolean;
  pickupAddressText?: string;
  holderMobile?: string;
  emergency?: boolean;
  logoPng?: Buffer;
};

export type BookingConfirmationPdfModel = {
  tenantName: string;
  tenantCode: string;
  bookingNo: string;
  statusLabel: string;
  serviceLabel: string;
  assetLabel?: string;
  slotDate: string;
  slotHours: string;
  pickupAddress?: string;
  contactMobile?: string;
  emergency?: boolean;
  rentFormatted: string;
  depositFormatted: string;
  totalFormatted: string;
  generatedAt: Date;
  logoPng?: Buffer;
};

const SERVICE_LABEL_FALLBACK: Record<string, string> = {
  ambulance: 'Municipal ambulance',
  hearse: 'Hearse van',
  'community-hall': 'Community hall',
  'ad-led': 'LED board',
  'smart-parking': 'Smart parking',
};

function formatStatusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return '—';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function resolveServiceLabel(input: BookingConfirmationPdfInput): string {
  const code = input.serviceCode?.trim().toLowerCase();
  if (code) {
    return SERVICE_LABEL_FALLBACK[code] ?? input.serviceCode!.trim();
  }
  return input.assetName.trim() || 'Municipal booking';
}

export function buildBookingConfirmationPdfModel(
  input: BookingConfirmationPdfInput,
): BookingConfirmationPdfModel {
  const rentFormatted = formatInrFromPaise(input.rentPaise);
  const depositFormatted = formatInrFromPaise(input.depositPaise);
  const totalFormatted = formatInrFromPaise(input.rentPaise + input.depositPaise);

  return {
    tenantName: input.tenantName,
    tenantCode: input.tenantCode,
    bookingNo: input.bookingNo,
    statusLabel: formatStatusLabel(input.status),
    serviceLabel: resolveServiceLabel(input),
    assetLabel: input.hideAssetLine
      ? undefined
      : `${input.assetName} (${input.assetCode})`,
    slotDate: input.slotDate,
    slotHours: input.slotHours,
    pickupAddress: input.pickupAddressText?.trim() || undefined,
    contactMobile: input.holderMobile?.trim() || undefined,
    emergency: input.emergency === true,
    rentFormatted,
    depositFormatted,
    totalFormatted,
    generatedAt: input.generatedAt,
    logoPng: input.logoPng,
  };
}

function formatPickupAddress(value: string | Record<string, string> | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'object') {
    for (const key of ['en', 'bn', 'hi']) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return undefined;
}

export function pickupAddressFromReservationNote(
  note: string | null | undefined,
): string | undefined {
  if (!note?.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(note) as { pickup_address?: string | Record<string, string> };
    return formatPickupAddress(parsed.pickup_address);
  } catch {
    return undefined;
  }
}

export function buildBookingConfirmationPdfLines(input: BookingConfirmationPdfInput): string[] {
  const lines = [
    'eNagarSeba — Booking Confirmation',
    `ULB: ${input.tenantName} (${input.tenantCode})`,
    `Generated: ${input.generatedAt.toISOString()}`,
    '',
    `Booking no: ${input.bookingNo}`,
    `Status: ${input.status}`,
  ];
  if (!input.hideAssetLine) {
    lines.push(`Asset: ${input.assetName} (${input.assetCode})`);
  }
  lines.push(`Date: ${input.slotDate}`, `Hours: ${input.slotHours}`);
  if (input.serviceCode?.trim()) {
    lines.push(`Service: ${input.serviceCode.trim()}`);
  }
  if (input.emergency) {
    lines.push('Emergency booking: yes (no rent charged)');
  }
  if (input.pickupAddressText?.trim()) {
    lines.push(`Pickup address: ${input.pickupAddressText.trim()}`);
  }
  if (input.holderMobile?.trim()) {
    lines.push(`Contact mobile: ${input.holderMobile.trim()}`);
  }
  lines.push(
    '',
    `Rent: ${formatInrFromPaise(input.rentPaise)}`,
    `Security deposit: ${formatInrFromPaise(input.depositPaise)}`,
    `Total (rent + deposit): ${formatInrFromPaise(input.rentPaise + input.depositPaise)}`,
  );
  return lines;
}
