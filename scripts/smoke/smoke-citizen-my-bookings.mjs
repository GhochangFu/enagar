/**
 * Sprint 8.5F2 — Citizen My Bookings list + receipt smoke.
 * Prereq: API :3001, migrate + seed (KMC health fleet), Keycloak users seeded.
 * Usage: node scripts/smoke/smoke-citizen-my-bookings.mjs
 */
import { randomUUID } from 'node:crypto';

import {
  TENANT,
  api,
  assertOk,
  citizenToken,
  fail,
  kcToken,
  loadInfraEnv,
  log,
  ADMIN_USER,
  API,
} from './lib/hoarding-smoke-lib.mjs';

loadInfraEnv();

const PREFIX = 'my-bookings';
const SERVICE_CODE = 'ambulance';

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

async function findFreeFleetSlot(serviceCode) {
  const { from, to } = nextWeekdaySlotRange();
  const { res, json } = await api(
    'GET',
    `/public/bookings/fleet-availability?tenant_code=${TENANT}&service_code=${serviceCode}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    null,
  );
  assertOk(PREFIX, 'fleet-availability', res.status, JSON.stringify(json));
  const free = (json.slots ?? []).find((row) => row.status === 'free' && row.available_units > 0);
  if (!free) {
    fail(PREFIX, `No free pooled slot for ${serviceCode}`);
  }
  return { starts_at: free.starts_at, ends_at: free.ends_at };
}

async function stubCompletePayment(citizenTok, payment, scopeHeaders) {
  const { res, json } = await api(
    'POST',
    '/payments/stub/complete',
    citizenTok,
    {
      payment_id: payment.id,
      gateway_order_id: payment.gateway_order_id,
    },
    scopeHeaders,
  );
  if (!res.ok) {
    fail(PREFIX, `stub complete ${res.status}: ${JSON.stringify(json)}`);
  }
}

async function ensureConfirmedBooking(citizenTok, scopeHeaders) {
  const { res: existingRes, json: existing } = await api(
    'GET',
    '/citizen/bookings?status=confirmed&limit=5',
    citizenTok,
    null,
    scopeHeaders,
  );
  assertOk(PREFIX, 'preflight list', existingRes.status, JSON.stringify(existing));
  const ready = (existing ?? []).find((row) => row.can_download_receipt && row.booking_no);
  if (ready) {
    log(PREFIX, 'reuse', ready.booking_no);
    return ready;
  }

  const slot = await findFreeFleetSlot(SERVICE_CODE);
  const { res: holdRes, json: hold } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      pickup_address: { en: '1 My Bookings Smoke Lane, Kolkata' },
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'fleet hold', holdRes.status, JSON.stringify(hold));

  const idem = randomUUID();
  const { res: payRes, json: payBody } = await api(
    'POST',
    `/citizen/bookings/holds/${hold.id}/initiate-payment`,
    citizenTok,
    { method: 'upi', include_rent: true },
    { ...scopeHeaders, 'idempotency-key': idem },
  );
  assertOk(PREFIX, 'initiate rent payment', payRes.status, JSON.stringify(payBody));
  await stubCompletePayment(citizenTok, payBody.payment, scopeHeaders);

  const { res: confirmRes, json: confirmed } = await api(
    'POST',
    `/citizen/bookings/holds/${hold.id}/confirm`,
    citizenTok,
    {},
    scopeHeaders,
  );
  assertOk(PREFIX, 'confirm hold', confirmRes.status, JSON.stringify(confirmed));
  if (!confirmed.booking_no) {
    fail(PREFIX, 'missing booking_no after confirm');
  }
  return confirmed;
}

async function main() {
  const mobile = `9876${String(Date.now()).slice(-6)}`;
  const scopeHeaders = { 'x-enagar-tenant-code': TENANT };
  const citizenTok = await citizenToken(mobile);
  log(PREFIX, 'auth', 'citizen dev OTP');

  await api('POST', '/citizen/register', citizenTok, { name: 'My Bookings Smoke', mobile }, scopeHeaders).then(
    ({ res }) => {
      if (![200, 201, 409].includes(res.status)) {
        fail(PREFIX, `citizen register ${res.status}`);
      }
    },
  );

  const confirmed = await ensureConfirmedBooking(citizenTok, scopeHeaders);

  const { res: hubRes, json: hubList } = await api(
    'GET',
    '/citizen/bookings?status=confirmed&limit=20',
    citizenTok,
  );
  assertOk(PREFIX, 'hub bookings list', hubRes.status, JSON.stringify(hubList));
  if (!Array.isArray(hubList)) {
    fail(PREFIX, 'hub list must be an array');
  }
  const hubRow = hubList.find(
    (row) => row.id === confirmed.id || row.booking_no === confirmed.booking_no,
  );
  if (!hubRow) {
    fail(PREFIX, 'confirmed booking missing from hub list');
  }
  if (hubRow.tenant_code !== TENANT) {
    fail(PREFIX, `hub row tenant_code expected ${TENANT}, got ${hubRow.tenant_code}`);
  }

  const { res: scopedRes, json: scopedList } = await api(
    'GET',
    '/citizen/bookings?status=confirmed&limit=20',
    citizenTok,
    null,
    scopeHeaders,
  );
  assertOk(PREFIX, 'scoped bookings list', scopedRes.status, JSON.stringify(scopedList));
  const scopedRow = (scopedList ?? []).find((row) => row.id === confirmed.id);
  if (!scopedRow) {
    fail(PREFIX, 'confirmed booking missing from scoped list');
  }
  if (!scopedRow.service_label || !scopedRow.starts_at) {
    fail(PREFIX, 'list row missing service_label or starts_at');
  }

  const { res: holdListRes, json: holdList } = await api(
    'GET',
    '/citizen/bookings?status=hold&limit=10',
    citizenTok,
    null,
    scopeHeaders,
  );
  assertOk(PREFIX, 'hold bookings list', holdListRes.status, JSON.stringify(holdList));
  if (!Array.isArray(holdList)) {
    fail(PREFIX, 'hold list must be an array');
  }

  const pdfRef = confirmed.booking_no.replace(/\//g, '--');
  const pdfRes = await fetch(
    `${API}/citizen/bookings/${encodeURIComponent(pdfRef)}/confirmation.pdf`,
    { headers: { authorization: `Bearer ${citizenTok}`, ...scopeHeaders } },
  );
  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    fail(PREFIX, `confirmation PDF ${pdfRes.status}: ${errText.slice(0, 200)}`);
  }
  const contentType = pdfRes.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    fail(PREFIX, `expected application/pdf, got ${contentType}`);
  }
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfBytes.subarray(0, 4).toString('utf8') !== '%PDF') {
    fail(PREFIX, 'confirmation PDF missing PDF magic bytes');
  }
  log(PREFIX, 'pdf', `receipt ${pdfBytes.length} bytes, ${contentType}`);

  const adminTok = await kcToken(ADMIN_USER);
  const { res: summaryRes, json: summary } = await api(
    'GET',
    '/admin/tenant/dashboard/booking-summary',
    adminTok,
  );
  assertOk(PREFIX, 'admin booking summary', summaryRes.status, JSON.stringify(summary));
  if (summary.period_days !== 30 || !summary.totals || !Array.isArray(summary.recent)) {
    fail(PREFIX, 'booking summary shape invalid');
  }
  log(
    PREFIX,
    'admin-summary',
    `confirmed=${summary.totals.confirmed} holds=${summary.totals.holds} recent=${summary.recent.length}`,
  );

  log(PREFIX, 'done', 'my bookings smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
