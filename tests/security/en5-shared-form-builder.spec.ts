import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('EN-5 — shared @enagar/forms/builder', () => {
  it('exports builder entry for State and Tenant portals', () => {
    const formsPackage = readRepo('packages/forms/package.json');
    const builderIndex = readRepo('packages/forms/src/builder/index.ts');
    expect(formsPackage).toContain('"./builder"');
    expect(builderIndex).toContain('FormSchemaBuilder');
    expect(builderIndex).toContain('FormCitizenPreview');
    expect(builderIndex).toContain('FieldInspector');
    expect(builderIndex).toContain('FieldValidationInspector');
  });

  it('wires tenant service designer to the shared builder', () => {
    const serviceDesigner = readRepo(
      'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
    );
    expect(serviceDesigner).toContain('@enagar/forms/builder');
    expect(serviceDesigner).toContain('FormSchemaBuilder');
    expect(serviceDesigner).not.toContain('function FormVisualBuilder');
  });

  it('uses FieldValidationInspector in shared FormSchemaBuilder', () => {
    const builder = readRepo('packages/forms/src/builder/FormSchemaBuilder.tsx');
    expect(builder).toContain('FieldValidationInspector');
    expect(builder).toContain('allFields={schema?.fields ?? []}');
  });

  it('FieldValidationInspector covers validation authoring controls', () => {
    const inspector = readRepo('packages/forms/src/builder/FieldValidationInspector.tsx');
    expect(inspector).toContain('Includes one option (multi-select only)');
    expect(inspector).toContain('isMultiselectField');
    expect(inspector).toContain('Conditional visibility');
    expect(inspector).toContain('Text validation');
    expect(inspector).toContain('Pattern preset');
    expect(inspector).toContain('Number validation');
    expect(inspector).toContain('Date validation');
  });

  it('enforces date min/max in shared form engine (EN-5 Phase 3)', () => {
    const engine = readRepo('packages/forms/src/index.ts');
    expect(engine).toContain('validateDateValue');
    expect(engine).toContain('validateDateBounds');
    expect(engine).toContain('minimum: field.min_date');
  });

  it('includes builder paths in portal tailwind content', () => {
    expect(readRepo('apps/admin-tenant/tailwind.config.ts')).toContain(
      'packages/forms/src/builder',
    );
    expect(readRepo('apps/admin-state/tailwind.config.ts')).toContain('packages/forms/src/builder');
  });

  it('adds preview toolbar and shared JSON fallback (EN-5 Phase 5)', () => {
    const preview = readRepo('packages/forms/src/builder/FormCitizenPreview.tsx');
    const builderIndex = readRepo('packages/forms/src/builder/index.ts');
    expect(preview).toContain('Show-if smoke');
    expect(preview).toContain('onValuesChange');
    expect(builderIndex).toContain('FormSchemaJsonFallback');
    expect(builderIndex).toContain('buildPreviewSampleValues');
    expect(
      readRepo('apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx'),
    ).toContain('FormSchemaJsonFallback');
    expect(
      readRepo('apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx'),
    ).toContain('FormSchemaJsonFallback');
    expect(
      readRepo('apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx'),
    ).toContain('jsonMode="collapsed"');
  });

  it('State Admin exposes global library visual form editor route', () => {
    expect(readRepo('apps/admin-state/package.json')).toContain('"@enagar/forms"');
    expect(readRepo('apps/admin-state/app/dashboard/library/[code]/form/page.tsx')).toContain(
      'GlobalFormBuilderClient',
    );
    expect(
      readRepo('apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx'),
    ).toContain('@enagar/forms/builder');
    expect(
      readRepo('apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx'),
    ).toContain('FormSchemaBuilder');
    expect(readRepo('apps/admin-state/components/state-config-sections.tsx')).toContain(
      'Edit apply form',
    );
    expect(readRepo('apps/admin-state/components/state-config-sections.tsx')).not.toContain(
      'Form template (JSON)',
    );
  });

  it('adds cross-field rules and equals_any visibility (EN-5 Phase 6)', () => {
    const engine = readRepo('packages/forms/src/index.ts');
    const builderIndex = readRepo('packages/forms/src/builder/index.ts');
    const inspector = readRepo('packages/forms/src/builder/FieldValidationInspector.tsx');
    const stateBuilder = readRepo(
      'apps/admin-state/app/dashboard/library/[code]/form/global-form-builder-client.tsx',
    );
    const tenantDesigner = readRepo(
      'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
    );

    expect(engine).toContain('cross_field_rules');
    expect(engine).toContain('equals_any');
    expect(engine).toContain('validateCrossFieldSubmission');
    expect(builderIndex).toContain('CrossFieldRulesPanel');
    expect(inspector).toContain('Equals any of (OR)');
    expect(stateBuilder).toContain('CrossFieldRulesPanel');
    expect(tenantDesigner).toContain('CrossFieldRulesPanel');
  });

  it('Citizen PWA passes formValues into createRenderPlan for live show_if (EN-5 Phase 0/7)', () => {
    const pwaPage = readRepo('apps/citizen-pwa/app/page.tsx');
    expect(pwaPage).toContain('createRenderPlan');
    expect(pwaPage).toContain('values: formValues');
    expect(pwaPage).toContain('validateSubmission(selectedSchema, formValues)');
    expect(pwaPage).toMatch(/useMemo\([\s\S]*formValues[\s\S]*selectedSchema/);
  });

  it('packages/forms tests cover date bounds and cross-field rules (EN-5 Phase 7)', () => {
    const tests = readRepo('packages/forms/test/run-tests.mjs');
    expect(tests).toContain('validates date min and max bounds on schema and submission');
    expect(tests).toContain('show_if equals_any controls visibility with OR semantics');
    expect(tests).toContain('validates cross-field compare rules and optional when gate');
    expect(tests).toContain('show-if smoke value pattern satisfies equals_any visibility rules');
  });

  it('builder preview presets and validation-presets export equals_any helpers', () => {
    const presets = readRepo('packages/forms/src/builder/validation-presets.ts');
    const preview = readRepo('packages/forms/src/builder/preview-sample-values.ts');
    const builderIndex = readRepo('packages/forms/src/builder/index.ts');
    expect(presets).toContain("'equals_any'");
    expect(presets).toContain('buildShowIfRule');
    expect(preview).toContain('equals_any');
    expect(builderIndex).toContain('buildPreviewSampleValues');
    expect(builderIndex).toContain('describeShowIf');
  });

  it('verify:en5 script is registered', () => {
    const pkg = JSON.parse(readRepo('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:en5']).toContain('verify-en5-shared-form-builder.mjs');
  });
});
