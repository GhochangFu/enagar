import { Prisma, PrismaClient } from '../../src/generated/prisma';

const KMC_HALL_CODE = 'community-hall-main';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAY_WINDOWS = 56;

/** 09:00–21:00 IST for a UTC-midnight calendar day anchor. */
function istDayBoundsUtc(dayStartUtcMs: number): { startsAt: Date; endsAt: Date } {
  const openOffsetMs = (9 - 5.5) * 60 * 60 * 1000;
  const closeOffsetMs = (21 - 5.5) * 60 * 60 * 1000;
  return {
    startsAt: new Date(dayStartUtcMs + openOffsetMs),
    endsAt: new Date(dayStartUtcMs + closeOffsetMs),
  };
}

function nextWeekdayStartsUtc(from: Date, count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = new Date(cursor.getTime() + IST_OFFSET_MS).getUTCDay();
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Sprint 8.1A: KMC community hall asset, weekday 09:00–21:00 IST availability, service link.
 */
export async function seedBookableAssetsForKmc(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true },
  });
  if (!kmc) return;

  const asset = await prisma.bookableAsset.upsert({
    where: { tenantId_code: { tenantId: kmc.id, code: KMC_HALL_CODE } },
    create: {
      tenantId: kmc.id,
      code: KMC_HALL_CODE,
      assetType: 'HALL',
      name: {
        en: 'Community Hall — Main Block',
        bn: 'কমিউনিটি হল — প্রধান ব্লক',
        hi: 'सामुदायिक भवन — मुख्य ब्लॉक',
      },
      location: {
        ward: '001',
        address: { en: 'KMC Municipal Hall, Central Ward', bn: 'কেএমসি পৌর হল' },
      },
      capacity: 120,
      rateUnit: 'HOUR',
      baseRatePaise: 50_000,
      securityDepositPaise: 500_000,
      slotStepMinutes: 60,
      rules: {
        min_duration_minutes: 60,
        max_duration_minutes: 480,
        advance_booking_hours: 24,
        cancellation_policy: 'full_deposit_refund_if_cancelled_48h_before',
      },
      isActive: true,
    },
    update: {
      assetType: 'HALL',
      rateUnit: 'HOUR',
      baseRatePaise: 50_000,
      securityDepositPaise: 500_000,
      slotStepMinutes: 60,
      rules: {
        min_duration_minutes: 60,
        max_duration_minutes: 480,
        advance_booking_hours: 24,
        cancellation_policy: 'full_deposit_refund_if_cancelled_48h_before',
      },
      isActive: true,
    },
  });

  // Rolling weekday windows: top up on every seed so manual smoke always has near-future hours.
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayStarts = nextWeekdayStartsUtc(tomorrow, WEEKDAY_WINDOWS);
  for (const dayStart of dayStarts) {
    const { startsAt, endsAt } = istDayBoundsUtc(dayStart.getTime());
    const existing = await prisma.bookableAssetAvailability.findFirst({
      where: {
        tenantId: kmc.id,
        assetId: asset.id,
        kind: 'available',
        startsAt,
        endsAt,
      },
    });
    if (!existing) {
      await prisma.bookableAssetAvailability.create({
        data: {
          tenantId: kmc.id,
          assetId: asset.id,
          kind: 'available',
          startsAt,
          endsAt,
          note: 'Weekday booking hours (09:00–21:00 IST)',
        },
      });
    }
  }

  const communityHall = await prisma.tenantService.findFirst({
    where: { tenantId: kmc.id, code: 'community-hall' },
    select: { id: true, overrideConfig: true },
  });
  if (communityHall) {
    const overrideConfig = {
      ...(typeof communityHall.overrideConfig === 'object' && communityHall.overrideConfig !== null
        ? (communityHall.overrideConfig as Record<string, unknown>)
        : {}),
      bookable_asset_code: KMC_HALL_CODE,
    };
    await prisma.tenantService.update({
      where: { id: communityHall.id },
      data: { overrideConfig: overrideConfig as Prisma.InputJsonValue },
    });
  }
}
