import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 8.2D — EV charging tenant isolation and payment linkage', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const evSchemaMigration = readRepo(
    'apps/api/prisma/migrations/20260618120000_sprint_82d_ev_charging_schema/migration.sql',
  );
  const paymentTargetMigration = readRepo(
    'apps/api/prisma/migrations/20260618140000_sprint_82d_ev_charging_payment_target/migration.sql',
  );
  const evService = readRepo('apps/api/src/modules/ev-charging/ev-charging.service.ts');
  const citizenController = readRepo(
    'apps/api/src/modules/ev-charging/citizen-ev-charging.controller.ts',
  );
  const adminController = readRepo(
    'apps/api/src/modules/ev-charging/ev-charging-admin.controller.ts',
  );
  const holdDto = readRepo('apps/api/src/modules/ev-charging/dto/ev-charging.dto.ts');
  const paymentsService = readRepo('apps/api/src/modules/payments/payments.service.ts');
  const postgresStore = readRepo('apps/api/src/modules/payments/postgres-payment.store.ts');
  const paymentStore = readRepo('apps/api/src/modules/payments/payment-store.ts');

  it('scopes EV chargers and sessions by tenant_id in schema and migration', () => {
    expect(schema).toContain('model EvCharger');
    expect(schema).toContain('model EvSession');
    expect(schema).toContain('tenantId');
    expect(evSchemaMigration).toContain('ev_chargers');
    expect(evSchemaMigration).toContain('ev_sessions');
    expect(evSchemaMigration).toContain('tenant_id');
    expect(evSchemaMigration).toContain('UNIQUE (tenant_id, code)');
  });

  it('requires vehicle registration on citizen hold and scopes writes by municipality', () => {
    expect(holdDto).toContain('vehicle_number');
    expect(holdDto).toContain('tenant_code');
    expect(evService).toContain('resolveCitizenMunicipalityForWrite');
    expect(evService).toContain('tenant_code must match active municipality scope');
    expect(citizenController).toContain('EvChargingTenantQueryDto');
  });

  it('rejects cross-citizen session access and scopes admin reads to portal tenant', () => {
    expect(evService).toContain('getOwnedSession');
    expect(evService).toContain('session.tenantId !== tenantId');
    expect(evService).toContain('You can only manage your own EV charging session');
    expect(evService).toContain('assertTenantPortalStaff');
    expect(evService).toContain('where: { tenantId: principal.tenantId }');
    expect(adminController).toContain('admin/tenant/ev-charging');
  });

  it('links EV session payments through store and stub settlement branch', () => {
    expect(schema).toContain('evSessionId');
    expect(paymentTargetMigration).toContain('ev_session_id');
    expect(paymentStore).toContain('evSessionId');
    expect(postgresStore).toContain('evSessionId');
    expect(paymentsService).toContain('completeEvChargingStubPayment');
    expect(paymentsService).toContain('payment.ev_session_id');
  });
});
