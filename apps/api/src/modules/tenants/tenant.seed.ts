/** Citizen portal (Keycloak Option A). Not a filing ULB; omitted from public municipality lists. */
export const CITIZEN_PORTAL_TENANT_CODE = 'WBPORTAL' as const;
/** Stable UUID for WBPORTAL (matches Prisma `tenants` seed). */
export const CITIZEN_PORTAL_TENANT_ID = '99999999-9999-4999-8999-999999999999';

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: Array<'en' | 'bn' | 'hi'>;
  is_active: boolean;
}

export interface TenantConfigResponse extends TenantSummary {
  config: {
    default_language: 'en' | 'bn' | 'hi';
    service_summary: {
      total_services: number;
      categories: number;
    };
    feature_flags: {
      digilocker_enabled: boolean;
      tenant_switcher_enabled: boolean;
    };
  };
}

export const tenantSeeds: TenantSummary[] = [
  {
    id: CITIZEN_PORTAL_TENANT_ID,
    code: CITIZEN_PORTAL_TENANT_CODE,
    name: 'West Bengal Citizen Portal',
    district: 'West Bengal',
    ward_count: 0,
    theme_color: '#1565C0',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'KMC',
    name: 'Kolkata Municipal Corporation',
    district: 'Kolkata',
    ward_count: 144,
    theme_color: '#0F4C75',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'HMC',
    name: 'Howrah Municipal Corporation',
    district: 'Howrah',
    ward_count: 66,
    theme_color: '#1B5E20',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'CMC',
    name: 'Chandannagar Municipal Corporation',
    district: 'Hooghly',
    ward_count: 33,
    theme_color: '#6A1B9A',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'BMC',
    name: 'Bidhannagar Municipal Corporation',
    district: 'North 24 Pgs',
    ward_count: 41,
    theme_color: '#0277BD',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'SMC',
    name: 'Siliguri Municipal Corporation',
    district: 'Darjeeling',
    ward_count: 47,
    theme_color: '#2E7D32',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    code: 'AMC',
    name: 'Asansol Municipal Corporation',
    district: 'Paschim Bardhaman',
    ward_count: 106,
    theme_color: '#C62828',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    code: 'DMC',
    name: 'Durgapur Municipal Corporation',
    district: 'Paschim Bardhaman',
    ward_count: 43,
    theme_color: '#EF6C00',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    code: 'SDDM',
    name: 'South Dum Dum Municipality',
    district: 'North 24 Pgs',
    ward_count: 35,
    theme_color: '#455A64',
    logo_url: null,
    languages_enabled: ['en', 'bn', 'hi'],
    is_active: true,
  },
];
