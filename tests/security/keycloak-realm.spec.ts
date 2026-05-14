import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const realmPath = join(repoRoot, 'infrastructure', 'keycloak', 'realm-export.json');
const composePath = join(repoRoot, 'infrastructure', 'docker-compose.yml');

const requiredRoles = ['citizen', 'tenant_clerk', 'tenant_admin', 'state_admin'];
const requiredClients = [
  'enagar-api',
  'citizen-pwa',
  'citizen-rn',
  'admin-tenant',
  'admin-state',
  'staff-mobile',
];
const requiredTenantClaims = [
  'tenant_id',
  'tenant_code',
  'role',
  'ward_id',
  'audience-enagar-api',
  'sub-username',
];

describe('Sprint 1.2 Keycloak realm contract', () => {
  const realm = JSON.parse(readFileSync(realmPath, 'utf8')) as {
    realm: string;
    enabled: boolean;
    userProfileEnabled?: boolean;
    userProfile?: { unmanagedAttributePolicy?: string };
    roles: { realm: Array<{ name: string; attributes?: Record<string, string[]> }> };
    clients: Array<{
      clientId: string;
      bearerOnly?: boolean;
      publicClient?: boolean;
      directAccessGrantsEnabled?: boolean;
      attributes?: Record<string, string>;
      defaultClientScopes?: string[];
    }>;
    clientScopes: Array<{
      name: string;
      protocolMappers?: Array<{ name: string; config?: Record<string, string> }>;
    }>;
  };

  it('defines the single global enagar realm', () => {
    expect(realm.realm).toBe('enagar');
    expect(realm.enabled).toBe(true);
  });

  it('uses declarative user profile so admins can persist tenant_* operator attributes', () => {
    expect(realm.userProfileEnabled).toBe(true);
    expect(realm.userProfile?.unmanagedAttributePolicy).toBe('ADMIN_EDIT');
  });

  it('contains the Sprint 1.2 realm roles', () => {
    expect(realm.roles.realm.map((role) => role.name)).toEqual(
      expect.arrayContaining(requiredRoles),
    );
  });

  it('marks admin roles as OTP-required for MFA enforcement', () => {
    for (const roleName of ['tenant_admin', 'state_admin']) {
      const role = realm.roles.realm.find((candidate) => candidate.name === roleName);

      expect(role?.attributes?.otp_required).toEqual(['true']);
    }
  });

  it('contains one OIDC client for each app plus the API audience', () => {
    expect(realm.clients.map((client) => client.clientId)).toEqual(
      expect.arrayContaining(requiredClients),
    );
    expect(realm.clients.find((client) => client.clientId === 'enagar-api')?.bearerOnly).toBe(true);
    expect(
      realm.clients.find((client) => client.clientId === 'admin-tenant')?.directAccessGrantsEnabled,
    ).toBe(true);
  });

  it('requires PKCE for public user-facing clients', () => {
    const publicClients = realm.clients.filter((client) => client.publicClient);

    expect(publicClients).not.toHaveLength(0);
    for (const client of publicClients) {
      expect(client.attributes?.['pkce.code.challenge.method']).toBe('S256');
      expect(client.defaultClientScopes).toContain('tenant-claims');
    }
  });

  it('maps tenant claims into access tokens', () => {
    const tenantScope = realm.clientScopes.find((scope) => scope.name === 'tenant-claims');
    const mappers = tenantScope?.protocolMappers ?? [];

    expect(mappers.map((mapper) => mapper.name)).toEqual(
      expect.arrayContaining(requiredTenantClaims),
    );
    for (const mapper of mappers) {
      expect(mapper.config?.['access.token.claim']).toBe('true');
    }
  });

  it('imports the realm in local Keycloak compose startup', () => {
    const compose = readFileSync(composePath, 'utf8');

    expect(compose).toContain('--import-realm');
    expect(compose).toContain('./keycloak/realm-export.json');
  });
});
