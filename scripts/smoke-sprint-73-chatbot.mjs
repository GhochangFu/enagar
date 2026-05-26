/**
 * Sprint 7.3 smoke — RAG search + chatbot SSE query (requires API + rag-indexer).
 *
 * Prerequisites:
 *   pnpm infra:up && pnpm db:seed
 *   poetry run uvicorn enagar_rag_indexer.main:app --port 8100
 *   pnpm --filter @enagar/api dev
 *   CHATBOT_DPA_SKIP_DEV=true (or tenants.config.chatbot.dpa_signed in seed)
 *
 * Optional auth (dev JWT from Keycloak seed):
 *   SMOKE_CHATBOT_BEARER=eyJ...
 *   SMOKE_TENANT_CODE=KMC
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const RAG = process.env.RAG_INDEXER_URL ?? 'http://127.0.0.1:8100';
const TENANT = process.env.SMOKE_TENANT_CODE ?? 'KMC';
const QUERY = process.env.SMOKE_CHATBOT_QUERY ?? 'আমি কীভাবে জন্ম সার্টিফিকেট পাবো?';

async function ragSearch() {
  const res = await fetch(`${RAG}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_code: TENANT, query: QUERY, limit: 3 }),
  });
  if (!res.ok) throw new Error(`RAG search ${res.status}`);
  const data = await res.json();
  const topSlug = data.hits?.[0]?.payload?.slug;
  console.log('rag top slug:', topSlug);
  if (topSlug !== 'help-services-birth-cert') {
    throw new Error(`Expected help-services-birth-cert, got ${topSlug}`);
  }
}

async function chatbotSse() {
  const token = process.env.SMOKE_CHATBOT_BEARER;
  if (!token) {
    console.warn('SMOKE_CHATBOT_BEARER not set — skipping authenticated SSE query');
    return;
  }

  const res = await fetch(`${API}/api/chatbot/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-enagar-tenant-code': TENANT,
    },
    body: JSON.stringify({
      message: QUERY,
      session_id: `smoke-${Date.now()}`,
      language: 'bn',
    }),
  });

  if (!res.ok) {
    throw new Error(`chatbot/query ${res.status}: ${await res.text()}`);
  }

  const text = await res.text();
  console.log('sse bytes:', text.length);
  if (!text.includes('event: meta')) throw new Error('Missing meta event');
  if (!text.includes('help-services-birth-cert') && !text.includes('event: token')) {
    console.warn('citation slug not in stream (LLM may be offline)');
  }
  if (!text.includes('event: done') && !text.includes('event: error')) {
    throw new Error('Missing terminal SSE event');
  }
}

async function main() {
  await ragSearch();
  await chatbotSse();
  console.log('smoke-sprint-73-chatbot: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
