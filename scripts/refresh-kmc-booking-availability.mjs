/**
 * Dev helper: top up KMC community-hall weekday availability (09:00–21:00 IST).
 * Usage (repo root): node scripts/refresh-kmc-booking-availability.mjs
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(repoRoot, 'apps/api/package.json'));
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require(resolve(repoRoot, 'apps/api/src/generated/prisma'));

const defaultDatabaseUrl =
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAY_WINDOWS = 56;
const KMC_HALL_CODE = 'community-hall-main';

function istDayBoundsUtc(dayStartUtcMs) {
  const openOffsetMs = (9 - 5.5) * 60 * 60 * 1000;
  const closeOffsetMs = (21 - 5.5) * 60 * 60 * 1000;
  return {
    startsAt: new Date(dayStartUtcMs + openOffsetMs),
    endsAt: new Date(dayStartUtcMs + closeOffsetMs),
  };
}

function nextWeekdayStartsUtc(from, count) {
  const days = [];
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

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  }),
});

try {
  const kmc = await prisma.tenant.findUnique({ where: { code: 'KMC' }, select: { id: true } });
  if (!kmc) {
    console.error('KMC tenant not found — run full seed first.');
    process.exit(1);
  }
  const asset = await prisma.bookableAsset.findUnique({
    where: { tenantId_code: { tenantId: kmc.id, code: KMC_HALL_CODE } },
    select: { id: true },
  });
  if (!asset) {
    console.error('community-hall-main asset not found — run full seed first.');
    process.exit(1);
  }

  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayStarts = nextWeekdayStartsUtc(tomorrow, WEEKDAY_WINDOWS);
  let created = 0;
  for (const dayStart of dayStarts) {
    const { startsAt, endsAt } = istDayBoundsUtc(dayStart.getTime());
    const existing = await prisma.bookableAssetAvailability.findFirst({
      where: { tenantId: kmc.id, assetId: asset.id, kind: 'available', startsAt, endsAt },
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
      created += 1;
    }
  }
  await prisma.bookableAsset.update({
    where: { tenantId_code: { tenantId: kmc.id, code: KMC_HALL_CODE } },
    data: {
      rateUnit: 'HOUR',
      baseRatePaise: 50_000,
      securityDepositPaise: 500_000,
      slotStepMinutes: 60,
      isActive: true,
    },
  });

  console.log(`KMC hall availability: ${created} new weekday window(s) (${dayStarts.length} checked).`);
  console.log('KMC hall rates set to ₹500/hour rent and ₹5,000 security deposit.');
} finally {
  await prisma.$disconnect();
}
