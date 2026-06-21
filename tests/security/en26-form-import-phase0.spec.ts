import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-26 Phase 0 — form import foundation (EN-27–EN-29)', () => {
  it('documents product decisions in ADR-0014', () => {
    const adr = readRepo('docs/ADRs/ADR-0014-form-import-product-decisions.md');
    expect(adr).toContain('replace');
    expect(adr).toContain('draft only');
    expect(adr).toContain('0.65');
    expect(adr).toContain('label_bn');
  });

  it('exports @enagar/forms/form-import shared types and policy', () => {
    const pkg = readRepo('packages/forms/package.json');
    const entry = readRepo('packages/forms/src/form-import/index.ts');
    expect(pkg).toContain('"./form-import"');
    expect(entry).toContain('FormImportProposal');
    expect(entry).toContain('importProposalToFormSchema');
    expect(entry).toContain('FORM_IMPORT_POLICY');
  });

  it('declares tenant admin form-import API routes (EN-28)', () => {
    const controller = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
    expect(controller).toContain("Post('services/:serviceId/form-import')");
    expect(controller).toContain("Get('services/:serviceId/form-import/:jobId')");
    expect(controller).toContain('FormImportJobResponseDto');
  });

  it('declares state admin global form-import API routes (EN-28)', () => {
    const controller = readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts');
    expect(controller).toContain("Post('global-service-library/:code/form-import')");
    expect(controller).toContain("Get('global-service-library/:code/form-import/:jobId')");
    expect(controller).toContain('FormImportService');
  });

  it('keeps form-import orchestration in a shared API module', () => {
    const service = readRepo('apps/api/src/modules/form-import/form-import.service.ts');
    expect(service).toContain('createTenantImportJob');
    expect(service).toContain('createStateImportJob');
    expect(service).toContain('assertTenantPortalStaff');
    expect(service).toContain('assertStateAdmin');
  });
});
