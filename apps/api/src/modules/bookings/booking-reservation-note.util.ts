export type BookingReservationNote = {
  hold_expires_at?: string;
  service_code?: string;
  clerk_review?: boolean;
  emergency?: boolean;
  emergency_declaration_at?: string;
  pickup_address?: string | Record<string, string>;
  bpl_declared?: boolean;
  rent_paise_override?: number;
};

export function buildBookingHoldNote(input: {
  holdExpiresAt: Date;
  serviceCode?: string | null;
  clerkReview?: boolean;
  emergency?: boolean;
  emergencyDeclarationAt?: Date;
  pickupAddress?: string | Record<string, string> | null;
  bplDeclared?: boolean;
  rentPaiseOverride?: number | null;
}): string {
  const payload: BookingReservationNote = {
    hold_expires_at: input.holdExpiresAt.toISOString(),
  };
  const serviceCode = input.serviceCode?.trim();
  if (serviceCode) {
    payload.service_code = serviceCode;
  }
  if (input.clerkReview) {
    payload.clerk_review = true;
  }
  if (input.emergency) {
    payload.emergency = true;
    payload.emergency_declaration_at = (input.emergencyDeclarationAt ?? new Date()).toISOString();
  }
  if (input.pickupAddress) {
    payload.pickup_address = input.pickupAddress;
  }
  if (input.bplDeclared) {
    payload.bpl_declared = true;
  }
  if (typeof input.rentPaiseOverride === 'number' && input.rentPaiseOverride >= 0) {
    payload.rent_paise_override = input.rentPaiseOverride;
  }
  return JSON.stringify(payload);
}

export function parseBookingReservationNote(note: string | null | undefined): BookingReservationNote {
  if (!note?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(note) as BookingReservationNote;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function serviceCodeFromReservationNote(note: string | null | undefined): string | undefined {
  const code = parseBookingReservationNote(note).service_code?.trim();
  return code || undefined;
}
