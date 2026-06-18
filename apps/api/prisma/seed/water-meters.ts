/**
 * Sprint 8.2E: KMC IoT water meter prepaid recharge pilot accounts.
 */
import { PrismaClient } from '../../src/generated/prisma';

const WATER_METERS = [
  {
    meterId: 'WM-001',
    consumerName: 'Ananya Sen',
    consumerPhone: '9876543210',
    balancePaise: 12_500,
    lastReadingLitres: 182_450,
    lastReadingAt: new Date('2026-06-18T06:30:00.000Z'),
  },
  {
    meterId: 'WM-002',
    consumerName: 'Rahul Das',
    consumerPhone: '9876543210',
    balancePaise: 7_500,
    lastReadingLitres: 98_210,
    lastReadingAt: new Date('2026-06-18T06:35:00.000Z'),
  },
  {
    meterId: 'WM-003',
    consumerName: 'KMC Demo Consumer',
    consumerPhone: '9123456789',
    balancePaise: 5_000,
    lastReadingLitres: 51_000,
    lastReadingAt: new Date('2026-06-18T06:40:00.000Z'),
  },
] as const;

export async function seedWaterMetersForKmc(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true, config: true },
  });
  if (!kmc) return;

  const existingConfig =
    kmc.config && typeof kmc.config === 'object' && !Array.isArray(kmc.config)
      ? (kmc.config as Record<string, unknown>)
      : {};
  const smartCity =
    existingConfig.smart_city &&
    typeof existingConfig.smart_city === 'object' &&
    !Array.isArray(existingConfig.smart_city)
      ? (existingConfig.smart_city as Record<string, unknown>)
      : {};

  await prisma.tenant.update({
    where: { id: kmc.id },
    data: {
      config: {
        ...existingConfig,
        smart_city: {
          ...smartCity,
          iot_water: { enabled: true },
        },
      },
    },
  });

  for (const meter of WATER_METERS) {
    await prisma.waterMeterAccount.upsert({
      where: { tenantId_meterId: { tenantId: kmc.id, meterId: meter.meterId } },
      create: {
        tenantId: kmc.id,
        meterId: meter.meterId,
        consumerName: meter.consumerName,
        consumerPhone: meter.consumerPhone,
        balancePaise: meter.balancePaise,
        lastReadingLitres: meter.lastReadingLitres,
        lastReadingAt: meter.lastReadingAt,
        isActive: true,
      },
      update: {
        consumerName: meter.consumerName,
        consumerPhone: meter.consumerPhone,
        balancePaise: meter.balancePaise,
        lastReadingLitres: meter.lastReadingLitres,
        lastReadingAt: meter.lastReadingAt,
        isActive: true,
      },
    });
  }
}
