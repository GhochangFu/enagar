/**
 * Sprint 8.2A: KMC smart parking pilot zone with 20 numbered bays.
 */
import { PrismaClient } from '../../src/generated/prisma';

const ZONE_CODE = 'ZONE-A';
const BAY_COUNT = 20;

export async function seedSmartParkingForKmc(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true },
  });
  if (!kmc) return;

  const zone = await prisma.smartZone.upsert({
    where: { tenantId_code: { tenantId: kmc.id, code: ZONE_CODE } },
    create: {
      tenantId: kmc.id,
      code: ZONE_CODE,
      name: {
        en: 'Central Market Parking — Zone A',
        bn: 'সেন্ট্রাল মার্কেট পার্কিং — জোন A',
        hi: 'सेंटral मार्कet पार्किंग — ज़ोन A',
      },
      geo: {
        lat: 22.5726,
        lng: 88.3639,
        address: { en: 'Central Market, Ward 1' },
      },
      metadata: {
        pricing_matrix: {
          flat_rate_paise_per_hour: 3000,
          time_bands: [
            { from_hhmm: '09:00', to_hhmm: '18:00', rate_paise_per_hour: 2000 },
            { from_hhmm: '18:00', to_hhmm: '09:00', rate_paise_per_hour: 3000 },
          ],
        },
      },
      capacityBays: BAY_COUNT,
      isActive: true,
    },
    update: {
      capacityBays: BAY_COUNT,
      isActive: true,
      metadata: {
        pricing_matrix: {
          flat_rate_paise_per_hour: 3000,
          time_bands: [
            { from_hhmm: '09:00', to_hhmm: '18:00', rate_paise_per_hour: 2000 },
            { from_hhmm: '18:00', to_hhmm: '09:00', rate_paise_per_hour: 3000 },
          ],
        },
      },
    },
  });

  for (let index = 1; index <= BAY_COUNT; index += 1) {
    const bayCode = `B${String(index).padStart(2, '0')}`;
    await prisma.parkingBay.upsert({
      where: {
        tenantId_zoneId_bayCode: {
          tenantId: kmc.id,
          zoneId: zone.id,
          bayCode,
        },
      },
      create: {
        tenantId: kmc.id,
        zoneId: zone.id,
        bayCode,
        status: 'FREE',
      },
      update: {},
    });
  }
}
