export interface HoldingSeed {
  tenant_code: string;
  holding_number: string;
  owner_display_name: string;
  ward_number: string;
  locality: string;
  address: {
    line1: string;
    line2?: string;
    pincode: string;
  };
  property_type: 'residential' | 'commercial' | 'mixed_use';
  outstanding_amount: number;
  source: 'local_mirror';
  source_updated_at: string;
}

export const holdingSeeds: HoldingSeed[] = [
  {
    tenant_code: 'KMC',
    holding_number: 'KMC-064-PARK-12B',
    owner_display_name: 'Ananya Sen',
    ward_number: '64',
    locality: 'Park Street',
    address: {
      line1: '12B Park Street',
      line2: 'Kolkata',
      pincode: '700016',
    },
    property_type: 'residential',
    outstanding_amount: 1250,
    source: 'local_mirror',
    source_updated_at: '2026-05-06T17:30:00.000Z',
  },
  {
    tenant_code: 'KMC',
    holding_number: 'KMC-101-GARIA-45',
    owner_display_name: 'Rahul Das',
    ward_number: '101',
    locality: 'Garia',
    address: {
      line1: '45 Garia Main Road',
      pincode: '700084',
    },
    property_type: 'mixed_use',
    outstanding_amount: 0,
    source: 'local_mirror',
    source_updated_at: '2026-05-06T17:30:00.000Z',
  },
  {
    tenant_code: 'HMC',
    holding_number: 'HMC-012-SALKIA-8',
    owner_display_name: 'Priya Mukherjee',
    ward_number: '12',
    locality: 'Salkia',
    address: {
      line1: '8 Salkia School Road',
      pincode: '711106',
    },
    property_type: 'commercial',
    outstanding_amount: 5400,
    source: 'local_mirror',
    source_updated_at: '2026-05-06T17:30:00.000Z',
  },
];
