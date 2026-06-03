import { BadRequestException } from '@nestjs/common';

export function computeBookingAmounts(
  asset: { rateUnit: string; baseRatePaise: number; securityDepositPaise: number },
  startsAt: Date,
  endsAt: Date,
): { rent_paise: number; deposit_paise: number; total_paise: number } {
  const durationMs = endsAt.getTime() - startsAt.getTime();
  let rentPaise = 0;
  if (asset.rateUnit === 'HOUR') {
    const hours = durationMs / (60 * 60 * 1000);
    rentPaise = Math.round(asset.baseRatePaise * hours);
  } else if (asset.rateUnit === 'DAY') {
    const days = durationMs / (24 * 60 * 60 * 1000);
    rentPaise = Math.round(asset.baseRatePaise * days);
  } else {
    throw new BadRequestException('Unsupported rate_unit on asset');
  }
  const depositPaise = asset.securityDepositPaise;
  return {
    rent_paise: rentPaise,
    deposit_paise: depositPaise,
    total_paise: rentPaise + depositPaise,
  };
}
