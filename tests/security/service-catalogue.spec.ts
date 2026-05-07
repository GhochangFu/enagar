import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');
const servicesControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'services',
  'services.controller.ts',
);
const seedPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'services',
  'service-catalogue.seed.ts',
);

describe('Sprint 2.1 service catalogue contract', () => {
  const appModule = readFileSync(appModulePath, 'utf8');
  const controller = readFileSync(servicesControllerPath, 'utf8');
  const seed = readFileSync(seedPath, 'utf8');

  it('registers the service catalogue API module', () => {
    expect(appModule).toContain('ServicesModule');
  });

  it('exposes citizen-safe catalogue read routes', () => {
    for (const route of [
      "Get('categories')",
      "Get('revenue-heads')",
      "Get('global')",
      "Get('tenants/:tenantCode')",
      "Get('tenants/:tenantCode/:serviceCode')",
    ]) {
      expect(controller).toContain(route);
    }
  });

  it('documents tenant override semantics in executable seed fixtures', () => {
    expect(seed).toContain('tenantServiceOverrides');
    expect(seed).toContain("'tenant_override'");
    expect(seed).toContain("'tenant_only'");
    expect(seed).toContain('pushes_to_digilocker: service.pushes_to_digilocker');
  });

  it('includes Sprint 2.1 priority service shells', () => {
    for (const serviceCode of [
      'birth-cert',
      'prop-tax',
      'trade-licence',
      'community-hall',
      'sanitation-grievance',
      'rti',
    ]) {
      expect(seed).toContain(serviceCode);
    }
  });
});
