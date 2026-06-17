import { BadRequestException } from '@nestjs/common';

export type SmartParkingTimeBand = {
  from_hhmm: string;
  to_hhmm: string;
  rate_paise_per_hour: number;
  vehicle_type?: string;
};

export type SmartParkingPricingMatrix = {
  flat_rate_paise_per_hour?: number;
  time_bands?: SmartParkingTimeBand[];
  vehicle_rates?: Record<
    string,
    {
      flat_rate_paise_per_hour?: number;
      time_bands?: SmartParkingTimeBand[];
    }
  >;
};

const DEFAULT_FLAT_RATE_PAISE_PER_HOUR = 3000;
const IST_TIME_ZONE = 'Asia/Kolkata';

export function parseSmartParkingPricingMatrix(value: unknown): SmartParkingPricingMatrix {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as SmartParkingPricingMatrix;
}

export function computeSmartParkingRentPaise(input: {
  pricing: SmartParkingPricingMatrix;
  vehicleType?: string;
  startsAt: Date;
  endsAt: Date;
}): number {
  const { pricing, vehicleType, startsAt, endsAt } = input;
  if (startsAt >= endsAt) {
    throw new BadRequestException('starts_at must be before ends_at');
  }

  let totalPaise = 0;
  let cursorMs = startsAt.getTime();
  const endMs = endsAt.getTime();

  while (cursorMs < endMs) {
    const sliceStart = new Date(cursorMs);
    const sliceEndMs = Math.min(cursorMs + 60 * 60 * 1000, endMs);
    const sliceHours = (sliceEndMs - cursorMs) / (60 * 60 * 1000);
    const ratePaisePerHour = resolveRatePaisePerHour(pricing, vehicleType, sliceStart);
    totalPaise += Math.round(ratePaisePerHour * sliceHours);
    cursorMs = sliceEndMs;
  }

  return totalPaise;
}

export function resolveRatePaisePerHour(
  pricing: SmartParkingPricingMatrix,
  vehicleType: string | undefined,
  instant: Date,
): number {
  const vehicleKey = vehicleType?.trim().toLowerCase();
  const vehicleConfig = vehicleKey ? pricing.vehicle_rates?.[vehicleKey] : undefined;
  const bands = vehicleConfig?.time_bands ?? pricing.time_bands;
  const flatFallback =
    vehicleConfig?.flat_rate_paise_per_hour ??
    pricing.flat_rate_paise_per_hour ??
    DEFAULT_FLAT_RATE_PAISE_PER_HOUR;

  if (!bands?.length) {
    return flatFallback;
  }

  const minuteOfDay = minutesSinceMidnightIst(instant);
  const matched = bands.find((band) => {
    if (band.vehicle_type && band.vehicle_type.trim().toLowerCase() !== (vehicleKey ?? '')) {
      return false;
    }
    return minuteInBand(minuteOfDay, parseHhmm(band.from_hhmm), parseHhmm(band.to_hhmm));
  });

  return matched?.rate_paise_per_hour ?? flatFallback;
}

function minutesSinceMidnightIst(instant: Date): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function parseHhmm(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new BadRequestException(`Invalid time band value: ${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new BadRequestException(`Invalid time band value: ${value}`);
  }
  return hour * 60 + minute;
}

/** `from_hhmm` inclusive, `to_hhmm` exclusive; overnight when `to <= from`. */
export function minuteInBand(minute: number, fromMinute: number, toMinute: number): boolean {
  if (fromMinute === toMinute) {
    return true;
  }
  if (fromMinute < toMinute) {
    return minute >= fromMinute && minute < toMinute;
  }
  return minute >= fromMinute || minute < toMinute;
}
