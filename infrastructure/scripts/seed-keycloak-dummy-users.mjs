#!/usr/bin/env node
/**
 * Idempotent bootstrap: dummy Keycloak users for local/staging QA.
 *
 * Prerequisites:
 *   - Keycloak up (e.g. `pnpm infra:up`), realm `enagar` imported
 *   - Env: credentials from infrastructure/.env (see below)
 *
 * Keep MUNICIPAL_TENANTS in sync with apps/api/src/modules/tenants/tenant.seed.ts
 * (exclude WBPORTAL — portal-only).
 *
 * MFA: tenant_admin / state_admin require TOTP enrolment before the API accepts
 * their JWT (amr/acr). Enrol via Keycloak Account Console after first login, or use
 * only clerk-level users for unattended API smoke tests.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Array<{ id: string; code: string }>} */
const MUNICIPAL_TENANTS = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'KMC' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'HMC' },
  { id: '33333333-3333-4333-8333-333333333333', code: 'CMC' },
  { id: '44444444-4444-4444-8444-444444444444', code: 'BMC' },
  { id: '55555555-5555-4555-8555-555555555555', code: 'SMC' },
  { id: '66666666-6666-4666-8666-666666666666', code: 'AMC' },
  { id: '77777777-7777-4777-8777-777777777777', code: 'DMC' },
  { id: '88888888-8888-4888-8888-888888888888', code: 'SDDM' },
];

const PORTAL_TENANT = {
  id: '99999999-9999-4999-8999-999999999999',
  code: 'WBPORTAL',
};

const REALM = process.env.KEYCLOAK_REALM ?? 'enagar';

function loadInfrastructureEnvOptional() {
  const envPath = join(__dirname, '..', '.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env) || process.env[k] === '') {
        process.env[k] = v;
      }
    }
  } catch {
    /* no infrastructure/.env */
  }
}

loadInfrastructureEnvOptional();

const KEYCLOAK_BASE = (process.env.KEYCLOAK_BASE ?? process.env.KEYCLOAK_ISSUER_URL ?? '')
  .replace(/\/realms\/[^/]+\/?$/i, '')
  .replace(/\/$/, '');

const KEYCLOAK_ADMIN = process.env.KEYCLOAK_ADMIN;
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD;

const PASSWORD =
  process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe';

if (!KEYCLOAK_BASE || !KEYCLOAK_ADMIN || !KEYCLOAK_ADMIN_PASSWORD) {
  console.error(
    'Missing env. Set KEYCLOAK_BASE or KEYCLOAK_ISSUER_URL (e.g. http://localhost:8080), KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD.',
  );
  console.error('Tip: copy infrastructure/.env from .env.example and run from repo root.');
  process.exit(1);
}

async function adminToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: KEYCLOAK_ADMIN,
    password: KEYCLOAK_ADMIN_PASSWORD,
  });
  const res = await fetch(
    `${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Admin token failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * @param {string} token
 * @param {string} method
 * @param {string} path
 * @param {unknown} [jsonBody]
 */
async function adminReq(token, method, path, jsonBody = undefined) {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}${path}`;
  /** @type {RequestInit} */
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (jsonBody !== undefined) {
    opts.headers = {
      ...opts.headers,
      'Content-Type': 'application/json',
    };
    opts.body = JSON.stringify(jsonBody);
  }
  return fetch(url, opts);
}

