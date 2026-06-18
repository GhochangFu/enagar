/**
 * Sprint 8.2F smoke: smart parking + EV charging + IoT water meter (stub adapters).
 * Run: node scripts/smoke-sprint-82-smart-city.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:3001/api';
const TENANT = 'KMC';
const MOBILE = process.env.SMOKE_MOBILE ?? '9876543210';
const WATER_METER_ID = process.env.SMOKE_WATER_METER_ID ?? 'WM-001';
const WATER_RECHARGE_PAISE = Number(process.env.SMOKE_WATER_RECHARGE_PAISE ?? '50000');

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

async function authHeaders() {
  const auth = await post('/auth/verify-otp', { mobile: MOBILE, otp: '12345' });
  assert(auth.status === 201, `auth failed: ${auth.status}`);
  const h = {
    authorization: `Bearer ${auth.json.access_token}`,
    'x-enagar-tenant-code': TENANT,
  };
  await post('/citizen/select-tenant', { tenant_code: TENANT }, h);
  return h;
}

async function smokeSmartParking(h) {
  console.log('\n== smart parking ==');
  const zonesBefore = await get(`/citizen/smart-parking/zones?tenant_code=${TENANT}`, h);
  assert(zonesBefore.status === 200, 'zones list failed');
  const zoneA = zonesBefore.json.zones.find((z) => z.code === 'ZONE-A');
  assert(zoneA, 'ZONE-A missing');

  const baysBefore = await get(`/citizen/smart-parking/zones/ZONE-A/bays?tenant_code=${TENANT}`, h);
  const freeBay = baysBefore.json.bays.find((b) => b.status === 'FREE');
  assert(freeBay, 'no free bay available for smoke');

  const starts = new Date().toISOString();
  const ends = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const vehicle = `WB82${String(Date.now()).slice(-4)}`;

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
  assert(quote.status === 201, `quote failed: ${quote.status}`);

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
  assert(hold.status === 201, `hold failed: ${hold.status}`);

  const idem = `smoke-82-parking-${hold.json.hold_id}`;
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

  const baysAfter = await get(`/citizen/smart-parking/zones/ZONE-A/bays?tenant_code=${TENANT}`, h);
  const bookedBay = baysAfter.json.bays.find((b) => b.code === freeBay.code);
  assert(bookedBay?.status === 'OCCUPIED', `expected OCCUPIED, got ${bookedBay?.status}`);
  console.log('parking OK:', freeBay.code, '→', bookedBay.status);
}

async function smokeEvCharging(h) {
  console.log('\n== ev charging ==');
  const chargers = await get(`/citizen/ev-charging/chargers?tenant_code=${TENANT}`, h);
  assert(chargers.status === 200, `chargers list failed: ${chargers.status}`);
  const available = chargers.json.chargers.find((c) => c.available);
  assert(available, 'no available EV charger for smoke');

  const hold = await post(
    `/citizen/ev-charging/chargers/${encodeURIComponent(available.code)}/holds`,
    { tenant_code: TENANT, vehicle_number: 'WB82E1234' },
    h,
  );
  assert(hold.status === 201, `hold failed: ${hold.status}`);

  const start = await post(
    `/citizen/ev-charging/sessions/${hold.json.session_id}/start`,
    { tenant_code: TENANT },
    h,
  );
  assert(start.status === 201, `start failed: ${start.status}`);

  const stop = await post(
    `/citizen/ev-charging/sessions/${hold.json.session_id}/stop`,
    { tenant_code: TENANT },
    h,
  );
  assert(stop.status === 201, `stop failed: ${stop.status}`);
  assert(stop.json.amount_paise === 8250, `expected 8250 paise, got ${stop.json.amount_paise}`);

  const idem = `smoke-82-ev-${hold.json.session_id}`;
  const payInit = await post(
    `/citizen/ev-charging/sessions/${hold.json.session_id}/initiate-payment`,
    { tenant_code: TENANT, method: 'upi' },
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

  const pay = await post(
    `/citizen/ev-charging/sessions/${hold.json.session_id}/pay`,
    { tenant_code: TENANT, payment_id: payInit.json.payment.id },
    h,
  );
  assert(pay.status === 201, `pay failed: ${pay.status}`);
  assert(pay.json.status === 'COMPLETED', `expected COMPLETED, got ${pay.json.status}`);
  console.log('ev charging OK:', available.code, hold.json.session_id);
}

async function smokeWaterMeter(h) {
  console.log('\n== iot water ==');
  const before = await get(
    `/citizen/iot-water/water-meters/${encodeURIComponent(WATER_METER_ID)}?tenant_code=${TENANT}`,
    h,
  );
  assert(before.status === 200, `lookup failed: ${before.status}`);
  const beforeBalance = before.json.balance_paise;

  const idem = `smoke-82-water-${WATER_METER_ID}-${Date.now()}`;
  const recharge = await post(
    `/citizen/iot-water/water-meters/${encodeURIComponent(WATER_METER_ID)}/recharge`,
    { tenant_code: TENANT, amount_paise: WATER_RECHARGE_PAISE, method: 'upi' },
    { ...h, 'idempotency-key': idem },
  );
  assert(recharge.status === 201, `recharge failed: ${recharge.status}`);

  const stub = await post(
    '/payments/stub/complete',
    {
      payment_id: recharge.json.payment.id,
      gateway_order_id: recharge.json.payment.gateway_order_id,
    },
    h,
  );
  assert(stub.status === 201, `stub failed: ${stub.status}`);

  const after = await get(
    `/citizen/iot-water/water-meters/${encodeURIComponent(WATER_METER_ID)}?tenant_code=${TENANT}`,
    h,
  );
  assert(after.status === 200, `post-recharge lookup failed: ${after.status}`);
  assert(
    after.json.balance_paise === beforeBalance + WATER_RECHARGE_PAISE,
    `expected balance ${beforeBalance + WATER_RECHARGE_PAISE}, got ${after.json.balance_paise}`,
  );
  console.log('water meter OK:', WATER_METER_ID, beforeBalance, '→', after.json.balance_paise);
}

async function main() {
  const h = await authHeaders();
  await smokeSmartParking(h);
  await smokeEvCharging(h);
  await smokeWaterMeter(h);
  console.log('\nsmoke-sprint-82-smart-city: OK');
}

main().catch((error) => {
  console.error('smoke-sprint-82-smart-city FAILED:', error.message ?? error);
  process.exit(1);
});
