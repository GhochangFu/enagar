/**
 * Sprint 8.2C smoke: bay merge + vehicle registration + post-confirm occupancy.
 * Run: node scripts/smoke-smart-parking-bay-merge.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:3001/api';
const TENANT = 'KMC';
const MOBILE = process.env.SMOKE_MOBILE ?? '9876543210';

async function post(path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function get(path, headers = {}) {
  const res = await fetch(`${API}${path}`, { headers });
  const json = await res.json();
  return { status: res.status, json };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function bookBay(h, vehicle, bayCode, starts, ends) {
  return post(
    '/citizen/smart-parking/holds',
    {
      tenant_code: TENANT,
      zone_code: 'ZONE-A',
      bay_code: bayCode,
      starts_at: starts,
      ends_at: ends,
      vehicle_number: vehicle,
    },
    h,
  );
}

async function main() {
  const auth = await post('/auth/verify-otp', { mobile: MOBILE, otp: '12345' });
  assert(auth.status === 201, `auth failed: ${auth.status}`);
  const token = auth.json.access_token;
  const h = {
    authorization: `Bearer ${token}`,
    'x-enagar-tenant-code': TENANT,
  };

  await post('/citizen/select-tenant', { tenant_code: TENANT }, h);

  const zonesBefore = await get(`/citizen/smart-parking/zones?tenant_code=${TENANT}`, h);
  assert(zonesBefore.status === 200, 'zones list failed');
  const zoneA = zonesBefore.json.zones.find((z) => z.code === 'ZONE-A');
  assert(zoneA, 'ZONE-A missing');
  console.log('zones before:', zoneA.free_count, '/', zoneA.total_count, 'free');

  const baysBefore = await get(`/citizen/smart-parking/zones/ZONE-A/bays?tenant_code=${TENANT}`, h);
  const freeBay = baysBefore.json.bays.find((b) => b.status === 'FREE');
  assert(freeBay, 'no free bay available for smoke');
  console.log('booking bay:', freeBay.code);

  const starts = new Date().toISOString();
  const ends = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const vehicle = 'WB06S1234';

  const quote = await post(
    '/citizen/smart-parking/quote',
    {
      tenant_code: TENANT,
      zone_code: 'ZONE-A',
      bay_code: freeBay.code,
      starts_at: starts,
      ends_at: ends,
      vehicle_number: vehicle,
    },
    h,
  );
  assert(quote.status === 201, `quote failed: ${quote.status} ${JSON.stringify(quote.json)}`);
  console.log('quote rent_paise:', quote.json.rent_paise);

  const hold = await post(
    '/citizen/smart-parking/holds',
    {
      tenant_code: TENANT,
      zone_code: 'ZONE-A',
      bay_code: freeBay.code,
      starts_at: starts,
      ends_at: ends,
      vehicle_number: vehicle,
    },
    h,
  );
  assert(hold.status === 201, `hold failed: ${hold.status} ${JSON.stringify(hold.json)}`);

  const idem = `smoke-${hold.json.hold_id}`;
  const payInit = await post(
    `/citizen/smart-parking/holds/${hold.json.hold_id}/initiate-payment`,
    { method: 'upi' },
    { ...h, 'idempotency-key': idem },
  );
  assert(payInit.status === 201, `initiate failed: ${payInit.status}`);

  const stub = await post(
    '/payments/stub/complete',
    {
      payment_id: payInit.json.payment.id,
      gateway_order_id: payInit.json.payment.gateway_order_id,
    },
    h,
  );
  assert(stub.status === 201, `stub failed: ${stub.status}`);

  const confirm = await post(
    `/citizen/smart-parking/holds/${hold.json.hold_id}/confirm`,
    { payment_id: payInit.json.payment.id },
    h,
  );
  assert(confirm.status === 201, `confirm failed: ${confirm.status}`);
  console.log('confirmed:', confirm.json.booking_no);

  const baysAfter = await get(`/citizen/smart-parking/zones/ZONE-A/bays?tenant_code=${TENANT}`, h);
  const bookedBay = baysAfter.json.bays.find((b) => b.code === freeBay.code);
  assert(bookedBay?.status === 'OCCUPIED', `expected OCCUPIED, got ${bookedBay?.status}`);
  console.log('bay after confirm:', freeBay.code, bookedBay.status);

  const zonesAfter = await get(`/citizen/smart-parking/zones?tenant_code=${TENANT}`, h);
  const zoneAfter = zonesAfter.json.zones.find((z) => z.code === 'ZONE-A');
  assert(zoneAfter.free_count === zoneA.free_count - 1, 'zone free_count did not decrease');
  console.log('zones after:', zoneAfter.free_count, '/', zoneAfter.total_count, 'free');

  const quoteMissingVehicle = await post(
    '/citizen/smart-parking/quote',
    {
      tenant_code: TENANT,
      zone_code: 'ZONE-A',
      bay_code: 'B03',
      starts_at: starts,
      ends_at: ends,
    },
    h,
  );
  assert(quoteMissingVehicle.status === 400, 'quote without vehicle_number should fail');

  const baysForDup = await get(`/citizen/smart-parking/zones/ZONE-A/bays?tenant_code=${TENANT}`, h);
  const secondBay = baysForDup.json.bays.find((b) => b.status === 'FREE' && b.code !== freeBay.code);
  assert(secondBay, 'need second free bay for duplicate-vehicle test');

  const dupHold = await bookBay(h, vehicle, secondBay.code, starts, ends);
  assert(
    dupHold.status === 409,
    `duplicate vehicle hold should 409, got ${dupHold.status} ${JSON.stringify(dupHold.json)}`,
  );
  console.log('duplicate vehicle rejected:', dupHold.status);

  console.log('SMOKE OK');
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error.message);
  process.exit(1);
});
