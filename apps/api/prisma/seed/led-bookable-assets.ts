import { Prisma, PrismaClient } from '../../src/generated/prisma';

export const KMC_LED_CENTRAL_CODE = 'kmc-led-central';
export const KMC_LED_PARK_STREET_CODE = 'kmc-led-park-street';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAY_WINDOWS = 56;

/** 06:00–23:00 IST for a UTC-midnight calendar day anchor. */
function istLedDayBoundsUtc(dayStartUtcMs: number): { startsAt: Date; endsAt: Date } {
  const openOffsetMs = (6 - 5.5) * 60 * 60 * 1000;
  const closeOffsetMs = (23 - 5.5) * 60 * 60 * 1000;
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

async function upsertLedBoard(
  prisma: PrismaClient,
  tenantId: string,
  code: string,
  name: Prisma.InputJsonValue,
  location: Prisma.InputJsonValue,
): Promise<string> {
  const asset = await prisma.bookableAsset.upsert({
    where: { tenantId_code: { tenantId, code } },
    create: {
      tenantId,
      code,
      assetType: 'LED_BOARD',
      name,
      location,
      rateUnit: 'HOUR',
      baseRatePaise: 100_000,
      securityDepositPaise: 100_000,
      slotStepMinutes: 60,
      rules: {
        min_duration_minutes: 60,
        max_duration_minutes: 480,
        advance_booking_hours: 24,
        prime_time_blackout: { start: '18:00', end: '21:00', note: 'Optional prime-time hold' },
      },
      isActive: true,
    },
    update: {
      assetType: 'LED_BOARD',
      name,
      location,
      rateUnit: 'HOUR',
      baseRatePaise: 100_000,
      securityDepositPaise: 100_000,
      slotStepMinutes: 60,
      isActive: true,
    },
  });
  return asset.id;
}

async function seedWeekdayAvailability(
  prisma: PrismaClient,
  tenantId: string,
  assetId: string,
): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayStarts = nextWeekdayStartsUtc(tomorrow, WEEKDAY_WINDOWS);
  for (const dayStart of dayStarts) {
    const { startsAt, endsAt } = istLedDayBoundsUtc(dayStart.getTime());
    const existing = await prisma.bookableAssetAvailability.findFirst({
      where: {
        tenantId,
        assetId,
        kind: 'available',
        startsAt,
        endsAt,
      },
    });
    if (!existing) {
      await prisma.bookableAssetAvailability.create({
        data: {
          tenantId,
          assetId,
          kind: 'available',
          startsAt,
          endsAt,
          note: 'Weekday LED hours (06:00–23:00 IST)',
        },
      });
    }
  }
}

/**
 * Sprint 8.5C: KMC LED boards, weekday 06:00–23:00 IST, linked to ad-led service.
 */
export async function seedLedBookableAssetsForKmc(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true },
  });
  if (!kmc) return;

  const centralId = await upsertLedBoard(prisma, kmc.id, KMC_LED_CENTRAL_CODE, {
    en: 'KMC LED — Central Crossing',
    bn: 'কেএমসি এলইডি — সেন্ট্রাল ক্রসিং',
    hi: 'KMC LED — Central Crossing',
  }, {
    ward: '012',
    address: { en: 'Central Crossing, Esplanade', bn: 'সেন্ট্রাল ক্রসিং, এসপ্লানেড' },
  });

  const parkStreetId = await upsertLedBoard(prisma, kmc.id, KMC_LED_PARK_STREET_CODE, {
    en: 'KMC LED — Park Street',
    bn: 'কেএমসি এলইডি — পার্ক স্ট্রিট',
    hi: 'KMC LED — Park Street',
  }, {
    ward: '064',
    address: { en: 'Park Street Junction', bn: 'পার্ক স্ট্রিট জংশন' },
  });

  await seedWeekdayAvailability(prisma, kmc.id, centralId);
  await seedWeekdayAvailability(prisma, kmc.id, parkStreetId);

  const adLed = await prisma.tenantService.findFirst({
    where: { tenantId: kmc.id, code: 'ad-led' },
    select: { id: true, overrideConfig: true },
  });
  if (adLed) {
    const overrideConfig = {
      ...(typeof adLed.overrideConfig === 'object' && adLed.overrideConfig !== null
        ? (adLed.overrideConfig as Record<string, unknown>)
        : {}),
      bookable_asset_codes: [KMC_LED_CENTRAL_CODE, KMC_LED_PARK_STREET_CODE],
    };
    await prisma.tenantService.update({
      where: { id: adLed.id },
      data: { overrideConfig: overrideConfig as Prisma.InputJsonValue },
    });
  }
}
