/**
 * Sprint 6.21 — global grievance taxonomy + per-tenant adoption (legacy PWA/mobile slugs).
 */
import type { Prisma, PrismaClient } from '../../generated/prisma';

type LocalizedLabel = { en: string; bn: string; hi: string };

function label(en: string, bn: string, hi: string): LocalizedLabel {
  return { en, bn, hi };
}

export type GlobalGrievanceCategorySeed = {
  code: string;
  name: LocalizedLabel;
  icon: string;
  docketCode?: string;
  sortOrder: number;
  subtypes?: Array<{ code: string; name: LocalizedLabel; sortOrder: number }>;
};

/** Statewide reference library (glossary-aligned + drainage). */
export const globalGrievanceCategories: GlobalGrievanceCategorySeed[] = [
  {
    code: 'sanitation',
    name: label('Sanitation & waste', 'স্যানিটেশন ও বর্জ্য', 'सफ़ाई व कचरा'),
    icon: 'Trash2',
    docketCode: 'SAN',
    sortOrder: 10,
    subtypes: [
      {
        code: 'garbage_not_collected',
        name: label('Garbage not collected', 'আবর্জনা তোলা হয়নি', 'कचरा नहीं उठाया गया'),
        sortOrder: 0,
      },
      {
        code: 'overflowing_bins',
        name: label('Overflowing dustbins', 'পূর্ণ ডাস্টবিন', 'भरे हुए डस्टबिन'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'water',
    name: label('Water supply', 'জল সরবরাহ', 'जल आपूर्ति'),
    icon: 'Droplet',
    docketCode: 'WAT',
    sortOrder: 20,
    subtypes: [
      {
        code: 'no_supply',
        name: label('No water supply', 'জল সরবরাহ নেই', 'जल आपूर्ति नहीं'),
        sortOrder: 0,
      },
      {
        code: 'low_pressure',
        name: label('Low pressure', 'কম চাপ', 'कम दबाव'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'roads',
    name: label('Roads & footpaths', 'রাস্তা ও ফুটপাথ', 'सड़क व फुटपाथ'),
    icon: 'Construction',
    docketCode: 'ROD',
    sortOrder: 30,
    subtypes: [
      {
        code: 'potholes',
        name: label('Potholes', 'গর্ত', 'गड्ढे'),
        sortOrder: 0,
      },
      {
        code: 'damaged_road',
        name: label('Damaged road', 'ক্ষতিগ্রস্ত রাস্তা', 'क्षतिग्रस्त सड़क'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'street_lighting',
    name: label('Street lighting', 'গলির আলো', 'स्ट्रीट लाइट'),
    icon: 'Lightbulb',
    docketCode: 'LGT',
    sortOrder: 40,
    subtypes: [
      {
        code: 'light_not_working',
        name: label('Light not working', 'আলো কাজ করছে না', 'लाइट काम नहीं कर रही'),
        sortOrder: 0,
      },
    ],
  },
  {
    code: 'drainage',
    name: label('Drainage & flooding', 'ড্রেনেজ ও বন্যা', 'जल निकासी व बाढ़'),
    icon: 'Waves',
    docketCode: 'DRN',
    sortOrder: 50,
    subtypes: [
      {
        code: 'blocked_drain',
        name: label('Blocked drain', 'নালা বন্ধ', 'बंद नाली'),
        sortOrder: 0,
      },
    ],
  },
  {
    code: 'public_health',
    name: label('Public health & safety', 'জনস্বাস্থ্য ও নিরাপত্তা', 'सार्वजनिक स्वास्थ्य'),
    icon: 'HeartPulse',
    docketCode: 'HLT',
    sortOrder: 60,
    subtypes: [
      {
        code: 'stray_animals',
        name: label('Stray animals', 'অবাধ পশু', 'आवारा पशु'),
        sortOrder: 0,
      },
      {
        code: 'mosquito_breeding',
        name: label('Mosquito breeding', 'মশা প্রজনন', 'मच्छर प्रजनन'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'encroachment',
    name: label('Encroachment', 'অবৈধ দখল', 'अतिक्रमण'),
    icon: 'Shield',
    docketCode: 'ENC',
    sortOrder: 70,
    subtypes: [
      {
        code: 'illegal_construction',
        name: label('Illegal construction', 'অবৈধ নির্মাণ', 'अवैध निर्माण'),
        sortOrder: 0,
      },
    ],
  },
  {
    code: 'environment',
    name: label('Environment & parks', 'পরিবেশ ও পার্ক', 'पर्यावरण व पार्क'),
    icon: 'TreePine',
    docketCode: 'ENV',
    sortOrder: 80,
    subtypes: [
      {
        code: 'parks_playgrounds',
        name: label('Parks & playgrounds', 'পарк ও খেলার মাঠ', 'पार्क व खेल का मैदान'),
        sortOrder: 0,
      },
      {
        code: 'tree_cutting',
        name: label('Tree cutting / hazard', 'গাছ কাটা / ঝুঁকি', 'वृक्ष कटाई'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'service_delivery',
    name: label('Service delivery', 'সেবা প্রদান', 'सेवा वितरण'),
    icon: 'Briefcase',
    docketCode: 'SRV',
    sortOrder: 90,
    subtypes: [
      {
        code: 'trade_nuisance',
        name: label('Trade / nuisance', 'বাণিজ্য / উপদ্রব', 'व्यापार / उपद्रव'),
        sortOrder: 0,
      },
      {
        code: 'application_delay',
        name: label('Application delay', 'আবেদন বিলম্ব', 'आवेदन में देरी'),
        sortOrder: 1,
      },
    ],
  },
  {
    code: 'emergency',
    name: label('Emergency', 'জরুরি', 'आपात'),
    icon: 'AlertCircle',
    docketCode: 'EMR',
    sortOrder: 100,
    subtypes: [
      {
        code: 'flooding',
        name: label('Flooding', 'বন্যা', 'बाढ़'),
        sortOrder: 0,
      },
    ],
  },
  {
    code: 'other',
    name: label('Other', 'অন্যান্য', 'अन्य'),
    icon: 'MoreHorizontal',
    docketCode: 'OTH',
    sortOrder: 999,
  },
];

/** Tenant-facing codes (Citizen PWA / mobile) → global library link + optional subtypes. */
export const tenantGrievanceAdoptionByCode: Array<{
  tenantCode: string;
  code: string;
  globalCategoryCode: string;
  name: LocalizedLabel;
  icon: string;
  sortOrder: number;
  subtypes?: Array<{ code: string; name: LocalizedLabel; sortOrder: number }>;
}> = [
  {
    tenantCode: 'KMC',
    code: 'roads',
    globalCategoryCode: 'roads',
    name: label('Roads & footpaths', 'রাস্তা ও ফুটপাথ', 'सड़क व फुटपाथ'),
    icon: 'Construction',
    sortOrder: 0,
  },
  {
    tenantCode: 'KMC',
    code: 'sanitation',
    globalCategoryCode: 'sanitation',
    name: label('Sanitation & waste', 'স্যানিটেশন ও বর্জ্য', 'सफ़ाई व कचरा'),
    icon: 'Trash2',
    sortOrder: 1,
  },
  {
    tenantCode: 'KMC',
    code: 'streetlights',
    globalCategoryCode: 'street_lighting',
    name: label('Street lighting', 'গলির আলো', 'स्ट्रीट लाइट'),
    icon: 'Lightbulb',
    sortOrder: 2,
    subtypes: [
      {
        code: 'light_not_working',
        name: label('Light not working', 'আলো কাজ করছে না', 'लाइट काम नहीं कर रही'),
        sortOrder: 0,
      },
    ],
  },
  {
    tenantCode: 'KMC',
    code: 'water',
    globalCategoryCode: 'water',
    name: label('Water supply', 'জল সরবরাহ', 'जल आपूर्ति'),
    icon: 'Droplet',
    sortOrder: 3,
  },
  {
    tenantCode: 'KMC',
    code: 'drainage',
    globalCategoryCode: 'drainage',
    name: label('Drainage & flooding', 'ড্রেনেজ ও বন্যা', 'जल निकासी व बाढ़'),
    icon: 'Waves',
    sortOrder: 4,
    subtypes: [
      {
        code: 'blocked_drain',
        name: label('Blocked drain', 'নালা বন্ধ', 'बंद नाली'),
        sortOrder: 0,
      },
    ],
  },
  {
    tenantCode: 'KMC',
    code: 'stray_dogs',
    globalCategoryCode: 'public_health',
    name: label('Stray animals', 'অবাধ পশু', 'आवारा पशु'),
    icon: 'HeartPulse',
    sortOrder: 5,
    subtypes: [
      {
        code: 'stray_animals',
        name: label('Stray animals', 'অবাধ পশু', 'आवारा पशु'),
        sortOrder: 0,
      },
    ],
  },
  {
    tenantCode: 'KMC',
    code: 'parks',
    globalCategoryCode: 'environment',
    name: label('Parks & playgrounds', 'পার্ক ও খেলার মাঠ', 'पार्क व खेल का मैदान'),
    icon: 'TreePine',
    sortOrder: 6,
    subtypes: [
      {
        code: 'parks_playgrounds',
        name: label('Parks & playgrounds', 'পার্ক ও খেলার মাঠ', 'पार्क व खेल का मैदान'),
        sortOrder: 0,
      },
    ],
  },
  {
    tenantCode: 'KMC',
    code: 'encroachment',
    globalCategoryCode: 'encroachment',
    name: label('Encroachment', 'অবৈধ দখল', 'अतिक्रमण'),
    icon: 'Shield',
    sortOrder: 7,
  },
  {
    tenantCode: 'KMC',
    code: 'trade',
    globalCategoryCode: 'service_delivery',
    name: label('Trade / nuisance', 'বাণিজ্য / উপদ্রব', 'व्यापार / उपद्रव'),
    icon: 'Briefcase',
    sortOrder: 8,
    subtypes: [
      {
        code: 'trade_nuisance',
        name: label('Trade / nuisance', 'বাণিজ্য / উপদ্রব', 'व्यापार / उपद्रव'),
        sortOrder: 0,
      },
    ],
  },
  {
    tenantCode: 'KMC',
    code: 'other',
    globalCategoryCode: 'other',
    name: label('Other', 'অন্যান্য', 'अन्य'),
    icon: 'MoreHorizontal',
    sortOrder: 99,
  },
  {
    tenantCode: 'HMC',
    code: 'roads',
    globalCategoryCode: 'roads',
    name: label('Roads & footpaths', 'রাস্তা ও ফুটপাথ', 'सड़क व फुटपाथ'),
    icon: 'Construction',
    sortOrder: 0,
  },
  {
    tenantCode: 'HMC',
    code: 'sanitation',
    globalCategoryCode: 'sanitation',
    name: label('Sanitation & waste', 'স্যানিটেশন ও বর্জ্য', 'सफ़ाई व कचरा'),
    icon: 'Trash2',
    sortOrder: 1,
  },
  {
    tenantCode: 'HMC',
    code: 'water',
    globalCategoryCode: 'water',
    name: label('Water supply', 'জল সরবরাহ', 'जल आपूर्ति'),
    icon: 'Droplet',
    sortOrder: 2,
  },
  {
    tenantCode: 'HMC',
    code: 'other',
    globalCategoryCode: 'other',
    name: label('Other', 'অন্যান্য', 'अन्य'),
    icon: 'MoreHorizontal',
    sortOrder: 99,
  },
];

export async function seedGlobalGrievanceCatalogue(prisma: PrismaClient): Promise<void> {
  for (const row of globalGrievanceCategories) {
    await prisma.globalGrievanceCategory.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name as Prisma.InputJsonValue,
        icon: row.icon,
        docketCode: row.docketCode ?? null,
        sortOrder: row.sortOrder,
        isActive: true,
      },
      update: {
        name: row.name as Prisma.InputJsonValue,
        icon: row.icon,
        docketCode: row.docketCode ?? null,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });

    if (row.subtypes) {
      for (const sub of row.subtypes) {
        await prisma.globalGrievanceSubtype.upsert({
          where: {
            globalCategoryCode_code: {
              globalCategoryCode: row.code,
              code: sub.code,
            },
          },
          create: {
            globalCategoryCode: row.code,
            code: sub.code,
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
          },
          update: {
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
          },
        });
      }
    }
  }
}

export async function seedTenantGrievanceCatalogue(
  prisma: PrismaClient,
  tenantId: string,
  tenantCode: string,
): Promise<void> {
  const rows = tenantGrievanceAdoptionByCode.filter((r) => r.tenantCode === tenantCode);
  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    await prisma.tenantGrievanceCategory.upsert({
      where: { tenantId_code: { tenantId, code: row.code } },
      create: {
        tenantId,
        code: row.code,
        globalCategoryCode: row.globalCategoryCode,
        name: row.name as Prisma.InputJsonValue,
        icon: row.icon,
        sortOrder: row.sortOrder,
        isActive: true,
        source: 'global_adopted',
      },
      update: {
        globalCategoryCode: row.globalCategoryCode,
        name: row.name as Prisma.InputJsonValue,
        icon: row.icon,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });

    if (row.subtypes) {
      for (const sub of row.subtypes) {
        await prisma.tenantGrievanceSubtype.upsert({
          where: {
            tenantId_categoryCode_code: {
              tenantId,
              categoryCode: row.code,
              code: sub.code,
            },
          },
          create: {
            tenantId,
            categoryCode: row.code,
            code: sub.code,
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
            source: 'global_adopted',
          },
          update: {
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
          },
        });
      }
    }
  }
}

/** Minimal catalogue for integration-test tenants (matches legacy db.spec categories). */
export async function seedMinimalTenantGrievanceCatalogue(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const minimal = [
    {
      code: 'roads',
      global: 'roads',
      name: label('Roads', 'রাস্তা', 'सड़क'),
      icon: 'Construction',
      sortOrder: 0,
    },
    {
      code: 'sanitation',
      global: 'sanitation',
      name: label('Sanitation', 'স্যানিটেশন', 'सफ़ाई'),
      icon: 'Trash2',
      sortOrder: 1,
    },
  ] as const;

  for (const row of minimal) {
    await prisma.tenantGrievanceCategory.upsert({
      where: { tenantId_code: { tenantId, code: row.code } },
      create: {
        tenantId,
        code: row.code,
        globalCategoryCode: row.global,
        name: row.name as Prisma.InputJsonValue,
        icon: row.icon,
        sortOrder: row.sortOrder,
        isActive: true,
        source: 'global_adopted',
      },
      update: { isActive: true },
    });
  }
}

export async function seedGrievanceTaxonomy(prisma: PrismaClient): Promise<void> {
  await seedGlobalGrievanceCatalogue(prisma);
}
