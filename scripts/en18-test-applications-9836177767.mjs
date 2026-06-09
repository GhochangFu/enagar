// Simulate the citizen-pwa: get a dev token, call /applications
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
// (Just to get a token; the citizen's dev token comes from /api/auth/otp/verify with their mobile)
const tok = (await tokRes.json()).access_token;

// Get a citizen token
const citizenTokRes = await fetch('http://localhost:3001/api/auth/send-otp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mobile: '9836177767' }),
});
console.log('send otp status:', citizenTokRes.status);
const citizenTokRes2 = await fetch('http://localhost:3001/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mobile: '9836177767', otp: '12345', tenant_code: 'KMC' }),
});
console.log('verify otp status:', citizenTokRes2.status);
const cToken = (await citizenTokRes2.json()).access_token;
const dec = JSON.parse(Buffer.from(cToken.split('.')[1], 'base64').toString());
console.log('citizen subject:', dec.sub, 'mobile:', dec.mobile ?? dec.preferred_username, 'tenant:', dec.tenant_code ?? dec.tenant_claims);

// List apps without X-Enagar-Tenant-Code
const r1 = await fetch('http://localhost:3001/api/applications', {
  headers: { authorization: 'Bearer ' + cToken },
});
console.log('list apps (no scope):', r1.status, 'count:', (await r1.json()).length);

// List apps with KMC scope
const r2 = await fetch('http://localhost:3001/api/applications', {
  headers: { authorization: 'Bearer ' + cToken, 'x-enagar-tenant-code': 'KMC' },
});
const j2 = await r2.json();
console.log('list apps (kmc scope):', r2.status, 'count:', j2.length);
for (const a of j2.slice(0, 5)) {
  console.log('  -', a.docket_no, a.status, 'tenant=', a.tenant_code, 'subject=', a.citizen_subject);
}
