/**
 * Sprint 8.5C — LED board deferred booking (ad-led, hoarding-style workflow).
 * Prereq: API :3001, migrate + seed (KMC LED boards), Keycloak users seeded.
 * Usage: node scripts/smoke/smoke-ad-led-booking.mjs
 */
import {
  ADMIN_USER,
  CLERK_USER,
  TENANT,
  api,
  assertOk,
  assignHoardingDesignations,
  citizenToken,
  deskTransition,
  fail,
  fetchDeskDetail,
  kcToken,
  loadInfraEnv,
  log,
  publishHoardingPilot,
  uploadCleanDocument,
} from './lib/hoarding-smoke-lib.mjs';

loadInfraEnv();

const SERVICE_CODE = 'ad-led';
const PREFIX = 'ad-led';

function nextWeekdaySlotRange() {
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const from = new Date(cursor);
  const to = new Date(cursor);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildSnapshot(assetCode, startsAt, endsAt, rentPaise, depositPaise) {
  return JSON.stringify({
    asset_code: assetCode,
    starts_at: startsAt,
    ends_at: endsAt,
    rent_paise: rentPaise,
    deposit_paise: depositPaise,
    total_paise: rentPaise + depositPaise,
    quoted_at: new Date().toISOString(),
  });
}

async function main() {
  const mobile = '9876500088';
  const scopeHeaders = { 'x-enagar-tenant-code': TENANT };
  const citizenTok = await citizenToken(mobile);
  log(PREFIX, 'auth', 'citizen dev OTP');

  await api(
    'POST',
    '/citizen/register',
    citizenTok,
    { name: 'LED Smoke Citizen', mobile },
    scopeHeaders,
  ).then(({ res }) => {
    if (![200, 201, 409].includes(res.status)) {
      fail(PREFIX, `citizen register ${res.status}`);
    }
  });

  const { res: servicesRes, json: services } = await api(
    'GET',
    `/services/tenants/${TENANT}`,
    null,
  );
  assertOk(PREFIX, 'catalogue', servicesRes.status, JSON.stringify(services));
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(PREFIX, `Service ${SERVICE_CODE} missing on ${TENANT}`);
  if (service.payment_schedule !== 'deferred_only') {
    fail(PREFIX, `Expected deferred_only, got ${service.payment_schedule}`);
  }
  log(PREFIX, 'schedule', 'deferred_only');

  const { res: listRes, json: list } = await api(
    'GET',
    `/public/bookings/assets?tenant_code=${TENANT}&service_code=${SERVICE_CODE}`,
    null,
  );
  assertOk(PREFIX, 'list assets', listRes.status, JSON.stringify(list));
  const assets = Array.isArray(list) ? list : list.assets;
  if (!Array.isArray(assets) || assets.length === 0) {
    fail(PREFIX, 'Expected at least one LED board for KMC — run migrate + seed');
  }
  const asset = assets[0];
  log(PREFIX, 'asset', asset.code);

  const { from, to } = nextWeekdaySlotRange();
  const { res: slotsRes, json: slotsBody } = await api(
    'GET',
    `/public/bookings/assets/${encodeURIComponent(asset.code)}/slots?tenant_code=${TENANT}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&service_code=${SERVICE_CODE}`,
    null,
  );
  assertOk(PREFIX, 'slots', slotsRes.status, JSON.stringify(slotsBody));
  const free = (slotsBody.slots ?? []).find((slot) => slot.status === 'free');
  if (!free) {
    fail(PREFIX, `No free LED slot for ${asset.code} between ${from} and ${to}`);
  }
  log(PREFIX, 'slot', `${free.starts_at} → ${free.ends_at}`);

  const { res: hallQuoteRes } = await api(
    'POST',
    '/citizen/bookings/quote',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      asset_code: 'community-hall-main',
      starts_at: free.starts_at,
      ends_at: free.ends_at,
    },
    scopeHeaders,
  );
  if (hallQuoteRes.status !== 400) {
    fail(PREFIX, `Expected 400 quoting hall via ad-led, got ${hallQuoteRes.status}`);
  }
  log(PREFIX, 'scope', 'hall rejected under ad-led');

  const { res: quoteRes, json: quote } = await api(
    'POST',
    '/citizen/bookings/quote',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      asset_code: asset.code,
      starts_at: free.starts_at,
      ends_at: free.ends_at,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'quote', quoteRes.status, JSON.stringify(quote));
  if (quote.rent_paise <= 0) {
    fail(PREFIX, 'Expected positive rent_paise on LED quote');
  }

  const { res: holdRes, json: hold } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      asset_code: asset.code,
      starts_at: free.starts_at,
      ends_at: free.ends_at,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'hold', holdRes.status, JSON.stringify(hold));

  const depositPaise = asset.security_deposit_paise ?? quote.deposit_paise ?? 0;
  const snapshot = buildSnapshot(
    asset.code,
    free.starts_at,
    free.ends_at,
    quote.rent_paise,
    depositPaise,
  );

  const { res: draftRes, json: draft } = await api(
    'POST',
    '/applications/drafts',
    citizenTok,
    {
      service_code: SERVICE_CODE,
      form_data: {
        applicant_name: 'LED Deferred Smoke',
        mobile: '9876500088',
        organization_name: 'Smoke Media Pvt Ltd',
        contact_address: '42 Park Street, Kolkata 700016',
        campaign_title: 'Summer LED Campaign',
        campaign_description: 'Retail promotion for summer collection on municipal LED board.',
        creative_mock: { name: 'creative.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
        led_booking_snapshot: snapshot,
        bookable_asset_code: asset.code,
        booking_starts_at: free.starts_at,
        booking_ends_at: free.ends_at,
        booking_rent_paise: quote.rent_paise,
        booking_deposit_paise: depositPaise,
      },
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'draft', draftRes.status, JSON.stringify(draft));
  if (draft.fee_settlement?.approval?.amount_paise !== quote.rent_paise + depositPaise) {
    fail(
      PREFIX,
      `approval fee mismatch: ${draft.fee_settlement?.approval?.amount_paise} vs ${quote.rent_paise + depositPaise}`,
    );
  }

  await uploadCleanDocument(
    PREFIX,
    citizenTok,
    draft.id,
    'creative_mock',
    'application/pdf',
    'creative.pdf',
  );

  await api(
    'POST',
    `/citizen/bookings/holds/${encodeURIComponent(hold.id)}/link-application`,
    citizenTok,
    { application_id: draft.id },
    scopeHeaders,
  ).then(({ res, text }) => assertOk(PREFIX, 'link hold', res.status, text));

  const { res: submitRes, json: submitted } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    citizenTok,
    undefined,
    scopeHeaders,
  );
  assertOk(PREFIX, 'submit without pay', submitRes.status, JSON.stringify(submitted));
  if (submitted.payment_status === 'paid') {
    fail(PREFIX, 'deferred submit must not require upfront payment');
  }
  log(PREFIX, 'submit', submitted.docket_no);

  const adminTok = await kcToken(ADMIN_USER);
  const clerkTok = await kcToken(CLERK_USER);
  await assignHoardingDesignations(PREFIX, adminTok, CLERK_USER);
  await publishHoardingPilot(PREFIX, adminTok, service);

  let detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'approve-to-executive', {
    require_boc: false,
  });
  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  if (detail.application.current_stage !== 'payment-pending') {
    fail(PREFIX, `expected payment-pending, got ${detail.application.current_stage}`);
  }
  if (!detail.application.active_payment_id) {
    fail(PREFIX, 'desk must issue active_payment_id after approval');
  }
  log(PREFIX, 'desk', 'payment link issued');

  const paymentId = detail.application.active_payment_id;
  const { res: payRes, text: payText } = await api(
    'POST',
    '/payments/stub/complete',
    citizenTok,
    {
      payment_id: paymentId,
      gateway_order_id: `stub_order_${paymentId}`,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'approval payment', payRes.status, payText);

  detail = await fetchDeskDetail(PREFIX, clerkTok, submitted.docket_no);
  const postPayStage = detail.application.current_stage;
  if (postPayStage !== 'payment-received' && postPayStage !== 'certificate-issued') {
    fail(PREFIX, `expected payment-received or certificate-issued, got ${postPayStage}`);
  }
  log(PREFIX, 'paid', `approval fee settled → ${postPayStage}`);

  const { res: appRes, json: appDetail } = await api(
    'GET',
    `/applications/${encodeURIComponent(submitted.docket_no)}`,
    citizenTok,
    undefined,
    scopeHeaders,
  );
  assertOk(PREFIX, 'application detail', appRes.status, JSON.stringify(appDetail));
  if (!appDetail.booking_charges?.reservation_id) {
    fail(PREFIX, 'application missing linked reservation after payment');
  }
  if (appDetail.booking_charges.security_deposit_status !== 'paid') {
    fail(
      PREFIX,
      `expected deposit paid on application, got ${appDetail.booking_charges.security_deposit_status}`,
    );
  }

  const pdfPath = `/citizen/bookings/${encodeURIComponent(hold.id)}/confirmation.pdf`;
  const pdfRes = await fetch(`http://localhost:3001/api${pdfPath}`, {
    headers: { authorization: `Bearer ${citizenTok}`, ...scopeHeaders },
  });
  if (!pdfRes.ok) {
    const pdfText = await pdfRes.text();
    fail(PREFIX, `PDF ${pdfRes.status}: ${pdfText.slice(0, 200)}`);
  }
  const contentType = pdfRes.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    fail(PREFIX, `PDF content-type expected application/pdf, got ${contentType}`);
  }
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfBytes.subarray(0, 4).toString('utf8') !== '%PDF') {
    fail(PREFIX, 'PDF response missing %PDF magic bytes');
  }
  log(PREFIX, 'pdf', `confirmation PDF ${pdfBytes.length} bytes`);
  console.log(`[${PREFIX}] PASS`);
}

main().catch((error) => {
  fail(PREFIX, error instanceof Error ? error.message : String(error));
});
