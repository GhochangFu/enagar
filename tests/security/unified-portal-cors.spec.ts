import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const demoHostsPath = join(repoRoot, 'infrastructure', 'unified-portal', 'demo-hosts.json');
const corsOriginsModulePath = join(
  repoRoot,
  'infrastructure',
  'unified-portal',
  'cors-origins.mjs',
);
const configureMinioPath = join(repoRoot, 'infrastructure', 'scripts', 'configure-minio-cors.mjs');
const composePath = join(repoRoot, 'infrastructure', 'docker-compose.yml');
const demoOverridePath = join(
  repoRoot,
  'infrastructure',
  'docker-compose.unified-portal-demo.override.example.yml',
);

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('Unified Portal Option A — API & MinIO CORS (Phase 5)', () => {
  const hosts = JSON.parse(readFileSync(demoHostsPath, 'utf8')) as {
    citizenOrigin: string;
    tenantOrigin: string;
    stateOrigin: string;
    corsOrigins: string[];
  };
  const corsLine = hosts.corsOrigins.join(',');

  it('demo-hosts.json lists three portal HTTPS origins for API CORS', () => {
    expect(hosts.corsOrigins).toEqual([hosts.citizenOrigin, hosts.tenantOrigin, hosts.stateOrigin]);
  });

  it('docker-compose MinIO service reads MINIO_API_CORS_ALLOW_ORIGIN from env', () => {
    const compose = readFileSync(composePath, 'utf8');
    expect(compose).toContain('MINIO_API_CORS_ALLOW_ORIGIN: ${MINIO_API_CORS_ALLOW_ORIGIN:-');
    expect(compose).toContain('http://localhost:3000');
  });

  it('configure-minio-cors.mjs uses shared cors-origins resolver', () => {
    const script = readFileSync(configureMinioPath, 'utf8');
    expect(script).toContain("from '../unified-portal/cors-origins.mjs'");
    expect(script).toContain('resolveMinioCorsOrigins');
  });

  it('cors-origins.mjs includes demo citizen when env unset', () => {
    const moduleSrc = readFileSync(corsOriginsModulePath, 'utf8');
    expect(moduleSrc).toContain('loadDemoHosts');
    expect(moduleSrc).toContain('citizenOrigin');
  });

  it('infrastructure .env.production.example declares API + MinIO demo CORS', () => {
    const prod = readText('infrastructure/.env.production.example');
    expect(prod).toContain(`CORS_ORIGIN=${corsLine}`);
    expect(prod).toContain(`MINIO_API_CORS_ALLOW_ORIGIN=${corsLine}`);
    expect(prod).toContain('ALLOW_CLIENT_SCAN_SIMULATION=true');
  });

  it('demo docker-compose override example sets MinIO CORS for all portal subdomains', () => {
    const override = readFileSync(demoOverridePath, 'utf8');
    expect(override).toContain('MINIO_API_CORS_ALLOW_ORIGIN');
    for (const origin of hosts.corsOrigins) {
      expect(override).toContain(origin);
    }
  });

  it('API main.ts uses explicit CORS_ORIGIN (no wildcard)', () => {
    const main = readText('apps/api/src/main.ts');
    expect(main).toContain('CORS_ORIGIN');
    expect(main).not.toContain('origin: true');
  });

  it('Phase 5 runbook documents API vs MinIO CORS and scan simulation pilot', () => {
    const runbook = readText('docs/runbooks/unified-portal-cors-phase5.md');
    expect(runbook).toContain('CORS_ORIGIN');
    expect(runbook).toContain('MINIO_API_CORS_ALLOW_ORIGIN');
    expect(runbook).toContain('OBJECT_STORAGE_DISABLED=true');
    expect(runbook).toContain('ALLOW_CLIENT_SCAN_SIMULATION=true');
  });
});