async function ensureMfaTokenMappers(token) {
  const scopesRes = await adminReq(token, 'GET', '/client-scopes');
  if (!scopesRes.ok) {
    throw new Error(`List client scopes failed: ${scopesRes.status} ${await scopesRes.text()}`);
  }
  /** @type {Array<{ id: string; name: string }>} */
  const scopes = await scopesRes.json();
  const tenantClaims = scopes.find((scope) => scope.name === 'tenant-claims');
  if (!tenantClaims) {
    throw new Error('Missing client scope "tenant-claims" — import realm-export first.');
  }

  const mappersRes = await adminReq(
    token,
    'GET',
    `/client-scopes/${tenantClaims.id}/protocol-mappers/models`,
  );
  if (!mappersRes.ok) {
    throw new Error(`List tenant-claims mappers failed: ${mappersRes.status}`);
  }
  /** @type {Array<{ name: string; protocolMapper: string }>} */
  const existing = await mappersRes.json();
  const have = new Set(existing.map((mapper) => mapper.protocolMapper));

  const toCreate = [
    {
      name: 'amr',
      protocolMapper: 'oidc-amr-mapper',
      config: {
        'access.token.claim': 'true',
        'id.token.claim': 'true',
        'userinfo.token.claim': 'true',
      },
    },
    {
      name: 'acr',
      protocolMapper: 'oidc-acr-mapper',
      config: {
        'access.token.claim': 'true',
        'id.token.claim': 'true',
        'userinfo.token.claim': 'true',
        'introspection.token.claim': 'true',
      },
    },
  ];

  for (const mapper of toCreate) {
    if (have.has(mapper.protocolMapper)) {
      continue;
    }
    const create = await adminReq(
      token,
      'POST',
      `/client-scopes/${tenantClaims.id}/protocol-mappers/models`,
      {
        name: mapper.name,
        protocol: 'openid-connect',
        protocolMapper: mapper.protocolMapper,
        config: mapper.config,
      },
    );
    if (!create.ok && create.status !== 409) {
      throw new Error(
        `Create mapper ${mapper.name}: ${create.status} ${await create.text()}`,
      );
    }
    console.info(`Added tenant-claims mapper: ${mapper.name}`);
  }
}

async function listRealmRoles(token) {
  const res = await adminReq(token, 'GET', '/roles');
  if (!res.ok) {
    throw new Error(`List roles failed: ${res.status} ${await res.text()}`);
  }
  /** @type {Array<{ id: string; name: string }>} */
  return res.json();
}

/**
 * Keycloak 25's declarative user profile drops unmanaged custom attributes.
 * Declare the tenant attributes before user upsert so JWT mappers can emit them.
 *
 * @param {string} token
 */
async function ensureTenantUserProfileAttributes(token) {
  const res = await adminReq(token, 'GET', '/users/profile');
  if (!res.ok) {
    throw new Error(`Read user profile failed: ${res.status} ${await res.text()}`);
  }

  const profile = await res.json();
  const attributes = Array.isArray(profile.attributes) ? profile.attributes : [];
  const byName = new Map(attributes.map((attr) => [attr.name, attr]));
  const required = ['tenant_id', 'tenant_code', 'ward_id'];
  let changed = false;

  for (const name of required) {
    if (byName.has(name)) {
      continue;
    }
    attributes.push({
      name,
      displayName: name,
      permissions: {
        view: ['admin', 'user'],
        edit: ['admin'],
      },
      multivalued: false,
    });
    changed = true;
  }

  if (!changed) {
    return;
  }

  const update = await adminReq(token, 'PUT', '/users/profile', {
    ...profile,
    attributes,
  });
  if (!update.ok && update.status !== 204) {
    throw new Error(`Update user profile failed: ${update.status} ${await update.text()}`);
  }
}

/** @returns {Promise<string | null>} */
async function findUserIdByUsername(token, username) {
  const enc = encodeURIComponent(username);
  const res = await adminReq(token, 'GET', `/users?username=${enc}&exact=true`);
  if (!res.ok) {
    throw new Error(`Find user failed: ${res.status}`);
  }
  /** @type {Array<{ id: string }>} */
  const rows = await res.json();
  return rows.length ? rows[0].id : null;
}

/**
 * @param {string} token
 * @param {{ username: string; tenant_id: string; tenant_code: string; roleNames: string[] }} spec
 */
