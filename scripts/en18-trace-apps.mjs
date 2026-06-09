// Get a citizen token, list apps, also try list with X-Enagar-Tenant-Code
const citizenTokRes = await fetch('http://localhost:3001/api/auth/send-otp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mobile: '9836177767' }),
});
const citizenTokRes2 = await fetch('http://localhost:3001/api/auth/verify-otp', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mobile: '9836177767', otp: '12345', tenant_code: 'KMC' }),
});
const j = await citizenTokRes2.json();
const cToken = j.access_token;
const dec = JSON.parse(Buffer.from(cToken.split('.')[1], 'base64').toString());
console.log('subject:', dec.sub, 'tenant_code:', dec.tenant_code ?? dec['tenant-claims']?.code);
console.log('roles:', JSON.stringify(dec.realm_access?.roles ?? dec.roles));
console.log('scope:', dec.scope);
console.log('---');

for (const scope of [null, 'KMC', 'HMC', 'BMC', 'DMC', 'KOLKATA']) {
  const headers = { authorization: 'Bearer ' + cToken };
  if (scope) headers['x-enagar-tenant-code'] = scope;
  const r = await fetch('http://localhost:3001/api/applications', { headers });
  const j2 = await r.json();
  console.log(`scope=${scope ?? '(none)'} -> status=${r.status} count=${j2.length}`);
  for (const a of j2) console.log('   ', a.docket_no, a.status, a.tenant_code);
}

// Also test grievance + payments endpoints
for (const path of ['/grievances', '/payments']) {
  const r = await fetch('http://localhost:3001/api' + path, {
    headers: { authorization: 'Bearer ' + cToken, 'x-enagar-tenant-code': 'KMC' },
  });
  const j2 = await r.json();
  console.log(`${path} -> status=${r.status} count=${Array.isArray(j2) ? j2.length : 'not-array'}`);
}
