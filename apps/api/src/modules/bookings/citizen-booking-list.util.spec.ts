import {
  bookingServiceLabel,
  resolveCitizenBookingRentPaise,
  toCitizenBookingListItem,
} from './citizen-booking-list.util';

const baseAsset = {
  assetType: 'AMBULANCE',
  rateUnit: 'HOUR',
  baseRatePaise: 50_000,
  securityDepositPaise: 0,
  rules: { bpl_subsidy_paise: 20_000 },
  code: 'kmc-ambulance-01',
};

const baseRow = {
  id: 'res-1',
  bookingNo: 'BK/KMC/2026/00020',
  status: 'confirmed',
  startsAt: new Date('2026-06-10T04:30:00.000Z'),
  endsAt: new Date('2026-06-10T05:30:00.000Z'),
  holderName: 'Citizen A',
  note: JSON.stringify({
    service_code: 'ambulance',
    emergency: false,
    pickup_address: { en: '12 MG Road, Kolkata' },
  }),
  tenantId: 'tenant-kmc',
  tenant: { code: 'KMC' },
  asset: baseAsset,
};

describe('citizen-booking-list.util', () => {
  describe('bookingServiceLabel', () => {
    it('prefers tenant service catalogue name', () => {
      const map = new Map([['tenant-kmc:ambulance', 'City ambulance service']]);
      expect(
        bookingServiceLabel('ambulance', 'AMBULANCE', map, 'tenant-kmc:ambulance'),
      ).toBe('City ambulance service');
    });

    it('falls back to service code label', () => {
      expect(bookingServiceLabel('hearse', 'HEARSE')).toBe('Hearse van');
    });

    it('falls back to asset type label', () => {
      expect(bookingServiceLabel(undefined, 'HALL')).toBe('Community hall');
    });
  });

  describe('resolveCitizenBookingRentPaise', () => {
    it('returns zero for emergency bookings', () => {
      const note = JSON.stringify({ emergency: true, service_code: 'ambulance' });
      expect(
        resolveCitizenBookingRentPaise(note, baseAsset, baseRow.startsAt, baseRow.endsAt),
      ).toBe(0);
    });

    it('applies BPL subsidy for health fleet', () => {
      const note = JSON.stringify({ service_code: 'ambulance', bpl_declared: true });
      expect(
        resolveCitizenBookingRentPaise(note, baseAsset, baseRow.startsAt, baseRow.endsAt),
      ).toBe(30_000);
    });
  });

  describe('toCitizenBookingListItem', () => {
    it('maps confirmed booking with receipt flag and no asset code', () => {
      const item = toCitizenBookingListItem(baseRow, new Map());
      expect(item).toMatchObject({
        booking_no: 'BK/KMC/2026/00020',
        tenant_code: 'KMC',
        service_code: 'ambulance',
        service_label: 'Municipal ambulance',
        asset_type: 'AMBULANCE',
        status: 'confirmed',
        holder_name: 'Citizen A',
        emergency: false,
        pickup_address: '12 MG Road, Kolkata',
        can_download_receipt: true,
      });
      expect(item).not.toHaveProperty('asset_code');
      expect(item).not.toHaveProperty('assigned_asset_code');
    });

    it('sets can_download_receipt false for holds', () => {
      const item = toCitizenBookingListItem(
        { ...baseRow, status: 'hold', bookingNo: null },
        new Map(),
      );
      expect(item.can_download_receipt).toBe(false);
    });
  });
});
