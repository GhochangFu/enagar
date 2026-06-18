/**
 * Sprint 8.2D smoke: EV charging hold → start → stop → pay.
 * Run: node scripts/smoke-ev-charging.mjs
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

async function main() {
  const auth = await post('/auth/verify-otp', { mobile: MOBILE, otp: '12345' });
  assert(auth.status === 201, `auth failed: ${auth.status}`);
  const token = auth.json.access_token;
  const h = {
    authorization: `Bearer ${token}`,
    'x-enagar-tenant-code': TENANT,
  };

  await post('/citizen/select-tenant', { tenant_code: TENANT }, h);

  const chargers = await get(`/citizen/ev-charging/chargers?tenant_code=${TENANT}`, h);
  assert(chargers.status === 200, `chargers list failed: ${chargers.status}`);
  const available = chargers.json.chargers.find((c) => c.available);
  assert(available, 'no available EV charger for smoke');
  console.log('available charger:', available.code);

  const hold = await post(
    `/citizen/ev-charging/chargers/${encodeURIComponent(available.code)}/holds`,
    { tenant_code: TENANT, vehicle_number: 'WB06A1234' },
    h,
  );
  assert(hold.status === 201, `hold failed: ${hold.status} ${JSON.stringify(hold.json)}`);
  console.log('hold session:', hold.json.session_id);

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
  console.log('stop amount_paise:', stop.json.amount_paise, 'kwh:', stop.json.kwh_consumed);

  const idem = `smoke-ev-${hold.json.session_id}`;
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
  assert(stub.status === 201, `stub failed: ${stub.status} ${JSON.stringify(stub.json)}`);

  const pay = await post(
    `/citizen/ev-charging/sessions/${hold.json.session_id}/pay`,
    { tenant_code: TENANT, payment_id: payInit.json.payment.id },
    h,
  );
  assert(pay.status === 201, `pay failed: ${pay.status}`);
  assert(pay.json.status === 'COMPLETED', `expected COMPLETED, got ${pay.json.status}`);
  console.log('session completed:', pay.json.session_id);

  const chargersAfter = await get(`/citizen/ev-charging/chargers?tenant_code=${TENANT}`, h);
  const sameCharger = chargersAfter.json.chargers.find((c) => c.code === available.code);
  assert(sameCharger?.available === true, 'charger should be available again after completion');
  console.log('smoke-ev-charging: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
