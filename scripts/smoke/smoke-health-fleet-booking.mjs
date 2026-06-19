/**
 * Sprint 8.5E — Health fleet booking API smoke (ambulance + hearse pool).
 * Prereq: API :3001, migrate + seed (KMC health fleet), Keycloak users seeded.
 * Usage: node scripts/smoke/smoke-health-fleet-booking.mjs
 */
import { randomUUID } from 'node:crypto';

import {
  TENANT,
  api,
  assertOk,
  citizenToken,
  fail,
  loadInfraEnv,
  log,
} from './lib/hoarding-smoke-lib.mjs';

loadInfraEnv();

const PREFIX = 'health-fleet';
const SERVICE_CODE = 'ambulance';

function weekdaySlotRange(dayOffset) {
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() + dayOffset);
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
  for (let dayOffset = 1; dayOffset <= 21; dayOffset += 1) {
    const { from, to } = weekdaySlotRange(dayOffset);
    const { res, json } = await api(
      'GET',
      `/public/bookings/fleet-availability?tenant_code=${TENANT}&service_code=${serviceCode}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      null,
    );
    assertOk(PREFIX, 'fleet-availability', res.status, JSON.stringify(json));
    const free = (json.slots ?? []).find((row) => row.status === 'free' && row.available_units > 0);
    if (free) {
      return { starts_at: free.starts_at, ends_at: free.ends_at, available_units: free.available_units };
    }
  }
  fail(PREFIX, `No free pooled slot for ${serviceCode} within 21 days`);
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

async function main() {
  const mobile = `9876${String(Date.now()).slice(-6)}`;
  const scopeHeaders = { 'x-enagar-tenant-code': TENANT };
  const citizenTok = await citizenToken(mobile);
  log(PREFIX, 'auth', 'citizen dev OTP');

  await api('POST', '/citizen/register', citizenTok, { name: 'Health Fleet Smoke', mobile }, scopeHeaders).then(
    ({ res }) => {
      if (![200, 201, 409].includes(res.status)) {
        fail(PREFIX, `citizen register ${res.status}`);
      }
    },
  );

  const { res: assetsRes, json: assets } = await api(
    'GET',
    `/public/bookings/assets?tenant_code=${TENANT}&service_code=${SERVICE_CODE}`,
    null,
  );
  assertOk(PREFIX, 'list assets hidden', assetsRes.status, JSON.stringify(assets));
  if (!Array.isArray(assets) || assets.length !== 0) {
    fail(PREFIX, 'ambulance asset list must be empty for citizens');
  }

  const slot = await findFreeFleetSlot(SERVICE_CODE);
  log(PREFIX, 'pool slot', `${slot.available_units} units @ ${slot.starts_at}`);

  const { res: badHoldRes } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      asset_code: 'kmc-ambulance-01',
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      pickup_address: { en: '1 Smoke Test Lane' },
    },
    scopeHeaders,
  );
  if (badHoldRes.status !== 400) {
    fail(PREFIX, `expected 400 when asset_code passed, got ${badHoldRes.status}`);
  }

  const { res: quoteRes, json: quote } = await api(
    'POST',
    '/citizen/bookings/fleet/quote',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'fleet quote', quoteRes.status, JSON.stringify(quote));

  const { res: holdRes, json: hold } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      pickup_address: { en: '1 Smoke Test Lane, Kolkata' },
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'fleet hold', holdRes.status, JSON.stringify(hold));
  if (!hold.assigned_asset_code) {
    fail(PREFIX, 'hold missing assigned_asset_code');
  }

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
  assertOk(PREFIX, 'confirm paid hold', confirmRes.status, JSON.stringify(confirmed));
  if (!confirmed.booking_no) {
    fail(PREFIX, 'missing booking_no after confirm');
  }

  const { res: listRes, json: listBody } = await api(
    'GET',
    '/citizen/bookings?status=confirmed&limit=20',
    citizenTok,
    null,
    scopeHeaders,
  );
  assertOk(PREFIX, 'citizen bookings list', listRes.status, JSON.stringify(listBody));
  if (!Array.isArray(listBody)) {
    fail(PREFIX, 'bookings list must be an array');
  }
  const listed = listBody.find(
    (row) => row.id === confirmed.id || row.booking_no === confirmed.booking_no,
  );
  if (!listed) {
    fail(PREFIX, 'confirmed ambulance booking missing from citizen list');
  }
  if (listed.asset_code || listed.assigned_asset_code) {
    fail(PREFIX, 'citizen list must not expose assigned vehicle code');
  }
  if (!listed.can_download_receipt) {
    fail(PREFIX, 'confirmed booking must set can_download_receipt');
  }
  if (listed.service_code !== SERVICE_CODE) {
    fail(PREFIX, `list service_code expected ${SERVICE_CODE}, got ${listed.service_code}`);
  }
  log(PREFIX, 'list', `citizen bookings list includes ${listed.booking_no}`);

  const pdfRef = confirmed.booking_no.replace(/\//g, '--');
  const pdfRes = await fetch(
    `http://localhost:3001/api/citizen/bookings/${encodeURIComponent(pdfRef)}/confirmation.pdf`,
    { headers: { authorization: `Bearer ${citizenTok}`, ...scopeHeaders } },
  );
  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    fail(PREFIX, `confirmation PDF ${pdfRes.status}: ${errText.slice(0, 200)}`);
  }
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfBytes.subarray(0, 4).toString('utf8') !== '%PDF') {
    fail(PREFIX, 'confirmation PDF missing PDF magic bytes');
  }
  if (pdfBytes.length < 1_500) {
    fail(PREFIX, 'confirmation PDF too small — expected formatted PDFKit output');
  }
  const contentType = pdfRes.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    fail(PREFIX, `expected application/pdf, got ${contentType}`);
  }
  log(PREFIX, 'pdf', `formatted receipt ${pdfBytes.length} bytes`);

  const emergencySlot = await findFreeFleetSlot(SERVICE_CODE);
  const { res: emHoldRes, json: emHold } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: SERVICE_CODE,
      starts_at: emergencySlot.starts_at,
      ends_at: emergencySlot.ends_at,
      pickup_address: { en: 'Emergency pickup address' },
      emergency: true,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'emergency hold', emHoldRes.status, JSON.stringify(emHold));
  if (emHold.rent_paise !== 0) {
    fail(PREFIX, 'emergency hold rent must be 0');
  }

  const { res: emConfirmRes, json: emConfirmed } = await api(
    'POST',
    `/citizen/bookings/holds/${emHold.id}/confirm`,
    citizenTok,
    {},
    scopeHeaders,
  );
  assertOk(PREFIX, 'emergency confirm', emConfirmRes.status, JSON.stringify(emConfirmed));

  const hearseSlot = await findFreeFleetSlot('hearse');
  const { res: hearseRes } = await api(
    'POST',
    '/citizen/bookings/holds',
    citizenTok,
    {
      tenant_code: TENANT,
      service_code: 'hearse',
      starts_at: hearseSlot.starts_at,
      ends_at: hearseSlot.ends_at,
    },
    scopeHeaders,
  );
  assertOk(PREFIX, 'hearse hold', hearseRes.status, '');

  // F5 — parallel holds on same slot: second must fail when pool exhausted
  const raceSlot = await findFreeFleetSlot('hearse');
  const holdBody = {
    tenant_code: TENANT,
    service_code: 'hearse',
    starts_at: raceSlot.starts_at,
    ends_at: raceSlot.ends_at,
  };
  const [raceA, raceB] = await Promise.all([
    api('POST', '/citizen/bookings/holds', citizenTok, holdBody, scopeHeaders),
    api('POST', '/citizen/bookings/holds', citizenTok, holdBody, scopeHeaders),
  ]);
  const statuses = [raceA.res.status, raceB.res.status].sort();
  if (!statuses.includes(201) && !statuses.includes(200)) {
    fail(PREFIX, `parallel hearse holds expected one success, got ${statuses.join(',')}`);
  }
  if (!statuses.includes(409)) {
    fail(PREFIX, `parallel hearse holds expected one 409, got ${statuses.join(',')}`);
  }
  log(PREFIX, 'concurrency', 'parallel hold race passed');

  log(PREFIX, 'done', 'health fleet smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
