import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.2E — IoT water meter tenant and phone isolation', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260618170000_sprint_82e_water_meter_recharge_schema/migration.sql',
  );
  const waterService = readRepo('apps/api/src/modules/water-meter/water-meter.service.ts');
  const citizenController = readRepo(
    'apps/api/src/modules/water-meter/citizen-water-meter.controller.ts',
  );
  const adminController = readRepo(
    'apps/api/src/modules/water-meter/water-meter-admin.controller.ts',
  );
  const paymentStore = readRepo('apps/api/src/modules/payments/payment-store.ts');
  const postgresStore = readRepo('apps/api/src/modules/payments/postgres-payment.store.ts');
  const paymentsService = readRepo('apps/api/src/modules/payments/payments.service.ts');

  it('scopes water meter account and recharge tables by tenant_id with RLS', () => {
    expect(schema).toContain('model WaterMeterAccount');
    expect(schema).toContain('model WaterMeterRecharge');
    expect(schema).toContain('@@unique([tenantId, meterId])');
    expect(migration).toContain('water_meter_accounts');
    expect(migration).toContain('water_meter_recharges');
    expect(migration).toContain('ALTER TABLE water_meter_accounts ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE water_meter_recharges ENABLE ROW LEVEL SECURITY');
  });

  it('requires citizen tenant scope and phone match for lookup and recharge', () => {
    expect(waterService).toContain('resolveCitizenMunicipalityForWrite');
    expect(waterService).toContain('tenant_code must match active municipality scope');
    expect(waterService).toContain('normalizePhone(account.consumerPhone)');
    expect(waterService).toContain('normalizePhone(citizen.mobile)');
    expect(waterService).toContain('Water meter is not linked to your registered mobile number');
    expect(citizenController).toContain('citizen/iot-water');
  });

  it('keeps admin reads and writes tenant-scoped', () => {
    expect(waterService).toContain('assertTenantPortalStaff');
    expect(waterService).toContain('where: { tenantId: principal.tenantId }');
    expect(waterService).toContain('upsertAccountForTenant(principal.tenantId');
    expect(adminController).toContain('admin/tenant/iot-water');
  });

  it('links recharge payments and credits balance during stub settlement', () => {
    expect(paymentStore).toContain('waterMeterRechargeId');
    expect(postgresStore).toContain('waterMeterRechargeId');
    expect(postgresStore).toContain('balancePaise: { increment: recharge.amountPaise }');
    expect(postgresStore).toContain("status: 'CREDITED'");
    expect(paymentsService).toContain('completeWaterMeterRechargeStubPayment');
    expect(paymentsService).toContain('payment.water_meter_recharge_id');
  });
});
