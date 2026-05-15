import type { EnagarFormSchema } from '@enagar/forms';

export type LocaleMap = Record<'en' | 'bn' | 'hi', string>;

export type FeeType = 'free' | 'fixed' | 'slab' | 'computed' | 'external';

export interface RevenueHeadSeed {
  code: string;
  name: LocaleMap;
  accounting_code: string;
}

export interface ServiceCategorySeed {
  code: string;
  name: LocaleMap;
  description: LocaleMap;
  sort_order: number;
}

export interface GlobalServiceSeed {
  code: string;
  category_code: string;
  revenue_head_code: string | null;
  name: LocaleMap;
  description: LocaleMap;
  workflow_pattern:
    | 'cert-issuance'
    | 'tax-payment'
    | 'booking'
    | 'noc'
    | 'pension'
    | 'fine'
    | 'instant';
  default_sla_days: number | null;
  fee_type: FeeType;
  fee_config: Record<string, unknown>;
  required_documents: string[];
  pushes_to_digilocker: boolean;
  popular: boolean;
}

export interface TenantServiceOverrideSeed {
  tenant_code: string;
  service_code: string;
  active?: boolean;
  fee_config?: Record<string, unknown>;
  sla_days?: number | null;
  required_documents?: string[];
  form_schema_additions?: Record<string, unknown>;
  workflow_overrides?: Record<string, unknown>;
  tenant_only?: boolean;
  name?: LocaleMap;
  description?: LocaleMap;
  category_code?: string;
  revenue_head_code?: string | null;
}

export interface EffectiveServiceSummary {
  service_id?: string;
  form_version_id?: string;
  tenant_code: string;
  code: string;
  category_code: string;
  revenue_head_code: string | null;
  accounting_code?: string | null;
  name: LocaleMap;
  description: LocaleMap;
  workflow_pattern: GlobalServiceSeed['workflow_pattern'];
  active: boolean;
  fee_type: FeeType;
  fee_config: Record<string, unknown>;
  sla_days: number | null;
  required_documents: string[];
  pushes_to_digilocker: boolean;
  source: 'global' | 'tenant_override' | 'tenant_only';
  popular: boolean;
  form_version?: number;
  form_schema?: EnagarFormSchema;
  ui_schema?: Record<string, unknown>;
  form_published_at?: string | null;
}

export const serviceCategories: ServiceCategorySeed[] = [
  category('certificates', 10, 'Certificates', 'সনদপত্র', 'प्रमाणपत्र'),
  category('tax-property', 20, 'Tax & Property', 'কর ও সম্পত্তি', 'कर और संपत्ति'),
  category('water-sanitation', 30, 'Water & Sanitation', 'জল ও স্যানিটেশন', 'जल और स्वच्छता'),
  category('building-plan', 40, 'Building & Plan', 'ভবন ও পরিকল্পনা', 'भवन और योजना'),
  category('trade-licence', 50, 'Trade Licence', 'ট্রেড লাইসেন্স', 'व्यापार लाइसेंस'),
  category('health', 60, 'Health', 'স্বাস্থ্য', 'स्वास्थ्य'),
  category('welfare', 70, 'Welfare', 'কল্যাণ', 'कल्याण'),
  category('grievances', 80, 'Grievances', 'অভিযোগ', 'शिकायतें'),
  category('bookings', 90, 'Bookings', 'বুকিং', 'बुकिंग'),
  category(
    'parking-transport',
    100,
    'Parking & Transport',
    'পার্কিং ও পরিবহন',
    'पार्किंग और परिवहन',
  ),
  category('advertising', 110, 'Advertising', 'বিজ্ঞাপন', 'विज्ञापन'),
  category('tenders', 120, 'Tenders', 'টেন্ডার', 'निविदाएं'),
  category('fines-challans', 130, 'Fines & Challans', 'জরিমানা ও চালান', 'जुर्माना और चालान'),
  category('rti', 140, 'RTI', 'তথ্যের অধিকার', 'सूचना का अधिकार'),
];

export const revenueHeads: RevenueHeadSeed[] = [
  revenueHead('cert-fee', 'Certificate Fees', 'সনদ ফি', 'प्रमाणपत्र शुल्क', 'RH-CERT'),
  revenueHead('property-tax', 'Property Tax', 'সম্পত্তি কর', 'संपत्ति कर', 'RH-PROP'),
  revenueHead(
    'trade-licence',
    'Trade Licence Fees',
    'ট্রেড লাইসেন্স ফি',
    'व्यापार लाइसेंस शुल्क',
    'RH-TRADE',
  ),
  revenueHead('water-charges', 'Water Charges', 'জল শুল্ক', 'जल शुल्क', 'RH-WATER'),
  revenueHead(
    'building-fee',
    'Building Plan Fees',
    'ভবন পরিকল্পনা ফি',
    'भवन योजना शुल्क',
    'RH-BUILD',
  ),
  revenueHead('booking-fee', 'Booking Fees', 'বুকিং ফি', 'बुकिंग शुल्क', 'RH-BOOK'),
  revenueHead('fine-penalty', 'Fines & Penalties', 'জরিমানা', 'जुर्माना', 'RH-FINE'),
  revenueHead('rti-fee', 'RTI Fees', 'আরটিআই ফি', 'आरटीआई शुल्क', 'RH-RTI'),
];

