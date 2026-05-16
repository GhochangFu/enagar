import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.7 designer polish contract', () => {
  const serviceDesigner = readRepo(
    'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
  );
  const adminTenantPackage = readRepo('apps/admin-tenant/package.json');
  const adminTenantLayout = readRepo('apps/admin-tenant/app/layout.tsx');

  it('adds React Flow-backed workflow canvas polish without replacing draft/publish APIs', () => {
    expect(adminTenantPackage).toContain('@xyflow/react');
    expect(adminTenantLayout).toContain('@xyflow/react/dist/style.css');
    expect(serviceDesigner).toContain('ReactFlow');
    expect(serviceDesigner).toContain('WorkflowCanvasPanel');
    expect(serviceDesigner).toContain('buildWorkflowNodes');
    expect(serviceDesigner).toContain('buildWorkflowEdges');
    expect(serviceDesigner).toContain('/workflow-draft');
    expect(serviceDesigner).toContain('/workflow-draft/publish');
  });

  it('adds drag-drop form palette authoring over the existing form schema contract', () => {
    expect(serviceDesigner).toContain('FORM_FIELD_PALETTE');
    expect(serviceDesigner).toContain('FIELD_DRAG_MIME');
    expect(serviceDesigner).toContain('FormVisualBuilder');
    expect(serviceDesigner).toContain('FieldInspector');
    expect(serviceDesigner).toContain('/form-draft');
    expect(serviceDesigner).toContain('/form-draft/publish');
  });

  it('keeps citizen preview and validation tied to shared packages', () => {
    expect(serviceDesigner).toContain('validateFormSchema');
    expect(serviceDesigner).toContain('validateWorkflowDefinition');
    expect(serviceDesigner).toContain('DynamicFormFields');
    expect(serviceDesigner).toContain("platform: 'web'");
  });
});
