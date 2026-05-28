import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

describe('EN-4 — global form templates and onboarding forms', () => {
  it('seed backfills global_services.form_schema from priorityServiceFormSchemas', () => {
    const seed = readFileSync(join(repoRoot, 'apps', 'api', 'prisma', 'seed.ts'), 'utf8');
    expect(seed).toContain('publishedFormSchemaByServiceCode.get(service.code)');
    expect(seed).toContain('formSchema: seededFormSchema');
    expect(seed).toContain("service_code: 'sanitation-grievance'");
  });

  it('tenant-service-onboarding-forms module exports EN-4 helpers', () => {
    const modulePath = join(
      repoRoot,
      'apps',
      'api',
      'src',
      'modules',
      'admin-state',
      'tenant-service-onboarding-forms.ts',
    );
    const source = readFileSync(modulePath, 'utf8');
    expect(source).toContain('export function isUsableFormSchema');
    expect(source).toContain('export function resolveOnboardingFormSchema');
    expect(source).toContain('export function classifyOnboardingForm');
  });

  it('global library list includes form_schema and has_usable_form_schema', () => {
    const service = readFileSync(
      join(repoRoot, 'apps', 'api', 'src', 'modules', 'admin-state', 'admin-state.service.ts'),
      'utf8',
    );
    expect(service).toContain('has_usable_form_schema: isUsableFormSchema(row.formSchema)');
    expect(service).toContain('forms_from_global');
    expect(service).toContain('forms_stubbed');
  });

  it('verify:en4 script is registered', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['verify:en4']).toContain('verify-en4-global-onboarding-forms.mjs');
  });

  it('State library UI surfaces form template editing', () => {
    const forms = readFileSync(
      join(repoRoot, 'apps', 'admin-state', 'lib', 'state-dashboard-forms.ts'),
      'utf8',
    );
    expect(forms).toContain('form_schema_json');
    const sections = readFileSync(
      join(repoRoot, 'apps', 'admin-state', 'components', 'state-config-sections.tsx'),
      'utf8',
    );
    expect(sections).toContain('Citizen apply form');
    expect(sections).toContain('Form template (JSON)');
  });

  it('tenant admin can resync a linked service form draft from the global template', () => {
    const controller = readFileSync(
      join(repoRoot, 'apps', 'api', 'src', 'modules', 'admin-tenant', 'admin-tenant.controller.ts'),
      'utf8',
    );
    const service = readFileSync(
      join(repoRoot, 'apps', 'api', 'src', 'modules', 'admin-tenant', 'admin-tenant.service.ts'),
      'utf8',
    );
    const designer = readFileSync(
      join(
        repoRoot,
        'apps',
        'admin-tenant',
        'app',
        'dashboard',
        'services',
        '[serviceId]',
        'service-designer-client.tsx',
      ),
      'utf8',
    );
    expect(controller).toContain("@Post('services/:serviceId/form-draft/resync-from-global')");
    expect(service).toContain('resyncFormDraftFromGlobal');
    expect(service).toContain('global_form_template');
    expect(service).toContain('resolveOnboardingFormSchema');
    expect(designer).toContain('form-draft/resync-from-global');
    expect(designer).toContain('Load State template');
  });
});