export const globalServices: GlobalServiceSeed[] = [
  {
    code: 'birth-cert',
    category_code: 'certificates',
    revenue_head_code: 'cert-fee',
    name: label('Birth Certificate', 'জন্ম সনদ', 'जन्म प्रमाणपत्र'),
    description: label(
      'Register and issue a municipal birth certificate.',
      'পৌর জন্ম সনদ নিবন্ধন ও ইস্যু করুন।',
      'नगरपालिका जन्म प्रमाणपत्र पंजीकृत और जारी करें।',
    ),
    workflow_pattern: 'cert-issuance',
    default_sla_days: 7,
    fee_type: 'fixed',
    fee_config: { amount_paise: 5000, currency: 'INR' },
    required_documents: ['hospital-discharge', 'parent-aadhaar', 'address-proof'],
    pushes_to_digilocker: true,
    popular: true,
  },
  {
    code: 'prop-tax',
    category_code: 'tax-property',
    revenue_head_code: 'property-tax',
    name: label('Property Tax Payment', 'সম্পত্তি কর প্রদান', 'संपत्ति कर भुगतान'),
    description: label(
      'Pay property tax by holding number.',
      'হোল্ডিং নম্বর দিয়ে সম্পত্তি কর প্রদান করুন।',
      'होल्डिंग नंबर से संपत्ति कर भुगतान करें।',
    ),
    workflow_pattern: 'tax-payment',
    default_sla_days: null,
    fee_type: 'computed',
    fee_config: { calculator: 'holding-assessment' },
    required_documents: [],
    pushes_to_digilocker: false,
    popular: true,
  },
  {
    code: 'trade-licence',
    category_code: 'trade-licence',
    revenue_head_code: 'trade-licence',
    name: label('Trade Licence', 'ট্রেড লাইসেন্স', 'व्यापार लाइसेंस'),
    description: label(
      'Apply for or renew a municipal trade licence.',
      'পৌর ট্রেড লাইসেন্সের জন্য আবেদন বা নবীকরণ করুন।',
      'नगरपालिका व्यापार लाइसेंस के लिए आवेदन या नवीनीकरण करें।',
    ),
    workflow_pattern: 'cert-issuance',
    default_sla_days: 21,
    fee_type: 'slab',
    fee_config: { slab_set: 'trade-type-v1' },
    required_documents: ['aadhaar', 'premises-proof', 'passport-photo'],
    pushes_to_digilocker: true,
    popular: true,
  },
  {
    code: 'community-hall',
    category_code: 'bookings',
    revenue_head_code: 'booking-fee',
    name: label('Community Hall Booking', 'কমিউনিটি হল বুকিং', 'सामुदायिक भवन बुकिंग'),
    description: label(
      'Book a municipal community hall for an event.',
      'অনুষ্ঠানের জন্য পৌর কমিউনিটি হল বুক করুন।',
      'कार्यक्रम के लिए नगरपालिका सामुदायिक भवन बुक करें।',
    ),
    workflow_pattern: 'booking',
    default_sla_days: 3,
    fee_type: 'fixed',
    fee_config: { amount_paise: 500000, deposit_paise: 500000, currency: 'INR' },
    required_documents: ['aadhaar', 'event-details'],
    pushes_to_digilocker: false,
    popular: true,
  },
  {
    code: 'sanitation-grievance',
    category_code: 'grievances',
    revenue_head_code: null,
    name: label('Sanitation Grievance', 'স্যানিটেশন অভিযোগ', 'स्वच्छता शिकायत'),
    description: label(
      'Report garbage collection or sanitation issues.',
      'আবর্জনা সংগ্রহ বা স্যানিটেশন সমস্যা জানান।',
      'कचरा संग्रह या स्वच्छता समस्या दर्ज करें।',
    ),
    workflow_pattern: 'instant',
    default_sla_days: 2,
    fee_type: 'free',
    fee_config: { amount_paise: 0, currency: 'INR' },
    required_documents: ['photo'],
    pushes_to_digilocker: false,
    popular: true,
  },
  {
    code: 'rti',
    category_code: 'rti',
    revenue_head_code: 'rti-fee',
    name: label('RTI Application', 'আরটিআই আবেদন', 'आरटीआई आवेदन'),
    description: label(
      'Submit a Right to Information application.',
      'তথ্যের অধিকার আইনে আবেদন জমা দিন।',
      'सूचना का अधिकार आवेदन जमा करें।',
    ),
    workflow_pattern: 'instant',
    default_sla_days: 30,
    fee_type: 'fixed',
    fee_config: { amount_paise: 1000, bpl_amount_paise: 0, currency: 'INR' },
    required_documents: ['identity-proof'],
    pushes_to_digilocker: false,
    popular: false,
  },
];

