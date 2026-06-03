import { BadRequestException } from '@nestjs/common';

const MAX_SLOT_RANGE_DAYS = 90;

export function parseIsoInstant(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO-8601 timestamp`);
  }
  return parsed;
}

export function parseSlotRange(fromRaw: string, toRaw: string): { from: Date; to: Date } {
  const from = parseIsoInstant(fromRaw, 'from');
  const to = parseIsoInstant(toRaw, 'to');
  if (from >= to) {
    throw new BadRequestException('from must be before to');
  }
  const maxSpanMs = MAX_SLOT_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxSpanMs) {
    throw new BadRequestException(`Slot range must be <= ${MAX_SLOT_RANGE_DAYS} days`);
  }
  return { from, to };
}

export function parseBookingWindow(
  startsAtRaw: string,
  endsAtRaw: string,
): { startsAt: Date; endsAt: Date } {
  const startsAt = parseIsoInstant(startsAtRaw, 'starts_at');
  const endsAt = parseIsoInstant(endsAtRaw, 'ends_at');
  if (startsAt >= endsAt) {
    throw new BadRequestException('starts_at must be before ends_at');
  }
  return { startsAt, endsAt };
}
