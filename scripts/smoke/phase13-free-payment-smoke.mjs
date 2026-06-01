/**
 * Phase 13E smoke — free service: submit without any fee line or payment.
 *
 * Prereq: API :3001, Keycloak :8080, seeded KMC sanitation-grievance
 *
 * Usage: pnpm smoke:phase13-free
 */
import {
  assertApiHealthy,
  assertOk,
  citizenToken,
  loadInfraEnv,
  makeLogger,
  registerCitizen,
  api,
  TENANT,
} from './lib/phase13-smoke-lib.mjs';

loadInfraEnv();
const { log, fail } = makeLogger('phase13-free');

const SERVICE_CODE = process.env.PHASE13_FREE_SERVICE ?? 'sanitation-grievance';

async function main() {
  log('start', `${SERVICE_CODE} free submit`);
  await assertApiHealthy(fail);

  const { res: servicesRes, json: services, text: servicesText } = await api(
    'GET',
    `/services/tenants/${TENANT}`,
    null,
  );
  assertOk(fail, 'catalogue', servicesRes.status, servicesText);
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(`Service ${SERVICE_CODE} missing on ${TENANT}`);
  if (service.fee_type !== 'free') {
    fail(`Expected fee_type free, got ${service.fee_type}`);
  }

  const citizenMobile = process.env.PHASE13_CITIZEN_MOBILE ?? '9876501801';
  const token = await citizenToken(fail, citizenMobile);
  await registerCitizen(fail, token, citizenMobile, 'Phase13 Free Smoke');

  const { res: draftRes, json: draft, text: draftText } = await api(
    'POST',
    '/applications/drafts',
    token,
    {
      service_code: SERVICE_CODE,
      form_data: {
        applicant_name: 'Phase13 Free Smoke',
        grievance_description: 'Garbage not collected for three days on Pilot Lane.',
      },
    },
    { 'x-enagar-tenant-code': TENANT },
  );
  assertOk(fail, 'draft', draftRes.status, draftText);
  if (draft.payment_status !== 'not_required') {
    fail(`free draft rollup should be not_required, got ${draft.payment_status}`);
  }

  const preview = service.fee_line_previews?.application;
  if (typeof preview === 'number' && preview > 0) {
    fail(`free service should not expose payable application preview, got ${preview}`);
  }

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
  if (submitted.payment_status !== 'not_required') {
    fail(`submitted free app rollup should stay not_required, got ${submitted.payment_status}`);
  }

  log('done', submitted.docket_no);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
