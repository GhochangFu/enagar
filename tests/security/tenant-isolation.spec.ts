/**
 * Tenant-isolation contract test (Phase 0 placeholder).
 *
 * The non-negotiable promise of this platform: a request authenticated
 * as Tenant A MUST NEVER see Tenant B's data — at the API layer, the
 * Prisma layer, or the database layer (RLS).
 *
 * Phase 1 fills this in with the real harness:
 *   1. Seed two tenants (A, B) with distinct citizens / applications.
 *   2. Issue requests using A's JWT, attempt to read B's resource by ID.
 *   3. Assert 404 (not 403 — we don't even acknowledge existence).
 *   4. Repeat for every domain table touched by every controller.
 *   5. Bypass the API: directly run a SELECT with the wrong tenant_id
 *      via the Prisma client — assert RLS rejects it.
 *
 * This spec is wired into `pnpm run test:security` and gated as a
 * required CI check before any PR can merge.
 */

describe.skip('tenant isolation (Phase 1+)', () => {
  it('blocks cross-tenant reads via API', () => {
    // Implemented in Sprint 1.3 once tenants + citizens exist.
  });

  it('blocks cross-tenant reads at the Prisma layer', () => {
    // Implemented in Sprint 1.3 once Prisma + RLS context middleware exist.
  });

  it('blocks cross-tenant reads at the Postgres RLS layer', () => {
    // Implemented in Sprint 1.3 with a direct pg client + wrong tenant_id.
  });
});

it('phase-0 placeholder is present', () => {
  expect(true).toBe(true);
});