async function upsertUser(token, spec, roleCatalog) {
  const { username, tenant_id, tenant_code, roleNames } = spec;
  /** @type {Record<string, { id: string; name: string }>} */
  const byName = {};
  for (const r of roleCatalog) {
    byName[r.name] = r;
  }

  const payload = {
    username,
    email: `${username}@dummy.enagar.local`,
    enabled: true,
    emailVerified: true,
    firstName: 'Dummy',
    lastName: username,
    attributes: {
      tenant_id: [tenant_id],
      tenant_code: [tenant_code],
    },
    credentials: [
      {
        type: 'password',
        value: PASSWORD,
        temporary: false,
      },
    ],
  };

  let userId = await findUserIdByUsername(token, username);

  const { credentials: _c, ...updateWithoutPassword } = payload;

  if (userId) {
    const upt = await adminReq(token, 'PUT', `/users/${userId}`, updateWithoutPassword);
    if (!upt.ok && upt.status !== 204) {
      throw new Error(`Update user ${username}: ${upt.status} ${await upt.text()}`);
    }
  } else {
    const cre = await adminReq(token, 'POST', '/users', payload);
    if (cre.status === 409) {
      userId = await findUserIdByUsername(token, username);
    } else if (cre.status !== 201) {
      throw new Error(
        `Create user ${username}: ${cre.status} ${await cre.text()}`,
      );
    } else {
      const loc = cre.headers.get('Location');
      if (loc) {
        userId = loc.replace(/\\/g, '/').split('/').pop() ?? null;
      }
      if (!userId) {
        userId = await findUserIdByUsername(token, username);
      }
    }
  }

  if (!userId) {
    throw new Error(`Could not resolve user id for ${username}`);
  }

  const pwdRes = await adminReq(token, 'PUT', `/users/${userId}/reset-password`, {
    type: 'password',
    value: PASSWORD,
    temporary: false,
  });
  if (!pwdRes.ok && pwdRes.status !== 204) {
    console.warn(`Password reset for ${username}: ${pwdRes.status} (may already match)`);
  }

  /** @type {Array<{ id: string; name: string }>} */
  let existing = [];
  const mapRes = await adminReq(token, 'GET', `/users/${userId}/role-mappings/realm`);
  if (mapRes.ok) {
    existing = await mapRes.json();
  }
  const toRm = existing.filter((r) => roleCatalog.some((rc) => rc.name === r.name));
  for (const r of toRm) {
    await adminReq(token, 'DELETE', `/users/${userId}/role-mappings/realm`, [r]);
  }

  /** @type {Array<{ id: string; name: string }>} */
  const toAdd = [];
  for (const name of roleNames) {
    const r = byName[name];
    if (!r) throw new Error(`Unknown realm role "${name}" in catalog`);
    toAdd.push({ id: r.id, name: r.name });
  }
  const addRes = await adminReq(
    token,
    'POST',
    `/users/${userId}/role-mappings/realm`,
    toAdd,
  );
  if (!addRes.ok) {
    throw new Error(
      `Role map ${username}: ${addRes.status} ${await addRes.text()}`,
    );
  }

  console.log(`OK ${username} -> ${roleNames.join(',')}`);
}

function slug(role) {
  return role.replace(/_/g, '-');
}

async function main() {
  console.info(`Keycloak: ${KEYCLOAK_BASE}`);
  console.info(`Realm: ${REALM}`);
  console.info(`Dummy password for all scripted users: ${PASSWORD}`);
  const token = await adminToken();
  await ensureTenantUserProfileAttributes(token);
  await ensureMfaTokenMappers(token);

  /** @type {Array<{ id: string; name: string }>} */
  const roleCatalog = await listRealmRoles(token);
  /** @type {Set<string>} */
  const realmRoleNames = new Set(roleCatalog.map((r) => r.name));

  const requiredRealmRoles = [
    'citizen',
    'tenant_clerk',
    'municipality_clerk',
    'municipality_admin',
    'tenant_admin',
    'state_admin',
  ];
  for (const n of requiredRealmRoles) {
    if (!realmRoleNames.has(n)) {
      console.error(`Realm "${REALM}" is missing role "${n}". Import realm-export first.`);
      process.exit(1);
    }
  }

  await upsertUser(
    token,
    {
      username: 'portal-citizen-dummy',
      tenant_id: PORTAL_TENANT.id,
      tenant_code: PORTAL_TENANT.code,
      roleNames: ['citizen'],
    },
    roleCatalog,
  );

  /** @typedef {'tenant_clerk' | 'municipality_clerk' | 'municipality_admin' | 'tenant_admin' | 'state_admin'} OpRole */

  /** @type {OpRole[]} */
  const municipalRoles = [
    'tenant_clerk',
    'municipality_clerk',
    'municipality_admin',
    'tenant_admin',
    'state_admin',
  ];

  for (const t of MUNICIPAL_TENANTS) {
    const code = t.code.toLowerCase();
    for (const role of municipalRoles) {
      const username = `${code}-${slug(role)}-dummy`;
      await upsertUser(
        token,
        {
          username,
          tenant_id: t.id,
          tenant_code: t.code,
          roleNames: [role],
        },
        roleCatalog,
      );
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  console.info('\nDone. User inventory (examples):');
  console.info('- portal-citizen-dummy (citizen / WBPORTAL)');
  console.info(`- kmc-tenant-clerk-dummy … per-ULB ${municipalRoles.join(', ')}`);
  console.info(
    '\nEnrol MFA for tenant_admin/state_admin dummy users before API admin smoke tests.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
