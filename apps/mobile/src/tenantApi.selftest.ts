/**
 * Lightweight regression harness (deterministic `fetch` doubles; avoids `jest-cli` / transitive `locate-path` breakage on Node 22 in this hoist graph).
 */
import assert from 'node:assert/strict';

import { fetchPublicTenants, type TenantListItem } from './tenantApi';

const recordedUrls: string[] = [];

function stubFetch(response: Partial<Response>): void {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    recordedUrls.push(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );

    return response as Response;
  }) as typeof fetch;
}

async function main(): Promise<void> {
  const sampleRow: TenantListItem = {
    id: '1',
    code: 'KMC',
    name: 'Kolkata Municipal Corporation',
    district: 'Kolkata',
    ward_count: 144,
    theme_color: '#0F4C75',
    logo_url: null,
    languages_enabled: ['en', 'bn'],
  };

  recordedUrls.length = 0;

  stubFetch({
    ok: true,
    status: 200,
    json: async () => [sampleRow],
  } as Pick<Response, 'ok' | 'status' | 'json'>);

  assert.deepStrictEqual(await fetchPublicTenants('http://localhost:3001/api'), [sampleRow]);
  assert.strictEqual(recordedUrls[0], 'http://localhost:3001/api/tenants');

  recordedUrls.length = 0;
  stubFetch({
    ok: true,
    status: 200,
    json: async () => [],
  } as Pick<Response, 'ok' | 'status' | 'json'>);

  await fetchPublicTenants('http://localhost:3001/api/');
  assert.strictEqual(recordedUrls[0], 'http://localhost:3001/api/tenants');

  stubFetch({
    ok: false,
    status: 503,
    json: async () => ({}),
  } as Pick<Response, 'ok' | 'status' | 'json'>);

  await assert.rejects(fetchPublicTenants('http://localhost:3001/api'), /\(503\)/);

  stubFetch({
    ok: true,
    status: 200,
    json: async () => [{ id: 'x' }, null, 'oops'],
  } as Pick<Response, 'ok' | 'status' | 'json'>);

  assert.deepStrictEqual(await fetchPublicTenants('http://localhost:3001/api'), []);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
