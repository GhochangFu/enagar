/**
 * Phase 13E smoke — deferred_only: submit without upfront pay; approval line seeded.
 *
 * Prereq: API :3001, Keycloak :8080, seeded KMC ad-hoarding
 *
 * Usage: pnpm smoke:phase13-deferred
 */
import { uploadCleanDocument } from './lib/document-smoke-lib.mjs';
import {
  assertApiHealthy,
  assertOk,
  citizenToken,
  expectSchedule,
  loadInfraEnv,
  makeLogger,
  registerCitizen,
  api,
} from './lib/phase13-smoke-lib.mjs';

loadInfraEnv();
const { log, fail } = makeLogger('phase13-deferred');

const SERVICE_CODE = process.env.PHASE13_DEFERRED_SERVICE ?? 'ad-hoarding';
const TENANT = 'KMC';

function hoardingFormData(mobile) {
  return {
    applicant_name: 'Phase13 Deferred Smoke',
    site_address: '42 Smoke Road, Kolkata',
    hoarding_dimensions: '8ft x 6ft',
    mobile,
    site_photo: { name: 'site.jpg', mime_type: 'image/jpeg', size_mb: 0.01 },
    creative_mock: { name: 'creative.pdf', mime_type: 'application/pdf', size_mb: 0.01 },
  };
}

async function main() {
  log('start', `${SERVICE_CODE} deferred-only submit without pay`);
  await assertApiHealthy(fail);

  const { res: servicesRes, json: services, text: servicesText } = await api(
    'GET',
    `/services/tenants/${TENANT}`,
    null,
  );
  assertOk(fail, 'catalogue', servicesRes.status, servicesText);
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(`Service ${SERVICE_CODE} missing on ${TENANT}`);
  const schedule = service.payment_schedule ?? 'deferred_only';
  if (schedule !== 'deferred_only') {
    fail(`Expected payment_schedule deferred_only, got ${schedule}`);
  }

  const citizenMobile = process.env.PHASE13_CITIZEN_MOBILE ?? '9876501702';
  const token = await citizenToken(fail, citizenMobile);
  await registerCitizen(fail, token, citizenMobile, 'Phase13 Deferred Smoke');

  const { res: draftRes, json: draft, text: draftText } = await api(
    'POST',
    '/applications/drafts',
    token,
    { service_code: SERVICE_CODE, form_data: hoardingFormData(citizenMobile) },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(fail, 'draft', draftRes.status, draftText);
  expectSchedule(fail, draft, schedule);

  if (draft.fee_settlement?.application) {
    fail(`deferred draft must not seed application fee line: ${JSON.stringify(draft.fee_settlement)}`);
  }
  if (draft.fee_settlement?.approval?.status !== 'not_required') {
    fail(`approval line not seeded: ${JSON.stringify(draft.fee_settlement)}`);
  }
  if (draft.payment_status !== 'not_required') {
    fail(`expected rollup not_required on draft, got ${draft.payment_status}`);
  }
  log('draft', 'schedule-driven defaults verified');

  await uploadCleanDocument(api, (label, status, text) => assertOk(fail, label, status, text), token, draft.id, {
    documentCode: 'site_photo',
    originalName: 'site.jpg',
    mimeType: 'image/jpeg',
    scanProvider: 'phase13-deferred-smoke',
    tenantCode: TENANT,
  });
  await uploadCleanDocument(api, (label, status, text) => assertOk(fail, label, status, text), token, draft.id, {
    documentCode: 'creative_mock',
    originalName: 'creative.pdf',
    scanProvider: 'phase13-deferred-smoke',
    tenantCode: TENANT,
  });
  log('documents', 'site_photo + creative_mock scan-clean');

  const { res: submitRes, json: submitted, text: submitText } = await api(
    'POST',
    `/applications/${draft.id}/submit`,
    token,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(fail, 'submit without pay', submitRes.status, submitText);
  if (submitted.status === 'draft') {
    fail('application still draft after submit');
  }
  if (submitted.fee_settlement?.approval?.status !== 'not_required') {
    fail(`approval line changed unexpectedly: ${JSON.stringify(submitted.fee_settlement)}`);
  }

  const { res: detailRes, json: detail, text: detailText } = await api(
    'GET',
    `/applications/${encodeURIComponent(submitted.docket_no)}`,
    token,
    undefined,
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(fail, 'detail after submit', detailRes.status, detailText);
  if (!detail.payment_schedule) {
    fail('hydrated detail missing payment_schedule');
  }
  if (!detail.fee_settlement?.approval) {
    fail('hydrated detail missing approval fee_settlement line');
  }

  log('done', submitted.docket_no);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
