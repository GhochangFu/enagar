const citizenTokRes = await fetch('http://localhost:3001/api/auth/send-otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mobile: '9836177767' }) });
const r2 = await fetch('http://localhost:3001/api/auth/verify-otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mobile: '9836177767', otp: '12345', tenant_code: 'KMC' }) });
const cToken = (await r2.json()).access_token;

// List the raw response
const r = await fetch('http://localhost:3001/api/applications', {
  headers: { authorization: 'Bearer ' + cToken, 'x-enagar-tenant-code': 'KMC' },
});
const j = await r.json();
console.log('count:', j.length);
for (const a of j) {
  console.log(JSON.stringify({ docket: a.docket_no, status: a.status, tenant: a.tenant_code, subject: a.citizen_subject, citizenId: a.citizen_id, submitted: a.submitted_at }, null, 2));
}
