/**
 * Service Setup Assistant smoke — session create + readiness (+ optional SSE message).
 *
 * Prerequisites:
 *   pnpm infra:up && pnpm db:seed
 *   pnpm --filter @enagar/api prisma:migrate:deploy
 *   pnpm --filter @enagar/api dev
 *   SETUP_ASSISTANT_SKIP_DPA_DEV=true (local dev)
 *
 * Auth (Keycloak tenant admin JWT):
 *   SMOKE_SETUP_ASSISTANT_BEARER=eyJ...
 *   SMOKE_TENANT_CODE=KMC
 *   SMOKE_SETUP_ASSISTANT_SERVICE_ID=<tenant-service-uuid>
 *
 * Optional LLM message check:
 *   SMOKE_SETUP_ASSISTANT_CHAT=true
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const TENANT = process.env.SMOKE_TENANT_CODE ?? 'KMC';
const BEARER = process.env.SMOKE_SETUP_ASSISTANT_BEARER;
const SERVICE_ID = process.env.SMOKE_SETUP_ASSISTANT_SERVICE_ID;
const CHAT = process.env.SMOKE_SETUP_ASSISTANT_CHAT === 'true';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${BEARER}`,
    'x-enagar-tenant-code': TENANT,
  };
}

async function createSession() {
  if (!SERVICE_ID) {
    throw new Error('SMOKE_SETUP_ASSISTANT_SERVICE_ID is required when bearer is set');
  }
  const res = await fetch(
    `${API}/api/admin/tenant/services/${SERVICE_ID}/setup-assistant/sessions`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ scope: 'form' }),
    },
  );
  if (!res.ok) {
    throw new Error(`create session ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.id) throw new Error('session id missing');
  if (body.scope !== 'form') throw new Error(`expected form scope, got ${body.scope}`);
  if (body.current_step !== 2) throw new Error(`expected step 2, got ${body.current_step}`);
  console.log('session:', body.id);
  return body.id;
}

async function getSession(sessionId) {
  const res = await fetch(
    `${API}/api/admin/tenant/services/${SERVICE_ID}/setup-assistant/sessions/${sessionId}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    throw new Error(`get session ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (body.session.id !== sessionId) throw new Error('session id mismatch');
  if (!Array.isArray(body.checklist.items)) throw new Error('checklist missing');
  console.log('checklist items:', body.checklist.items.length);
}

async function postMessage(sessionId) {
  const res = await fetch(
    `${API}/api/admin/tenant/services/${SERVICE_ID}/setup-assistant/sessions/${sessionId}/message`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: 'Add a short text field applicant_name for applicant full name' }),
    },
  );
  if (!res.ok) {
    throw new Error(`post message ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  console.log('sse bytes:', text.length);
  if (!text.includes('event: meta')) throw new Error('Missing meta SSE event');
  if (!text.includes('event: done') && !text.includes('event: error')) {
    throw new Error('Missing terminal SSE event');
  }
}

async function main() {
  if (!BEARER) {
    console.warn('SMOKE_SETUP_ASSISTANT_BEARER not set — skipping authenticated API checks');
    console.log('smoke-service-setup-assistant: OK (skipped)');
    return;
  }

  const sessionId = await createSession();
  await getSession(sessionId);
  if (CHAT) {
    await postMessage(sessionId);
  } else {
    console.warn('SMOKE_SETUP_ASSISTANT_CHAT not true — skipping SSE message');
  }
  console.log('smoke-service-setup-assistant: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
