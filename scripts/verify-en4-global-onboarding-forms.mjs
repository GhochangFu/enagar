/**
 * EN-4 — global form templates + onboarding auto-publish smoke.
 *
 * Usage (repo root, after wizard onboard of TENANT_CODE):
 *   node scripts/verify-en4-global-onboarding-forms.mjs
 *   TENANT_CODE=EN4T RICH_SERVICE_CODE=birth-cert node scripts/verify-en4-global-onboarding-forms.mjs
 */
const API = (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const TENANT_CODE = (process.env.TENANT_CODE ?? 'EN4T').trim().toUpperCase();
const RICH_SERVICE_CODE = (process.env.RICH_SERVICE_CODE ?? 'birth-cert').trim();
const MIN_RICH_FIELDS = Number(process.env.EN4_MIN_RICH_FIELDS ?? '3');

function fail(message) {
  console.error(`EN-4 verify FAIL: ${message}`);
  process.exit(1);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    const detail = typeof json === 'object' && json?.message ? JSON.stringify(json.message) : text;
    fail(`${url} → HTTP ${response.status}: ${detail}`);
  }
  return json;
}

function countInputFields(formSchema) {
  if (!formSchema || typeof formSchema !== 'object' || !Array.isArray(formSchema.fields)) {
    return 0;
  }
  return formSchema.fields.filter(
    (field) => field && typeof field === 'object' && field.type && field.type !== 'section',
  ).length;
}

async function main() {
  console.log(`EN-4 verify → API ${API}, tenant ${TENANT_CODE}, rich service ${RICH_SERVICE_CODE}`);

  const serviceList = await fetchJson(`${API}/api/services/tenants/${TENANT_CODE}`);
  if (!Array.isArray(serviceList)) {
    fail(`GET /api/services/tenants/${TENANT_CODE} did not return an array`);
  }
  if (serviceList.length < 1) {
    fail(`No published services for ${TENANT_CODE}`);
  }
  console.log(`OK ${serviceList.length} service(s) visible to citizens`);

  const detail = await fetchJson(
    `${API}/api/services/tenants/${TENANT_CODE}/${encodeURIComponent(RICH_SERVICE_CODE)}`,
  );
  const fieldCount = countInputFields(detail?.form_schema);
  if (fieldCount < MIN_RICH_FIELDS) {
    fail(
      `${RICH_SERVICE_CODE} form has ${fieldCount} input field(s); expected >= ${MIN_RICH_FIELDS} (global template not copied?)`,
    );
  }
  console.log(`OK ${RICH_SERVICE_CODE} published form has ${fieldCount} input field(s)`);

  console.log('EN-4 verify PASS');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
