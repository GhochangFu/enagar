// Smoke test the new citizen-scoped /lease-invoices/:id/pay-as-citizen route
// and the updated /lease-invoices/lookup shape (now includes tenantCode).
//
// Run:  node scripts/en18-smoke-citizen-pay.mjs
//
// Pre-req: API is up at http://localhost:3001, the DB has at least one
// pending lease invoice whose agreement.lessorPhone matches the phone below.

const API = process.env.API_BASE ?? 'http://localhost:3001/api';
const PHONE = '9836177767';

let token;
let principalSubject;
try {
  const otpRes = await fetch(`${API}/auth/send-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile: PHONE }),
  });
  if (!otpRes.ok) {
    console.error('send-otp failed:', otpRes.status);
    process.exit(1);
  }
  const verifyRes = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile: PHONE, otp: '12345' }),
  });
  if (!verifyRes.ok) {
    console.error('verify-otp failed:', verifyRes.status, await verifyRes.text());
    process.exit(1);
  }
  const verifyBody = await verifyRes.json();
  token = verifyBody.access_token;
  principalSubject = verifyBody.subject ?? `dev-citizen-${PHONE}`;
  console.log('Got token for', principalSubject);
} catch (err) {
  console.error('auth failed:', err);
  process.exit(1);
}

const authH = { authorization: `Bearer ${token}` };

// 1. Look up leases (no tenant header, citizen-scoped)
const lookup = await fetch(`${API}/lease-invoices/lookup?phone=${encodeURIComponent(PHONE)}`, {
  headers: authH,
});
console.log('lookup status:', lookup.status);
if (!lookup.ok) {
  console.error(await lookup.text());
  process.exit(1);
}
const leases = await lookup.json();
const pending = leases
  .flatMap((l) => l.invoices.map((i) => ({ ...i, tenantCode: l.tenantCode, lessorName: l.lessorName, assetName: l.asset?.name?.en })))
  .filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');

console.log('leases:', leases.length, '| pending invoices:', pending.length);
console.log('first pending sample:', JSON.stringify(pending[0], null, 2));

if (pending.length === 0) {
  console.log('No pending invoices to pay. Skipping pay-as-citizen call.');
  process.exit(0);
}

const target = pending[0];
console.log('Paying invoice', target.invoiceNo, '(', target.id, ')');

// 2. Citizen-scoped pay-as-citizen
const payRes = await fetch(`${API}/lease-invoices/${target.id}/pay-as-citizen`, {
  method: 'POST',
  headers: { ...authH, 'content-type': 'application/json' },
  body: JSON.stringify({ method: 'ONLINE_GATEWAY', phone: PHONE }),
});
console.log('pay-as-citizen status:', payRes.status);
if (!payRes.ok) {
  console.error(await payRes.text());
  process.exit(1);
}
const payBody = await payRes.json();
console.log('pay-as-citizen body:', JSON.stringify(payBody, null, 2));

// 3. Extract payment_id + order_id from redirectUrl and call stub-complete
const url = new URL(payBody.redirectUrl, 'http://placeholder.local');
const paymentId = url.searchParams.get('payment_id');
const orderId = url.searchParams.get('order_id');
console.log('Extracted payment_id:', paymentId, 'order_id:', orderId);

const tenantHdr = target.tenantCode ? { 'x-enagar-tenant-code': target.tenantCode } : {};
const settle = await fetch(`${API}/payments/stub/complete`, {
  method: 'POST',
  headers: { ...authH, 'content-type': 'application/json', ...tenantHdr },
  body: JSON.stringify({ payment_id: paymentId, gateway_order_id: orderId }),
});
console.log('stub-complete status:', settle.status);
if (!settle.ok) {
  console.error(await settle.text());
  process.exit(1);
}
const settleBody = await settle.json();
console.log('settled. lease_invoice_id should match:', settleBody.lease_invoice_id ?? settleBody.leaseInvoiceId ?? '(field not returned)');

// 4. Verify the payment appears in /payments with lease_invoice_id set
const list = await fetch(`${API}/payments`, { headers: authH });
const all = list.ok ? await list.json() : [];
const found = all.find((p) => p.id === paymentId);
console.log('Payment in /payments has lease_invoice_id:', found?.lease_invoice_id ?? '(missing)');

// 5. Verify the invoice is now PAID in lookup
const lookup2 = await fetch(`${API}/lease-invoices/lookup?phone=${encodeURIComponent(PHONE)}`, {
  headers: authH,
});
const leases2 = lookup2.ok ? await lookup2.json() : [];
const all2 = leases2.flatMap((l) => l.invoices);
const after = all2.find((i) => i.id === target.id);
console.log('Invoice status after settle:', after?.status);
