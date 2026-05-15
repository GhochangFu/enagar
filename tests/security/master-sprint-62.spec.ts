import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const formsPath = join(repoRoot, 'packages', 'forms', 'src', 'index.ts');
const workflowPath = join(repoRoot, 'packages', 'workflow', 'src', 'index.ts');
const adminControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant.controller.ts',
);
const serviceDesignerPath = join(
  repoRoot,
  'apps',
  'admin-tenant',
  'app',
  'dashboard',
  'services',
  '[serviceId]',
  'service-designer-client.tsx',
);

describe('Master Sprint 6.2 — form-schema builder + workflow designer contract', () => {
  it('adds form builder-safe schema helpers', () => {
    const src = readFileSync(formsPath, 'utf8');
    expect(src).toContain('createBlankFormSchemaDraft');
    expect(src).toContain('assertValidFormSchema');
  });

  it('adds workflow draft and validation helpers', () => {
    const src = readFileSync(workflowPath, 'utf8');
    expect(src).toContain('createLinearWorkflowDraft');
    expect(src).toContain('validateWorkflowDefinition');
    expect(src).toContain('assertValidWorkflowDefinition');
  });

  it('exposes authenticated tenant-admin designer endpoints', () => {
    const src = readFileSync(adminControllerPath, 'utf8');
    for (const marker of [
      `@Get('services/:serviceId/designer')`,
      `@Patch('services/:serviceId/form-draft')`,
      `@Patch('services/:serviceId/form-draft/publish')`,
      `@Patch('services/:serviceId/workflow-draft')`,
      `@Patch('services/:serviceId/workflow-draft/publish')`,
    ]) {
      expect(src).toContain(marker);
    }
  });

  it('renders preview through the shared web form runtime', () => {
    const src = readFileSync(serviceDesignerPath, 'utf8');
    expect(src).toContain("from '@enagar/forms/web'");
    expect(src).toContain('DynamicFormFields');
    expect(src).toContain('validateWorkflowDefinition');
  });
});
