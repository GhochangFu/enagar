/**
 * Sprint 8.2D: KMC EV charging pilot chargers.
 */
import { PrismaClient } from '../../src/generated/prisma';

const CHARGERS = [
  {
    code: 'CHG-MKT-01',
    connectorType: 'TYPE2',
    maxKw: '22.00',
    name: {
      en: 'Central Market EV Charger 1',
      bn: 'সেন্ট্রাল মার্কেট ইভি চার্জার ১',
      hi: 'सेंट्रल मार्केट ईवी चार्जर १',
    },
    location: {
      address: { en: 'Central Market, Ward 1' },
      lat: 22.5726,
      lng: 88.3639,
    },
  },
  {
    code: 'CHG-MKT-02',
    connectorType: 'CCS2',
    maxKw: '50.00',
    name: {
      en: 'Central Market EV Charger 2',
      bn: 'সেন্ট্রাল মার্কেট ইভি চার্জার ২',
      hi: 'सेंट्रल मार्केट ईवी चार्जर २',
    },
    location: {
      address: { en: 'Central Market, Ward 1' },
      lat: 22.5728,
      lng: 88.3641,
    },
  },
] as const;

const RATE_PAISE_PER_KWH = 1500;

export async function seedEvChargingForKmc(prisma: PrismaClient): Promise<void> {
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
          ev_charging: { enabled: true },
        },
      },
    },
  });

  for (const charger of CHARGERS) {
    await prisma.evCharger.upsert({
      where: { tenantId_code: { tenantId: kmc.id, code: charger.code } },
      create: {
        tenantId: kmc.id,
        code: charger.code,
        name: charger.name,
        location: charger.location,
        connectorType: charger.connectorType,
        maxKw: charger.maxKw,
        ratePaisePerKwh: RATE_PAISE_PER_KWH,
        isActive: true,
      },
      update: {
        name: charger.name,
        location: charger.location,
        connectorType: charger.connectorType,
        maxKw: charger.maxKw,
        ratePaisePerKwh: RATE_PAISE_PER_KWH,
        isActive: true,
      },
    });
  }
}
