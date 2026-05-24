import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const realmPath = join(repoRoot, 'infrastructure', 'keycloak', 'realm-export.json');

/** Unified Portal Option A — demo/staging staff hosts (Phase 4). */
const DEMO_TENANT_ORIGIN = 'https://enagartenant.demosites.co.in';
const DEMO_STATE_ORIGIN = 'https://enagarstate.demosites.co.in';

type RealmClient = {
  clientId: string;
  redirectUris?: string[];
  webOrigins?: string[];
  attributes?: Record<string, string>;
};

function clientById(clients: RealmClient[], id: string): RealmClient {
  const client = clients.find((c) => c.clientId === id);
  if (!client) {
    throw new Error(`Missing client ${id} in realm-export.json`);
  }
  return client;
}

describe('Unified Portal Option A — Keycloak realm (Phase 4)', () => {
  const realm = JSON.parse(readFileSync(realmPath, 'utf8')) as {
    clients: RealmClient[];
  };

  it('admin-tenant allows localhost and demo staging redirect URIs', () => {
    const client = clientById(realm.clients, 'admin-tenant');
    expect(client.redirectUris).toEqual(
      expect.arrayContaining(['http://localhost:3002/*', `${DEMO_TENANT_ORIGIN}/*`]),
    );
    expect(client.webOrigins).toEqual(
      expect.arrayContaining(['http://localhost:3002', DEMO_TENANT_ORIGIN]),
    );
  });

  it('admin-state allows localhost and demo staging redirect URIs', () => {
    const client = clientById(realm.clients, 'admin-state');
    expect(client.redirectUris).toEqual(
      expect.arrayContaining(['http://localhost:3003/*', `${DEMO_STATE_ORIGIN}/*`]),
    );
    expect(client.webOrigins).toEqual(
      expect.arrayContaining(['http://localhost:3003', DEMO_STATE_ORIGIN]),
    );
  });

  it('staff clients declare post-logout redirect to /login on each origin', () => {
    const tenant = clientById(realm.clients, 'admin-tenant');
    const state = clientById(realm.clients, 'admin-state');

    expect(tenant.attributes?.['post.logout.redirect.uris']).toContain(
      'http://localhost:3002/login',
    );
    expect(tenant.attributes?.['post.logout.redirect.uris']).toContain(
      `${DEMO_TENANT_ORIGIN}/login`,
    );
    expect(state.attributes?.['post.logout.redirect.uris']).toContain(
      'http://localhost:3003/login',
    );
    expect(state.attributes?.['post.logout.redirect.uris']).toContain(`${DEMO_STATE_ORIGIN}/login`);
  });

  it('keeps localhost dev URIs alongside demo staging (transition)', () => {
    for (const id of ['admin-tenant', 'admin-state'] as const) {
      const client = clientById(realm.clients, id);
      expect(client.redirectUris?.some((uri) => uri.startsWith('http://localhost:'))).toBe(true);
    }
  });
});
