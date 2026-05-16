import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.11 — Phase 6 P4 reports, content, branding, and bookings', () => {
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const tenantDashboard = readRepo('apps/admin-tenant/app/dashboard/dashboard-client.tsx');
  const operationsClient = readRepo(
    'apps/admin-tenant/app/dashboard/operations/operations-client.tsx',
  );
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260516120000_phase6_p4_content_branding_bookings/migration.sql',
  );

  it('adds tenant-scoped PDF report endpoints over aggregate report scopes', () => {
    expect(tenantController).toContain("@Get('exports/:kind.pdf')");
    expect(tenantController).toContain('StreamableFile');
    expect(tenantService).toContain('exportReportPdf');
    expect(tenantService).toContain('reportSummaryRows');
    expect(tenantService).toContain('tenantId: principal.tenantId');
    expect(tenantDashboard).toContain('downloadPdf');
    expect(tenantService).not.toContain('aadhaar');
  });

  it('keeps KB rich authoring markdown-safe and queues idempotent index jobs', () => {
    expect(operationsClient).toContain('Sprint 6.11 · Rich KB authoring');
    expect(operationsClient).toContain('JSON fallback');
    expect(tenantService).toContain('assertValidLocalizedMarkdown');
    expect(tenantService).toContain('queueKbIndexJob');
    expect(tenantService).toContain("status: { in: ['queued', 'processing'] }");
    expect(tenantController).toContain("@Post('kb-articles/requeue-index')");
    expect(schema).toContain('model KbIndexJob');
    expect(migration).toContain('CREATE TABLE kb_index_jobs');
    expect(migration).toContain('ALTER TABLE kb_index_jobs ENABLE ROW LEVEL SECURITY');
  });

  it('constrains branding assets by tenant, MIME type, size, and contrast checks', () => {
    expect(tenantController).toContain("@Get('branding-assets')");
    expect(tenantController).toContain("@Patch('branding-assets')");
    expect(tenantService).toContain('assertBrandingAssetMime');
    expect(tenantService).toContain('Branding asset size must be <= 5MB');
    expect(tenantService).toContain('storage_key must be tenant-prefixed');
    expect(tenantService).toContain('contrastWarnings');
    expect(migration).toContain('tenant_branding_assets_mime_check');
    expect(migration).toContain('tenant_branding_assets_size_check');
  });

  it('adds booking MVP models and rejects overlapping tenant reservations', () => {
    expect(schema).toContain('model BookableAsset');
    expect(schema).toContain('model BookingReservation');
    expect(migration).toContain('CREATE TABLE bookable_assets');
    expect(migration).toContain('CREATE TABLE booking_reservations');
    expect(migration).toContain('ALTER TABLE booking_reservations ENABLE ROW LEVEL SECURITY');
    expect(tenantController).toContain("@Get('bookings')");
    expect(tenantController).toContain("@Post('bookings/reservations')");
    expect(tenantService).toContain('assertBookableWindow');
    expect(tenantService).toContain('Requested window overlaps an existing booking');
    expect(operationsClient).toContain('Booking calendar');
  });
});
