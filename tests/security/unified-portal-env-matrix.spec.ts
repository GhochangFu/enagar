import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const hostsPath = join(repoRoot, 'infrastructure', 'unified-portal', 'demo-hosts.json');
const portalConfigPath = join(repoRoot, 'infrastructure', 'portal-hub', 'config.js');

type DemoHosts = {
  hubOrigin: string;
  citizenOrigin: string;
  tenantOrigin: string;
  stateOrigin: string;
  apiBaseUrl: string;
  keycloakIssuerUrl: string;
  corsOrigins: string[];
};

function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function expectContains(file: string, ...needles: string[]) {
  const text = readText(file);
  for (const needle of needles) {
    expect(text).toContain(needle);
  }
}

describe('Unified Portal Option A — env matrix (Phase 3)', () => {
  const hosts = JSON.parse(readFileSync(hostsPath, 'utf8')) as DemoHosts;

  it('demo-hosts.json defines the six public demo origins', () => {
    expect(hosts.hubOrigin).toBe('https://enagar.demosites.co.in');
    expect(hosts.citizenOrigin).toBe('https://enagarcitizen.demosites.co.in');
    expect(hosts.tenantOrigin).toBe('https://enagartenant.demosites.co.in');
    expect(hosts.stateOrigin).toBe('https://enagarstate.demosites.co.in');
    expect(hosts.apiBaseUrl).toBe('https://enagarapi.demosites.co.in/api');
    expect(hosts.keycloakIssuerUrl).toBe('https://enagarauth.demosites.co.in/realms/enagar');
    expect(hosts.corsOrigins).toEqual([hosts.citizenOrigin, hosts.tenantOrigin, hosts.stateOrigin]);
  });

  it('citizen .env.production.example matches demo-hosts.json', () => {
    expectContains(
      'apps/citizen-pwa/.env.production.example',
      `NEXT_PUBLIC_API_BASE_URL=${hosts.apiBaseUrl}`,
      'NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION=true',
    );
  });

  it('tenant .env.production.example matches demo-hosts.json', () => {
    expectContains(
      'apps/admin-tenant/.env.production.example',
      `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL=${hosts.keycloakIssuerUrl}`,
      'NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=admin-tenant',
      `NEXT_PUBLIC_ADMIN_APP_ORIGIN=${hosts.tenantOrigin}`,
      `NEXT_PUBLIC_API_BASE_URL=${hosts.apiBaseUrl}`,
    );
  });

  it('state .env.production.example matches demo-hosts.json', () => {
    expectContains(
      'apps/admin-state/.env.production.example',
      `NEXT_PUBLIC_KEYCLOAK_ISSUER_URL=${hosts.keycloakIssuerUrl}`,
      'NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=admin-state',
      `NEXT_PUBLIC_STATE_APP_ORIGIN=${hosts.stateOrigin}`,
      `NEXT_PUBLIC_API_BASE_URL=${hosts.apiBaseUrl}`,
    );
  });

  it('infrastructure .env.production.example declares demo CORS and Keycloak issuer', () => {
    const corsLine = hosts.corsOrigins.join(',');
    expectContains(
      'infrastructure/.env.production.example',
      `CORS_ORIGIN=${corsLine}`,
      `KEYCLOAK_ISSUER_URL=${hosts.keycloakIssuerUrl}`,
      'ALLOW_CLIENT_SCAN_SIMULATION=true',
      'DEV_AUTH_ENABLED=false',
    );
  });

  it('portal hub config.js uses demo subdomains for non-local hosts', () => {
    const config = readFileSync(portalConfigPath, 'utf8');
    expect(config).toContain(hosts.citizenOrigin);
    expect(config).toContain(`${hosts.tenantOrigin}/login`);
    expect(config).toContain(`${hosts.stateOrigin}/login`);
    expect(config).toContain('http://localhost:3000');
  });

  it('env matrix runbook references demo-hosts.json and production examples', () => {
    expectContains(
      'docs/runbooks/unified-portal-env-matrix.md',
      'infrastructure/unified-portal/demo-hosts.json',
      '.env.production.example',
      'build:portal-demo',
    );
  });
});
