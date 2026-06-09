// Smoke the citizen-pwa lease lookup endpoint from a citizen token (no staff role)
const tokRes = await fetch('http://localhost:8080/realms/enagar/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-tenant',
    username: 'kmc-municipality-admin-dummy',
    password: 'DummyDev_2026!ChangeMe',
  }),
});
const tok = (await tokRes.json()).access_token;

// 1) Unformatted phone (with +91 prefix, spaces, dashes)
const r1 = await fetch('http://localhost:3001/api/lease-invoices/lookup?phone=%2B91%2098765-43210', {
  headers: { authorization: `Bearer ${tok}` },
});
console.log('unformatted +91 98765-43210 →', r1.status, await r1.text().then(t => t.length < 400 ? t : t.slice(0, 400)));

// 2) Plain phone
const r2 = await fetch('http://localhost:3001/api/lease-invoices/lookup?phone=9876543210', {
  headers: { authorization: `Bearer ${tok}` },
});
console.log('plain 9876543210 →', r2.status);

// 3) Unknown phone
const r3 = await fetch('http://localhost:3001/api/lease-invoices/lookup?phone=0000000000', {
  headers: { authorization: `Bearer ${tok}` },
});
console.log('unknown 0000000000 →', r3.status, await r3.text());

// 4) Too short
const r4 = await fetch('http://localhost:3001/api/lease-invoices/lookup?phone=12345', {
  headers: { authorization: `Bearer ${tok}` },
});
console.log('too short 12345 →', r4.status, await r4.text());

// 5) No token
const r5 = await fetch('http://localhost:3001/api/lease-invoices/lookup?phone=9876543210');
console.log('no token →', r5.status);
