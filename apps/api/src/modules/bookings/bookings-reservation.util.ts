const RESERVATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Avoid Prisma casting booking_no values against the uuid `id` column. */
export function reservationIdOrBookingNoWhere(
  idOrBookingNo: string,
): { id: string } | { bookingNo: string } {
  return RESERVATION_ID_RE.test(idOrBookingNo)
    ? { id: idOrBookingNo }
    : { bookingNo: idOrBookingNo };
}
