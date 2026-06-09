// Smoke the manual lease-scheduler endpoint
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

const r = await fetch('http://localhost:3001/api/rental-assets/scheduler/run', {
  method: 'POST',
  headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
});
console.log('Status:', r.status);
console.log('Body:', await r.text());
