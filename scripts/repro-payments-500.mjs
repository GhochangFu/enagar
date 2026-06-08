#!/usr/bin/env node
// EN-16 follow-up: reproduce the 500 on POST /api/payments/initiate that the
// citizen-pwa hits during birth-cert submit. Logs the full response body so
// the actual exception reaches the operator.
const apiBase = 'http://localhost:3001';

async function postJson(path, body, headers = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function getJson(path, headers = {}) {
  const res = await fetch(`${apiBase}${path}`, { headers });
  const text = await res.text();
  return { status: res.status, text };
}

(async () => {
  const tenantCode = 'KMC';
  const mobile = '9876543210';

  // Dev-mode OTP flow.
  const otp = await postJson('/api/auth/send-otp', { mobile, tenant_code: tenantCode });
  console.log('send-otp:', otp.status, otp.text.slice(0, 200));
  const verify = await postJson('/api/auth/verify-otp', { mobile, tenant_code: tenantCode, otp: '12345' });
  console.log('verify-otp:', verify.status, verify.text.slice(0, 200));
  if (verify.status !== 201) {
    process.exit(1);
  }
  const { access_token: accessToken } = JSON.parse(verify.text);

  // Find a birth-cert draft, or create one.
  const drafts = await getJson(
    `/api/applications?status=draft&x-enagar-tenant-code=${tenantCode}`,
    { authorization: `Bearer ${accessToken}` },
  );
  let applicationId = JSON.parse(drafts.text)?.find?.((a) => a.service_code === 'birth-cert')?.id;
  if (!applicationId) {
    const create = await postJson(
      '/api/applications',
      {
        service_code: 'birth-cert',
        form_data: {
          applicant_name: 'Repro User',
          mobile,
          child_name: 'Repro Child',
          date_of_birth: '2026-01-01',
          relationship: 'parent',
        },
      },
      {
        authorization: `Bearer ${accessToken}`,
        'x-enagar-tenant-code': tenantCode,
      },
    );
    console.log('create draft:', create.status, create.text.slice(0, 400));
    if (create.status >= 300) {
      process.exit(2);
    }
    applicationId = JSON.parse(create.text).id;
  }
  if (!applicationId) {
    console.error('No draft application found for tenant', tenantCode);
    process.exit(2);
  }

  // POST the same call the citizen-pwa makes on submit.
  const init = await postJson(
    '/api/payments/initiate',
    {
      application_id: applicationId,
      amount_paise: 5000,
      method: 'upi',
      fee_code: 'application',
    },
    {
      authorization: `Bearer ${accessToken}`,
      'idempotency-key': 'repro-' + Date.now(),
      'x-enagar-tenant-code': tenantCode,
    },
  );
  console.log('payments/initiate:', init.status);
  console.log('body:', init.text);
})();
