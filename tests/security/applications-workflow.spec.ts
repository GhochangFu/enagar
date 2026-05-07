import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');
const controllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'applications',
  'applications.controller.ts',
);
const servicePath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'applications',
  'applications.service.ts',
);
const workflowRuntimePath = join(repoRoot, 'packages', 'workflow', 'src', 'index.ts');
const workerPath = join(repoRoot, 'services', 'workflow-engine', 'src', 'index.ts');

describe('Sprint 2.3 applications and workflow contract', () => {
  const appModule = readFileSync(appModulePath, 'utf8');
  const controller = readFileSync(controllerPath, 'utf8');
  const service = readFileSync(servicePath, 'utf8');
  const workflowRuntime = readFileSync(workflowRuntimePath, 'utf8');
  const worker = readFileSync(workerPath, 'utf8');

  it('registers protected application APIs', () => {
    expect(appModule).toContain('ApplicationsModule');
    expect(controller).toContain("@Controller('applications')");
    expect(controller).not.toContain('@Public()');
    for (const route of [
      '@Post()',
      "@Post('drafts')",
      '@Get()',
      "@Get(':docketNo')",
      "@Post(':id/cancel')",
      "@Post(':id/submit')",
      "@Post(':id/comment')",
    ]) {
      expect(controller).toContain(route);
    }
  });

  it('validates submissions with shared form fixtures before creating applications', () => {
    expect(service).toContain('validateSubmission');
    expect(service).toContain('birthCertificateSchema');
    expect(service).toContain('Form submission is invalid');
  });

  it('keeps citizen application reads tenant and owner scoped', () => {
    expect(service).toContain('application.tenant_id === principal.tenantId');
    expect(service).toContain('application.citizen_subject === principal.subject');
    expect(service).toContain("throw new NotFoundException('Application not found')");
  });

  it('exports pure workflow evaluation and idempotent worker helpers', () => {
    expect(workflowRuntime).toContain('evaluateTransition');
    expect(workflowRuntime).toContain('ROLE_NOT_ALLOWED');
    expect(workflowRuntime).toContain('TERMINAL_STAGE');
    expect(worker).toContain('effectIdempotencyKey');
    expect(worker).toContain('executeEffectOnce');
    expect(worker).toContain('reconcileDueStages');
  });
});
