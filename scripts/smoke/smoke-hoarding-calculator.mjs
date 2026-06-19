/**
 * Sprint 8.5B — hoarding citizen quote smoke.
 * Prereq: API :3001, DB seeded with KMC hoarding matrix (8.5A).
 * Usage: node scripts/smoke/smoke-hoarding-calculator.mjs
 */
import {
  API,
  TENANT,
  api,
  assertOk,
  citizenToken,
  fail,
  loadInfraEnv,
  log,
} from './lib/hoarding-smoke-lib.mjs';

loadInfraEnv();

async function main() {
  const mobile = '9876500099';
  const citizenTok = await citizenToken(mobile);
  log('hoarding-calc', 'auth', 'citizen dev OTP');

  const { res: ctxRes, json: ctx } = await api(
    'GET',
    `/citizen/advertising/hoarding/context?tenant_code=${TENANT}`,
    citizenTok,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('hoarding-calc', 'context', ctxRes.status, JSON.stringify(ctx));
  if (!Array.isArray(ctx.wards) || ctx.wards.length === 0) {
    fail('hoarding-calc', 'Expected at least one ward in context');
  }
  log('hoarding-calc', 'context', `${ctx.wards.length} wards`);

  const { res: quoteRes, json: quote } = await api(
    'POST',
    '/citizen/advertising/hoarding/quote',
    citizenTok,
    {
      tenant_code: TENANT,
      ward_code: '12',
      width_ft: 10,
      height_ft: 8,
      duration_months: 3,
    },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk('hoarding-calc', 'quote', quoteRes.status, JSON.stringify(quote));

  const expectedTax = 80 * 3 * 7500;
  if (quote.tax_paise !== expectedTax) {
    fail('hoarding-calc', `Expected tax_paise ${expectedTax}, got ${quote.tax_paise}`);
  }
  if (!quote.ward_matched) {
    fail('hoarding-calc', 'Expected ward_matched true for ward 12');
  }
  if (!quote.quoted_at) {
    fail('hoarding-calc', 'Expected quoted_at on citizen quote');
  }

  log('hoarding-calc', 'quote', `ward 12 → ₹${(quote.tax_paise / 100).toFixed(2)} (${API})`);
  console.log('[hoarding-calc] OK');
}

main().catch((error) => {
  fail('hoarding-calc', error instanceof Error ? error.message : String(error));
});