export const tenantServiceOverrides: TenantServiceOverrideSeed[] = [
  {
    tenant_code: 'KMC',
    service_code: 'birth-cert',
    sla_days: 5,
    fee_config: { amount_paise: 5000, urgent_amount_paise: 15000, currency: 'INR' },
    workflow_overrides: { add_stages: ['borough-health-review'] },
  },
  {
    tenant_code: 'HMC',
    service_code: 'community-hall',
    active: false,
  },
  {
    tenant_code: 'KMC',
    service_code: 'pet-licence',
    tenant_only: true,
    category_code: 'health',
    revenue_head_code: 'cert-fee',
    name: label('Pet Licence', 'পোষ্য লাইসেন্স', 'पालतू पशु लाइसेंस'),
    description: label(
      'Register a pet within municipal limits.',
      'পৌরসীমার মধ্যে পোষ্য নিবন্ধন করুন।',
      'नगरपालिका क्षेत्र में पालतू पशु पंजीकृत करें।',
    ),
    fee_config: { amount_paise: 20000, currency: 'INR' },
    sla_days: 14,
    required_documents: ['vaccination-proof', 'owner-address-proof'],
  },
];

export function resolveEffectiveServices(tenantCode: string): EffectiveServiceSummary[] {
  const overrides = tenantServiceOverrides.filter(
    (override) => override.tenant_code === tenantCode,
  );
  const overrideByCode = new Map(overrides.map((override) => [override.service_code, override]));
  const inherited = globalServices.map((service) => {
    const override = overrideByCode.get(service.code);
    return toEffectiveService(tenantCode, service, override);
  });
  const tenantOnly = overrides
    .filter((override) => override.tenant_only)
    .map((override) => toTenantOnlyService(tenantCode, override));

  return [...inherited, ...tenantOnly].sort((left, right) => left.code.localeCompare(right.code));
}

export function getEffectiveService(
  tenantCode: string,
  serviceCode: string,
): EffectiveServiceSummary | undefined {
  return resolveEffectiveServices(tenantCode).find((service) => service.code === serviceCode);
}

function toEffectiveService(
  tenantCode: string,
  service: GlobalServiceSeed,
  override: TenantServiceOverrideSeed | undefined,
): EffectiveServiceSummary {
  return {
    tenant_code: tenantCode,
    code: service.code,
    category_code: service.category_code,
    revenue_head_code: service.revenue_head_code,
    name: service.name,
    description: service.description,
    workflow_pattern: service.workflow_pattern,
    active: override?.active ?? true,
    fee_type: service.fee_type,
    fee_config: override?.fee_config ?? service.fee_config,
    sla_days: override?.sla_days ?? service.default_sla_days,
    required_documents: override?.required_documents ?? service.required_documents,
    pushes_to_digilocker: service.pushes_to_digilocker,
    source: override ? 'tenant_override' : 'global',
    popular: service.popular,
  };
}

function toTenantOnlyService(
  tenantCode: string,
  override: TenantServiceOverrideSeed,
): EffectiveServiceSummary {
  return {
    tenant_code: tenantCode,
    code: override.service_code,
    category_code: override.category_code ?? 'certificates',
    revenue_head_code: override.revenue_head_code ?? null,
    name:
      override.name ?? label(override.service_code, override.service_code, override.service_code),
    description: override.description ?? label('', '', ''),
    workflow_pattern: 'cert-issuance',
    active: override.active ?? true,
    fee_type: 'fixed',
    fee_config: override.fee_config ?? { amount_paise: 0, currency: 'INR' },
    sla_days: override.sla_days ?? null,
    required_documents: override.required_documents ?? [],
    pushes_to_digilocker: false,
    source: 'tenant_only',
    popular: false,
  };
}

function category(
  code: string,
  sortOrder: number,
  en: string,
  bn: string,
  hi: string,
): ServiceCategorySeed {
  return {
    code,
    name: label(en, bn, hi),
    description: label(en, bn, hi),
    sort_order: sortOrder,
  };
}

function revenueHead(
  code: string,
  en: string,
  bn: string,
  hi: string,
  accountingCode: string,
): RevenueHeadSeed {
  return {
    code,
    name: label(en, bn, hi),
    accounting_code: accountingCode,
  };
}

function label(en: string, bn: string, hi: string): LocaleMap {
  return { en, bn, hi };
}
