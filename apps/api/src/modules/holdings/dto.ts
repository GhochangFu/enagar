export interface HoldingAddressResponse {
  line1: string;
  line2?: string;
  pincode: string;
}

export interface HoldingResponse {
  holding_number: string;
  owner_display_name: string;
  ward_number: string;
  locality: string;
  address: HoldingAddressResponse;
  property_type: 'residential' | 'commercial' | 'mixed_use';
  outstanding_amount: number;
  source: 'local_mirror';
  source_updated_at: string;
}

export interface HoldingLookupAuditResponse {
  holding_number: string;
  outcome: 'found' | 'not_found';
  source: 'local_mirror';
  created_at: string;
}

export interface HoldingLookupResponse {
  found: boolean;
  holding: HoldingResponse | null;
  audit: HoldingLookupAuditResponse;
}
