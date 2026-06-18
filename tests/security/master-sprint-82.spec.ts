import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.2 — smart-city tenant isolation and payment linkage', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const parkingMigration = readRepo(
    'apps/api/prisma/migrations/20260617120000_sprint_82a_smart_parking_schema/migration.sql',
  );
  const evMigration = readRepo(
    'apps/api/prisma/migrations/20260618120000_sprint_82d_ev_charging_schema/migration.sql',
  );
  const waterMigration = readRepo(
    'apps/api/prisma/migrations/20260618170000_sprint_82e_water_meter_recharge_schema/migration.sql',
  );
  const parkingService = readRepo('apps/api/src/modules/smart-parking/smart-parking.service.ts');
  const parkingCitizen = readRepo(
    'apps/api/src/modules/smart-parking/citizen-smart-parking.controller.ts',
  );
  const evService = readRepo('apps/api/src/modules/ev-charging/ev-charging.service.ts');
  const evCitizen = readRepo('apps/api/src/modules/ev-charging/citizen-ev-charging.controller.ts');
  const waterService = readRepo('apps/api/src/modules/water-meter/water-meter.service.ts');
  const waterCitizen = readRepo(
    'apps/api/src/modules/water-meter/citizen-water-meter.controller.ts',
  );
  const paymentsService = readRepo('apps/api/src/modules/payments/payments.service.ts');
  const postgresStore = readRepo('apps/api/src/modules/payments/postgres-payment.store.ts');

  describe('smart parking', () => {
    it('scopes zones and bays by tenant_id with RLS', () => {
      expect(schema).toContain('model SmartZone');
      expect(schema).toContain('model ParkingBay');
      expect(parkingMigration).toContain('smart_zones');
      expect(parkingMigration).toContain('parking_bays');
      expect(parkingMigration).toContain('tenant_id');
      expect(parkingMigration).toContain('ALTER TABLE smart_zones ENABLE ROW LEVEL SECURITY');
      expect(parkingMigration).toContain('ALTER TABLE parking_bays ENABLE ROW LEVEL SECURITY');
    });

    it('requires citizen tenant scope and rejects cross-citizen hold access', () => {
      expect(parkingService).toContain('resolveCitizenMunicipalityForWrite');
      expect(parkingService).toContain('tenant_code must match active municipality scope');
      expect(parkingService).toContain('getOwnedSmartParkingHold');
      expect(parkingService).toContain('You can only manage your own parking hold');
      expect(parkingService).toContain('assertTenantPortalStaff');
      expect(parkingService).toContain('where: { tenantId: principal.tenantId }');
      expect(parkingCitizen).toContain('citizen/smart-parking');
    });

    it('rejects occupied bays and duplicate vehicle holds at service layer', () => {
      expect(parkingService).toContain('assertNoConflictingSmartParkingReservation');
      expect(parkingService).toContain('vehicle_number');
      expect(parkingService).toContain('Parking bay is not available');
    });
  });

  describe('ev charging', () => {
    it('scopes chargers and sessions by tenant_id', () => {
      expect(schema).toContain('model EvCharger');
      expect(schema).toContain('model EvSession');
      expect(evMigration).toContain('ev_chargers');
      expect(evMigration).toContain('ev_sessions');
      expect(evMigration).toContain('UNIQUE (tenant_id, code)');
    });

    it('requires vehicle registration and scopes citizen session access', () => {
      expect(evService).toContain('resolveCitizenMunicipalityForWrite');
      expect(evService).toContain('getOwnedSession');
      expect(evService).toContain('You can only manage your own EV charging session');
      expect(evCitizen).toContain('citizen/ev-charging');
    });

    it('links EV session payments through stub settlement', () => {
      expect(postgresStore).toContain('evSessionId');
      expect(paymentsService).toContain('completeEvChargingStubPayment');
      expect(paymentsService).toContain('payment.ev_session_id');
    });
  });

  describe('iot water meter', () => {
    it('scopes meter accounts and recharges by tenant_id with RLS', () => {
      expect(schema).toContain('model WaterMeterAccount');
      expect(schema).toContain('model WaterMeterRecharge');
      expect(schema).toContain('@@unique([tenantId, meterId])');
      expect(waterMigration).toContain('water_meter_accounts');
      expect(waterMigration).toContain('water_meter_recharges');
      expect(waterMigration).toContain(
        'ALTER TABLE water_meter_accounts ENABLE ROW LEVEL SECURITY',
      );
    });

    it('requires phone match for citizen lookup and recharge', () => {
      expect(waterService).toContain('normalizePhone(account.consumerPhone)');
      expect(waterService).toContain('normalizePhone(citizen.mobile)');
      expect(waterService).toContain('Water meter is not linked to your registered mobile number');
      expect(waterCitizen).toContain('citizen/iot-water');
    });

    it('links recharge payments and credits balance on stub settlement', () => {
      expect(postgresStore).toContain('waterMeterRechargeId');
      expect(postgresStore).toContain('balancePaise: { increment: recharge.amountPaise }');
      expect(paymentsService).toContain('completeWaterMeterRechargeStubPayment');
      expect(paymentsService).toContain('payment.water_meter_recharge_id');
    });
  });
});
