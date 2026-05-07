import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const formSpecPath = join(repoRoot, 'docs', 'form-schema.md');
const formsRuntimePath = join(repoRoot, 'packages', 'forms', 'src', 'index.ts');
const formsFixturesPath = join(repoRoot, 'packages', 'forms', 'src', 'fixtures.ts');
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');
const mobileIndexPath = join(repoRoot, 'apps', 'mobile', 'src', 'index.ts');

describe('Sprint 2.2 form-schema contract', () => {
  const spec = readFileSync(formSpecPath, 'utf8');
  const runtime = readFileSync(formsRuntimePath, 'utf8');
  const fixtures = readFileSync(formsFixturesPath, 'utf8');
  const pwaPage = readFileSync(pwaPagePath, 'utf8');
  const mobileIndex = readFileSync(mobileIndexPath, 'utf8');

  it('documents every v1 field type and snapshot semantics', () => {
    for (const fieldType of [
      'text',
      'number',
      'date',
      'radio',
      'select',
      'multiselect',
      'textarea',
      'file',
      'section',
    ]) {
      expect(spec).toContain(`\`${fieldType}\``);
    }
    expect(spec).toContain('service_form_versions');
    expect(spec).toContain('in-flight applications');
  });

  it('exports one shared runtime for schema validation, render plans, and JSON-Schema', () => {
    for (const symbol of [
      'validateFormSchema',
      'validateSubmission',
      'createRenderPlan',
      'exportToJsonSchema',
    ]) {
      expect(runtime).toContain(`function ${symbol}`);
    }
  });

  it('keeps priority service form fixtures in the shared package', () => {
    for (const serviceCode of [
      'birth-cert',
      'trade-licence',
      'prop-tax',
      'community-hall',
      'rti',
    ]) {
      expect(fixtures).toContain(serviceCode);
    }
  });

  it('keeps service-specific form UI out of the PWA and native shell during Sprint 2.2', () => {
    for (const serviceSpecificToken of [
      'BirthCertificateForm',
      'TradeLicenceForm',
      'PropertyTaxForm',
      'CommunityHallForm',
    ]) {
      expect(pwaPage).not.toContain(serviceSpecificToken);
      expect(mobileIndex).not.toContain(serviceSpecificToken);
    }
  });
});
