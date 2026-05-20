/**
 * Idempotently seeds `tenants` + `tenant_config` from `tenant.seed.ts` (matches JWT / demo UUIDs).
 * Run: `pnpm db:seed` from repo root, or `pnpm exec prisma db seed` in apps/api.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../src/generated/prisma';
import {
  seedGlobalGrievanceCatalogue,
  seedTenantGrievanceCatalogue,
} from '../src/modules/grievances/grievance-catalogue.seed';
import {
  globalServices,
  resolveEffectiveServices,
  revenueHeads,
  serviceCategories,
  tenantServiceOverrides,
} from '../src/modules/services/service-catalogue.seed';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../src/modules/tenants/tenant.seed';

const defaultDatabaseUrl =
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';

const priorityServiceFormSchemas = [
  {
    schema_version: 1,
    service_code: 'birth-cert',
    version: 1,
    title: label('Birth Certificate', 'জন্ম সনদ', 'जन्म प्रमाणपत्र'),
    description: label(
      'Register and issue a municipal birth certificate.',
      'পৌর জন্ম সনদ নিবন্ধন ও ইস্যু করুন।',
      'नगरपालिका जन्म प्रमाणपत्र पंजीकृत और जारी करें।',
    ),
    fields: [
      section('applicant-section', 'Applicant Details', 'আবেদনকারীর বিবরণ', 'आवेदक विवरण'),
      text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
        required: true,
        min_length: 2,
        max_length: 120,
      }),
      text('mobile', 'Mobile number', 'মোবাইল নম্বর', 'मोबाइल नंबर', {
        required: true,
        pattern: '^[6-9][0-9]{9}$',
      }),
      section('child-section', 'Child Details', 'শিশুর বিবরণ', 'बच्चे का विवरण'),
      text('child_name', 'Child name', 'শিশুর নাম', 'बच्चे का नाम', {
        required: true,
        min_length: 1,
        max_length: 120,
      }),
      dateField('date_of_birth', 'Date of birth', 'জন্ম তারিখ', 'जन्म तिथि', { required: true }),
      selectField(
        'relationship',
        'Relationship to child',
        'শিশুর সঙ্গে সম্পর্ক',
        'बच्चे से संबंध',
        [
          option('parent', 'Parent', 'অভিভাবক', 'अभिभावक'),
          option('guardian', 'Guardian', 'অভিভাবক প্রতিনিধি', 'संरक्षक'),
        ],
        { required: true },
      ),
      fileField(
        'hospital_discharge',
        'Hospital discharge proof',
        'হাসপাতালের ছাড়পত্র',
        'अस्पताल डिस्चार्ज प्रमाण',
        {
          required: true,
          accept: ['application/pdf', 'image/jpeg'],
          max_size_mb: 10,
        },
      ),
    ],
  },
  {
    schema_version: 1,
    service_code: 'trade-licence',
    version: 1,
    title: label('Trade Licence', 'ট্রেড লাইসেন্স', 'व्यापार लाइसेंस'),
    fields: [
      text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
        required: true,
        min_length: 2,
        max_length: 120,
      }),
      text('business_name', 'Business name', 'ব্যবসার নাম', 'व्यवसाय का नाम', {
        required: true,
        min_length: 2,
        max_length: 160,
      }),
      selectField(
        'trade_type',
        'Trade type',
        'ব্যবসার ধরন',
        'व्यापार का प्रकार',
        [
          option('food', 'Food', 'খাদ্য', 'खाद्य'),
          option('retail', 'Retail', 'খুচরা', 'खुदरा'),
          option('industrial', 'Industrial', 'শিল্প', 'औद्योगिक'),
        ],
        { required: true },
      ),
      fileField('premises_proof', 'Premises proof', 'প্রাঙ্গণের প্রমাণ', 'परिसर प्रमाण', {
        required: true,
        accept: ['application/pdf', 'image/jpeg'],
        max_size_mb: 10,
      }),
      fileField('fssai_certificate', 'FSSAI certificate', 'এফএসএসএআই সনদ', 'एफएसएसएआई प्रमाणपत्र', {
        accept: ['application/pdf'],
        max_size_mb: 10,
        show_if: { field: 'trade_type', equals: 'food' },
      }),
    ],
  },
  {
    schema_version: 1,
    service_code: 'prop-tax',
    version: 1,
    title: label('Property Tax Payment', 'সম্পত্তি কর প্রদান', 'संपत्ति कर भुगतान'),
    fields: [
      text('holding_number', 'Holding number', 'হোল্ডিং নম্বর', 'होल्डिंग नंबर', {
        required: true,
        min_length: 3,
        max_length: 50,
      }),
      radioField(
        'payer_type',
        'Payer type',
        'প্রদানকারীর ধরন',
        'भुगतानकर्ता प्रकार',
        [
          option('owner', 'Owner', 'মালিক', 'स्वामी'),
          option('tenant', 'Tenant', 'ভাড়াটে', 'किरायेदार'),
        ],
        { required: true },
      ),
    ],
  },
  {
    schema_version: 1,
    service_code: 'community-hall',
    version: 1,
    title: label('Community Hall Booking', 'কমিউনিটি হল বুকিং', 'सामुदायिक भवन बुकिंग'),
    fields: [
      text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
        required: true,
      }),
      dateField('event_date', 'Event date', 'অনুষ্ঠানের তারিখ', 'कार्यक्रम तिथि', {
        required: true,
      }),
      numberField('guest_count', 'Guest count', 'অতিথির সংখ্যা', 'अतिथि संख्या', {
        required: true,
        min: 1,
        max: 500,
      }),
      textarea('event_details', 'Event details', 'অনুষ্ঠানের বিবরণ', 'कार्यक्रम विवरण', {
        required: true,
        min_length: 10,
        max_length: 1000,
      }),
    ],
  },
  {
    schema_version: 1,
    service_code: 'rti',
    version: 1,
    title: label('RTI Application', 'আরটিআই আবেদন', 'आरटीआई आवेदन'),
    fields: [
      text('applicant_name', 'Applicant name', 'আবেদনকারীর নাম', 'आवेदक का नाम', {
        required: true,
      }),
      textarea('information_requested', 'Information requested', 'চাওয়া তথ্য', 'मांगी गई सूचना', {
        required: true,
        min_length: 20,
        max_length: 2000,
      }),
      radioField(
        'bpl_applicant',
        'BPL applicant?',
        'বিপিএল আবেদনকারী?',
        'बीपीएल आवेदक?',
        [option('yes', 'Yes', 'হ্যাঁ', 'हाँ'), option('no', 'No', 'না', 'नहीं')],
        { required: true },
      ),
      fileField('bpl_card', 'BPL card', 'বিপিএল কার্ড', 'बीपीएल कार्ड', {
        accept: ['application/pdf', 'image/jpeg'],
        max_size_mb: 10,
        show_if: { field: 'bpl_applicant', equals: 'yes' },
      }),
    ],
  },
] as const;

const publishedFormSchemaByServiceCode: Map<string, (typeof priorityServiceFormSchemas)[number]> =
  new Map(priorityServiceFormSchemas.map((schema) => [schema.service_code, schema]));

function label(en: string, bn: string, hi: string): Record<'en' | 'bn' | 'hi', string> {
  return { en, bn, hi };
}

function option(value: string, en: string, bn: string, hi: string) {
  return { value, label: label(en, bn, hi) };
}

function section(id: string, en: string, bn: string, hi: string) {
  return { id, type: 'section', label: label(en, bn, hi) };
}

function text(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'text', label: label(en, bn, hi), ...options };
}

function textarea(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'textarea', label: label(en, bn, hi), ...options };
}

function numberField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'number', label: label(en, bn, hi), ...options };
}

function dateField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'date', label: label(en, bn, hi), ...options };
}

function selectField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  optionsList: Array<ReturnType<typeof option>>,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'select', label: label(en, bn, hi), options: optionsList, ...options };
}

function radioField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  optionsList: Array<ReturnType<typeof option>>,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'radio', label: label(en, bn, hi), options: optionsList, ...options };
}

function fileField(
  id: string,
  en: string,
  bn: string,
  hi: string,
  options: Record<string, unknown> = {},
) {
  return { id, type: 'file', label: label(en, bn, hi), ...options };
}

const addressMasterSeeds = [
  {
    tenant_code: 'KMC',
    borough_code: 'borough-vii',
    borough_name: 'Borough VII',
    ward_number: '64',
    ward_name: 'Ward 64',
    mouza: 'Kasba',
    locality_name: 'Ballygunge Place',
    pincode: '700019',
  },
  {
    tenant_code: 'KMC',
    borough_code: 'borough-xii',
    borough_name: 'Borough XII',
    ward_number: '101',
    ward_name: 'Ward 101',
    mouza: 'Behala',
    locality_name: 'Behala Chowrasta',
    pincode: '700034',
  },
  {
    tenant_code: 'HMC',
    borough_code: 'borough-i',
    borough_name: 'Borough I',
    ward_number: '12',
    ward_name: 'Ward 12',
    mouza: 'Shibpur',
    locality_name: 'Shibpur Road',
    pincode: '711102',
  },
];

const tariffSeeds = [
  {
    tenant_code: 'KMC',
    code: 'property-residential-v1',
    category: 'property',
    name: {
      en: 'Residential Property Tax',
      bn: 'Residential Property Tax',
      hi: 'Residential Property Tax',
    },
    rate_config: {
      type: 'computed',
      input_key: 'built_up_area_sqft',
      base_amount_paise: 5000,
      unit_amount_paise: 125,
    },
  },
  {
    tenant_code: 'KMC',
    code: 'water-domestic-v1',
    category: 'water',
    name: { en: 'Domestic Water Tariff', bn: 'Domestic Water Tariff', hi: 'Domestic Water Tariff' },
    rate_config: {
      type: 'slab',
      input_key: 'monthly_kl',
      slabs: [
        { upto: 10, amount_paise: 0 },
        { upto: 25, amount_paise: 2500 },
        { upto: null, amount_paise: 6000 },
      ],
    },
  },
  {
    tenant_code: 'HMC',
    code: 'conservancy-commercial-v1',
    category: 'conservancy',
    name: {
      en: 'Commercial Conservancy Tariff',
      bn: 'Commercial Conservancy Tariff',
      hi: 'Commercial Conservancy Tariff',
    },
    rate_config: { type: 'fixed', amount_paise: 15000, currency: 'INR' },
  },
];

const notificationTemplateSeeds = [
  {
    tenant_code: 'KMC',
    code: 'application-submitted',
    channel: 'sms',
    locale: 'en',
    trigger: 'application-submitted',
    subject: null,
    body: 'Your {{service_name}} application {{docket_no}} has been submitted.',
    variables: ['service_name', 'docket_no'],
  },
  {
    tenant_code: 'HMC',
    code: 'application-submitted',
    channel: 'push',
    locale: 'en',
    trigger: 'application-submitted',
    subject: 'Application submitted',
    body: '{{service_name}} application {{docket_no}} is now with the municipality.',
    variables: ['service_name', 'docket_no'],
  },
];

const kbArticleSeeds = [
  {
    tenant_code: 'KMC',
    slug: 'birth-certificate-help',
    title: {
      en: 'Birth certificate help',
      bn: 'Birth certificate help',
      hi: 'Birth certificate help',
    },
    body: {
      en: 'Use this article to explain birth certificate prerequisites, fees, and expected SLA.',
      bn: 'Use this article to explain birth certificate prerequisites, fees, and expected SLA.',
      hi: 'Use this article to explain birth certificate prerequisites, fees, and expected SLA.',
    },
    tags: ['certificates', 'birth'],
    status: 'published',
  },
  {
    tenant_code: 'HMC',
    slug: 'water-tariff-help',
    title: { en: 'Water tariff help', bn: 'Water tariff help', hi: 'Water tariff help' },
    body: {
      en: 'Use this article to explain water tariff slabs and payment expectations.',
      bn: 'Use this article to explain water tariff slabs and payment expectations.',
      hi: 'Use this article to explain water tariff slabs and payment expectations.',
    },
    tags: ['water', 'tariff'],
    status: 'draft',
  },
];

const staffSeeds = [
  {
    tenant_code: 'KMC',
    keycloak_user_id: '10000000-0000-4000-8000-000000000101',
    username: 'kmc-tenant-clerk-seed',
    display_name: 'KMC Tenant Clerk Seed',
    role_codes: ['tenant_clerk'],
  },
  {
    tenant_code: 'HMC',
    keycloak_user_id: '10000000-0000-4000-8000-000000000102',
    username: 'hmc-tenant-clerk-seed',
    display_name: 'HMC Tenant Clerk Seed',
    role_codes: ['tenant_clerk'],
  },
];

async function seedGrievancePoliciesForTenant(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const slaN = await prisma.slaPolicy.count({ where: { tenantId } });
  if (slaN === 0) {
    await prisma.slaPolicy.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          hoursToResolve: 48,
        },
        {
          tenantId,
          sortOrder: 1,
          categoryMatch: null,
          grievancePriorityMatch: 'urgent',
          hoursToResolve: 24,
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          hoursToResolve: 72,
        },
      ],
    });
  }

  const rN = await prisma.grievanceRoutingRule.count({ where: { tenantId } });
  if (rN === 0) {
    await prisma.grievanceRoutingRule.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
      ],
    });
  }
}

async function seedAddressAndTariffMasters(prisma: PrismaClient): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { code: { in: ['KMC', 'HMC'] } },
    select: { id: true, code: true },
  });
  const tenantByCode = new Map(tenants.map((tenant) => [tenant.code, tenant]));

  for (const seed of addressMasterSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    const borough = await prisma.borough.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: seed.borough_code } },
      create: {
        tenantId: tenant.id,
        code: seed.borough_code,
        name: seed.borough_name,
      },
      update: {
        name: seed.borough_name,
      },
    });
    const ward = await prisma.ward.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number: seed.ward_number } },
      create: {
        tenantId: tenant.id,
        boroughId: borough.id,
        number: seed.ward_number,
        name: seed.ward_name,
      },
      update: {
        boroughId: borough.id,
        name: seed.ward_name,
      },
    });
    await prisma.locality.upsert({
      where: {
        tenantId_name_pincode: {
          tenantId: tenant.id,
          name: seed.locality_name,
          pincode: seed.pincode,
        },
      },
      create: {
        tenantId: tenant.id,
        wardId: ward.id,
        mouza: seed.mouza,
        name: seed.locality_name,
        pincode: seed.pincode,
      },
      update: {
        wardId: ward.id,
        mouza: seed.mouza,
      },
    });
  }

  for (const seed of tariffSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    await prisma.tenantTariff.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: seed.code } },
      create: {
        tenantId: tenant.id,
        code: seed.code,
        category: seed.category,
        name: seed.name,
        rateConfig: seed.rate_config as Prisma.InputJsonValue,
      },
      update: {
        category: seed.category,
        name: seed.name,
        rateConfig: seed.rate_config as Prisma.InputJsonValue,
        isActive: true,
      },
    });
  }
}

async function seedTenantOperations(prisma: PrismaClient): Promise<void> {
  for (const role of [
    {
      code: 'municipality_admin',
      name: 'Municipality Admin',
      description: 'Municipality administrator aligned with Keycloak operator roles',
    },
    {
      code: 'municipality_clerk',
      name: 'Municipality Clerk',
      description: 'Municipality clerk aligned with Keycloak operator roles',
    },
  ]) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: role,
      update: { name: role.name, description: role.description },
    });
  }

  const tenants = await prisma.tenant.findMany({
    where: { code: { in: ['KMC', 'HMC'] } },
    select: { id: true, code: true, themeColor: true, logoUrl: true, languagesEnabled: true },
  });
  const tenantByCode = new Map(tenants.map((tenant) => [tenant.code, tenant]));

  for (const tenant of tenants) {
    await prisma.tenantConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        branding: {
          theme_color: tenant.themeColor,
          logo_url: tenant.logoUrl ?? '',
          hero_image_url: '',
        },
        featureFlags: {
          kb_cms: true,
          notification_templates: true,
          staff_roles: true,
        },
      },
      update: {
        branding: {
          theme_color: tenant.themeColor,
          logo_url: tenant.logoUrl ?? '',
          hero_image_url: '',
        },
        featureFlags: {
          kb_cms: true,
          notification_templates: true,
          staff_roles: true,
        },
      },
    });
  }

  for (const seed of notificationTemplateSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    await prisma.notificationTemplate.upsert({
      where: {
        tenantId_code_channel_locale: {
          tenantId: tenant.id,
          code: seed.code,
          channel: seed.channel,
          locale: seed.locale,
        },
      },
      create: {
        tenantId: tenant.id,
        code: seed.code,
        channel: seed.channel,
        locale: seed.locale,
        trigger: seed.trigger,
        subject: seed.subject,
        body: seed.body,
        variables: seed.variables,
      },
      update: {
        trigger: seed.trigger,
        subject: seed.subject,
        body: seed.body,
        variables: seed.variables,
        isActive: true,
      },
    });
  }

  for (const seed of kbArticleSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    await prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: seed.slug } },
      create: {
        tenantId: tenant.id,
        slug: seed.slug,
        title: seed.title,
        body: seed.body,
        tags: seed.tags,
        status: seed.status,
        publishedAt: seed.status === 'published' ? new Date() : null,
      },
      update: {
        title: seed.title,
        body: seed.body,
        tags: seed.tags,
        status: seed.status,
        publishedAt: seed.status === 'published' ? new Date() : null,
      },
    });
  }

  for (const seed of staffSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    const user = await prisma.user.upsert({
      where: { keycloakUserId: seed.keycloak_user_id },
      create: {
        tenantId: tenant.id,
        keycloakUserId: seed.keycloak_user_id,
        username: seed.username,
        displayName: seed.display_name,
        status: 'active',
      },
      update: {
        username: seed.username,
        displayName: seed.display_name,
        status: 'active',
      },
    });
    const roles = await prisma.role.findMany({ where: { code: { in: seed.role_codes } } });
    await prisma.userRole.deleteMany({ where: { tenantId: tenant.id, userId: user.id } });
    for (const role of roles) {
      await prisma.userRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }
}

async function seedServiceCatalogue(prisma: PrismaClient): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const category of serviceCategories) {
    const row = await prisma.serviceCategory.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        sortOrder: category.sort_order,
      },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sort_order,
        isActive: true,
      },
    });
    categoryIds.set(category.code, row.id);
  }

  const revenueHeadIds = new Map<string, string>();
  for (const revenueHead of revenueHeads) {
    const row = await prisma.revenueHead.upsert({
      where: { code: revenueHead.code },
      create: {
        code: revenueHead.code,
        name: revenueHead.name,
        accountingCode: revenueHead.accounting_code,
      },
      update: {
        name: revenueHead.name,
        accountingCode: revenueHead.accounting_code,
        isActive: true,
      },
    });
    revenueHeadIds.set(revenueHead.code, row.id);
  }

  const globalServiceIds = new Map<string, string>();
  for (const service of globalServices) {
    const categoryId = categoryIds.get(service.category_code);
    if (!categoryId) {
      throw new Error(`Missing service category seed "${service.category_code}"`);
    }
    const revenueHeadId = service.revenue_head_code
      ? revenueHeadIds.get(service.revenue_head_code)
      : null;
    if (service.revenue_head_code && !revenueHeadId) {
      throw new Error(`Missing revenue head seed "${service.revenue_head_code}"`);
    }

    const row = await prisma.globalService.upsert({
      where: { code: service.code },
      create: {
        code: service.code,
        categoryId,
        revenueHeadId,
        name: service.name,
        description: service.description,
        workflowPattern: service.workflow_pattern,
        defaultSlaDays: service.default_sla_days,
        feeType: service.fee_type,
        feeConfig: service.fee_config as Prisma.InputJsonValue,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        pushesToDigilocker: service.pushes_to_digilocker,
        isActive: true,
      },
      update: {
        categoryId,
        revenueHeadId,
        name: service.name,
        description: service.description,
        workflowPattern: service.workflow_pattern,
        defaultSlaDays: service.default_sla_days,
        feeType: service.fee_type,
        feeConfig: service.fee_config as Prisma.InputJsonValue,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        pushesToDigilocker: service.pushes_to_digilocker,
        isActive: true,
      },
    });
    globalServiceIds.set(service.code, row.id);
  }

  const overrideByTenantService = new Map(
    tenantServiceOverrides.map((override) => [
      `${override.tenant_code}:${override.service_code}`,
      override,
    ]),
  );
  const tenants = await prisma.tenant.findMany({
    where: { code: { not: CITIZEN_PORTAL_TENANT_CODE }, isActive: true },
    select: { id: true, code: true },
  });

  for (const tenant of tenants) {
    for (const service of resolveEffectiveServices(tenant.code)) {
      const categoryId = categoryIds.get(service.category_code);
      if (!categoryId) {
        throw new Error(`Missing service category seed "${service.category_code}"`);
      }
      const revenueHeadId = service.revenue_head_code
        ? revenueHeadIds.get(service.revenue_head_code)
        : null;
      if (service.revenue_head_code && !revenueHeadId) {
        throw new Error(`Missing revenue head seed "${service.revenue_head_code}"`);
      }

      const override = overrideByTenantService.get(`${tenant.code}:${service.code}`);
      const data = {
        globalServiceId: globalServiceIds.get(service.code) ?? null,
        categoryId,
        revenueHeadId: revenueHeadId ?? null,
        name: service.name,
        description: service.description,
        isActive: service.active,
        overrideConfig: { source: service.source } as Prisma.InputJsonValue,
        effectiveFeeConfig: {
          type: service.fee_type,
          ...service.fee_config,
        } as Prisma.InputJsonValue,
        effectiveSlaDays: service.sla_days,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        formSchemaAdditions: (override?.form_schema_additions ?? {}) as Prisma.InputJsonValue,
        workflowOverrides: (override?.workflow_overrides ?? {}) as Prisma.InputJsonValue,
      };

      const tenantService = await prisma.tenantService.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: service.code } },
        create: {
          tenantId: tenant.id,
          code: service.code,
          ...data,
        },
        update: data,
      });

      const formSchema = publishedFormSchemaByServiceCode.get(service.code);
      if (formSchema) {
        await prisma.serviceFormVersion.upsert({
          where: {
            tenantId_serviceId_version: {
              tenantId: tenant.id,
              serviceId: tenantService.id,
              version: formSchema.version,
            },
          },
          create: {
            tenantId: tenant.id,
            serviceId: tenantService.id,
            version: formSchema.version,
            formSchema: formSchema as unknown as Prisma.InputJsonValue,
            uiSchema: {},
            status: 'published',
            publishedAt: new Date(),
          },
          update: {
            formSchema: formSchema as unknown as Prisma.InputJsonValue,
            uiSchema: {},
            status: 'published',
            publishedAt: new Date(),
          },
        });
      }
    }
  }
}

async function seedStateAdminPortal(prisma: PrismaClient): Promise<void> {
  const kmc = await prisma.tenant.findUnique({
    where: { code: 'KMC' },
    select: { id: true, code: true },
  });
  if (!kmc) return;
  const existing = await prisma.stateAuditLog.count({
    where: { action: 'tenant.review', actorSubject: 'seed:state-admin', targetTenantId: kmc.id },
  });
  if (existing > 0) return;
  await prisma.stateAuditLog.create({
    data: {
      actorSubject: 'seed:state-admin',
      actorRole: 'state_admin',
      action: 'tenant.review',
      targetTenantId: kmc.id,
      targetCode: kmc.code,
      metadata: {
        sprint: '6.5',
        note: 'Seeded state-admin audit marker for dashboard smoke tests',
      } as Prisma.InputJsonValue,
    },
  });
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? defaultDatabaseUrl;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seedGlobalGrievanceCatalogue(prisma);
    console.info('Seeded global grievance taxonomy (Sprint 6.21)');

    for (const seed of tenantSeeds) {
      const tenant = await prisma.tenant.upsert({
        where: { code: seed.code },
        create: {
          id: seed.id,
          code: seed.code,
          name: seed.name,
          district: seed.district,
          wardCount: seed.ward_count,
          themeColor: seed.theme_color,
          logoUrl: seed.logo_url,
          languagesEnabled: seed.languages_enabled,
          isActive: seed.is_active,
        },
        update: {
          name: seed.name,
          district: seed.district,
          wardCount: seed.ward_count,
          themeColor: seed.theme_color,
          logoUrl: seed.logo_url,
          languagesEnabled: seed.languages_enabled,
          isActive: seed.is_active,
        },
      });

      await prisma.tenantConfig.upsert({
        where: { tenantId: tenant.id },
        create: { tenantId: tenant.id },
        update: {},
      });

      /** Portal is not an operational grievance jurisdiction; SLA/routing stays on ULBs only. */
      if (tenant.code !== CITIZEN_PORTAL_TENANT_CODE) {
        await seedGrievancePoliciesForTenant(prisma, tenant.id);
        await seedTenantGrievanceCatalogue(prisma, tenant.id, tenant.code);
      }

      console.info(`Seeded tenant ${tenant.code} (${tenant.id})`);
    }
    await seedServiceCatalogue(prisma);
    console.info('Seeded service catalogue for operational tenants');
    await seedAddressAndTariffMasters(prisma);
    console.info('Seeded address and tariff masters for smoke tenants');
    await seedTenantOperations(prisma);
    console.info('Seeded Sprint 6.4 tenant operations data for smoke tenants');
    await seedStateAdminPortal(prisma);
    console.info('Seeded Sprint 6.5 state-admin audit marker');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
