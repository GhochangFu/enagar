import { Prisma, PrismaClient } from '../../src/generated/prisma';

export const KMC_AMBULANCE_01_CODE = 'kmc-ambulance-01';
export const KMC_AMBULANCE_02_CODE = 'kmc-ambulance-02';
export const KMC_HEARSE_01_CODE = 'kmc-hearse-01';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAY_WINDOWS = 56;

/** 09:00–21:00 IST for a UTC-midnight calendar day anchor. */
function istHealthDayBoundsUtc(dayStartUtcMs: number): { startsAt: Date; endsAt: Date } {
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

async function upsertHealthFleetUnit(
  prisma: PrismaClient,
  tenantId: string,
  input: {
    code: string;
    assetType: 'AMBULANCE' | 'HEARSE';
    name: Prisma.InputJsonValue;
    baseRatePaise: number;
    rules?: Record<string, unknown>;
  },
): Promise<string> {
  const asset = await prisma.bookableAsset.upsert({
    where: { tenantId_code: { tenantId, code: input.code } },
    create: {
      tenantId,
      code: input.code,
      assetType: input.assetType,
      name: input.name,
      location: {
        depot: 'KMC Central Fleet Depot',
        address: { en: 'Municipal Health Depot, Central Ward' },
      },
      rateUnit: 'HOUR',
      baseRatePaise: input.baseRatePaise,
      securityDepositPaise: 0,
      slotStepMinutes: 60,
      rules: {
        citizen_selectable: false,
        min_duration_minutes: 60,
        max_duration_minutes: 480,
        advance_booking_hours: 1,
        ...input.rules,
      },
      isActive: true,
    },
    update: {
      assetType: input.assetType,
      name: input.name,
      rateUnit: 'HOUR',
      baseRatePaise: input.baseRatePaise,
      securityDepositPaise: 0,
      slotStepMinutes: 60,
      rules: {
        citizen_selectable: false,
        min_duration_minutes: 60,
        max_duration_minutes: 480,
        advance_booking_hours: 1,
        ...input.rules,
      },
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
    const { startsAt, endsAt } = istHealthDayBoundsUtc(dayStart.getTime());
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
          note: 'Weekday health fleet hours (09:00–21:00 IST)',
        },
      });
    }
  }
}

async function linkFleetToService(
  prisma: PrismaClient,
  tenantId: string,
  serviceCode: string,
  assetCodes: string[],
): Promise<void> {
  const row = await prisma.tenantService.findFirst({
    where: { tenantId, code: serviceCode },
    select: { id: true, overrideConfig: true },
  });
  if (!row) return;
  const overrideConfig = {
    ...(typeof row.overrideConfig === 'object' && row.overrideConfig !== null
      ? (row.overrideConfig as Record<string, unknown>)
      : {}),
    bookable_asset_codes: assetCodes,
  };
  await prisma.tenantService.update({
    where: { id: row.id },
    data: { overrideConfig: overrideConfig as Prisma.InputJsonValue },
  });
}

/**
 * Sprint 8.5E: KMC health fleet — 2 ambulances, 1 hearse; weekday 09:00–21:00 IST.
 */
export async function seedHealthBookableAssetsForKmc(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true },
  });
  if (!kmc) return;

  const ambulance1Id = await upsertHealthFleetUnit(prisma, kmc.id, {
    code: KMC_AMBULANCE_01_CODE,
    assetType: 'AMBULANCE',
    name: {
      en: 'KMC Ambulance Unit 1',
      bn: 'কেএমসি অ্যাম্বুলেন্স ইউনিট ১',
      hi: 'KMC Ambulance Unit 1',
    },
    baseRatePaise: 50_000,
  });

  const ambulance2Id = await upsertHealthFleetUnit(prisma, kmc.id, {
    code: KMC_AMBULANCE_02_CODE,
    assetType: 'AMBULANCE',
    name: {
      en: 'KMC Ambulance Unit 2',
      bn: 'কেএমসি অ্যাম্বুলেন্স ইউনিট ২',
      hi: 'KMC Ambulance Unit 2',
    },
    baseRatePaise: 50_000,
  });

  const hearseId = await upsertHealthFleetUnit(prisma, kmc.id, {
    code: KMC_HEARSE_01_CODE,
    assetType: 'HEARSE',
    name: {
      en: 'KMC Hearse Van',
      bn: 'কেএমসি শবযান ভ্যান',
      hi: 'KMC Hearse Van',
    },
    baseRatePaise: 80_000,
    rules: { bpl_subsidy_paise: 50_000 },
  });

  for (const assetId of [ambulance1Id, ambulance2Id, hearseId]) {
    await seedWeekdayAvailability(prisma, kmc.id, assetId);
  }

  await linkFleetToService(prisma, kmc.id, 'ambulance', [
    KMC_AMBULANCE_01_CODE,
    KMC_AMBULANCE_02_CODE,
  ]);
  await linkFleetToService(prisma, kmc.id, 'hearse', [KMC_HEARSE_01_CODE]);
}
