import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');
const documentsControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'documents',
  'documents.controller.ts',
);
const documentsServicePath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'documents',
  'documents.service.ts',
);
const holdingsControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'holdings',
  'holdings.controller.ts',
);
const holdingsServicePath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'holdings',
  'holdings.service.ts',
);

describe('Sprint 2.4 documents and holdings contract', () => {
  const appModule = readFileSync(appModulePath, 'utf8');
  const documentsController = readFileSync(documentsControllerPath, 'utf8');
  const documentsService = readFileSync(documentsServicePath, 'utf8');
  const holdingsController = readFileSync(holdingsControllerPath, 'utf8');
  const holdingsService = readFileSync(holdingsServicePath, 'utf8');

  it('registers protected document and holding APIs', () => {
    expect(appModule).toContain('DocumentsModule');
    expect(appModule).toContain('HoldingsModule');
    expect(documentsController).toContain("@Controller('documents')");
    expect(holdingsController).toContain("@Controller('holdings')");
    expect(documentsController).not.toContain('@Public()');
    expect(holdingsController).not.toContain('@Public()');
  });

  it('enforces document upload and scan safety contracts', () => {
    expect(documentsController).toContain("@Post('upload-intent')");
    expect(documentsController).toContain("@Post(':id/scan-result')");
    expect(documentsController).toContain("@Get(':id/download')");
    expect(documentsService).toContain('File size exceeds 10 MB');
    expect(documentsService).toContain('Document is not scan-clean');
    expect(documentsService).toContain('tenants/${tenantCode}/applications');
  });

  it('keeps holding lookup tenant-scoped and auditable', () => {
    expect(holdingsController).toContain("@Get(':holdingNumber')");
    expect(holdingsController).toContain("@Get('search')");
    expect(holdingsService).toContain('candidate.tenant_code === tenantCode');
    expect(holdingsService).toContain("outcome: holding ? 'found' : 'not_found'");
  });
});
