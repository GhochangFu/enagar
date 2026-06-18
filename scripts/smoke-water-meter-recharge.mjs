/**
 * Sprint 8.2E smoke: IoT water meter lookup → prepaid recharge → balance increase.
 * Run: node scripts/smoke-water-meter-recharge.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:3001/api';
const TENANT = 'KMC';
const MOBILE = process.env.SMOKE_MOBILE ?? '9876543210';
const METER_ID = process.env.SMOKE_WATER_METER_ID ?? 'WM-001';
const RECHARGE_AMOUNT_PAISE = Number(process.env.SMOKE_WATER_RECHARGE_PAISE ?? '50000');

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

  const before = await get(
    `/citizen/iot-water/water-meters/${encodeURIComponent(METER_ID)}?tenant_code=${TENANT}`,
    h,
  );
  assert(before.status === 200, `lookup failed: ${before.status} ${JSON.stringify(before.json)}`);
  const beforeBalance = before.json.balance_paise;
  console.log('water meter before:', METER_ID, beforeBalance);

  const idem = `smoke-water-${METER_ID}-${Date.now()}`;
  const recharge = await post(
    `/citizen/iot-water/water-meters/${encodeURIComponent(METER_ID)}/recharge`,
    { tenant_code: TENANT, amount_paise: RECHARGE_AMOUNT_PAISE, method: 'upi' },
    { ...h, 'idempotency-key': idem },
  );
  assert(recharge.status === 201, `recharge failed: ${recharge.status}`);
  assert(recharge.json.payment?.id, 'recharge did not return payment');

  const stub = await post(
    '/payments/stub/complete',
    {
      payment_id: recharge.json.payment.id,
      gateway_order_id: recharge.json.payment.gateway_order_id,
    },
    h,
  );
  assert(stub.status === 201, `stub failed: ${stub.status} ${JSON.stringify(stub.json)}`);

  const after = await get(
    `/citizen/iot-water/water-meters/${encodeURIComponent(METER_ID)}?tenant_code=${TENANT}`,
    h,
  );
  assert(after.status === 200, `post-recharge lookup failed: ${after.status}`);
  assert(
    after.json.balance_paise === beforeBalance + RECHARGE_AMOUNT_PAISE,
    `expected balance ${beforeBalance + RECHARGE_AMOUNT_PAISE}, got ${after.json.balance_paise}`,
  );
  console.log('water meter after:', METER_ID, after.json.balance_paise);
  console.log('smoke-water-meter-recharge: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
