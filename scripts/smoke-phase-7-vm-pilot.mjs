/**
 * Phase 7 VM pilot smoke — RAG indexer + API chatbot health (no bearer required).
 *
 * Prerequisites on VM or laptop:
 *   pnpm infra:up
 *   pnpm db:seed
 *   RAG indexer on :8100 (pnpm rag:dev)
 *   POST http://127.0.0.1:8100/index/tenant/KMC (or tenant-all)
 *   pnpm --filter @enagar/api dev (or start)
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';
const RAG = process.env.RAG_INDEXER_URL ?? 'http://127.0.0.1:8100';
const TENANT = process.env.SMOKE_TENANT_CODE ?? 'KMC';

async function ragHealth() {
  const res = await fetch(`${RAG}/health`);
  if (!res.ok) throw new Error(`RAG health ${res.status}`);
  const body = await res.json();
  if (!body.postgres || !body.qdrant) {
    throw new Error(`RAG unhealthy: ${JSON.stringify(body)}`);
  }
  console.log('rag health:', body);
}

async function ragSearch() {
  const res = await fetch(`${RAG}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_code: TENANT,
      query: 'birth certificate apply',
      limit: 3,
    }),
  });
  if (!res.ok) throw new Error(`RAG search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const slug = data.hits?.[0]?.payload?.slug;
  console.log('rag top slug:', slug);
  if (!slug) throw new Error('RAG returned no hits — run POST /index/tenant-all');
}

async function apiChatbotLlmHealth() {
  const res = await fetch(`${API}/api/chatbot/llm/health`);
  if (res.status === 404) {
    console.warn('GET /api/chatbot/llm/health not found — older API build?');
    return;
  }
  if (!res.ok) throw new Error(`chatbot llm health ${res.status}: ${await res.text()}`);
  const body = await res.json();
  console.log('chatbot llm health:', body);
}

async function apiHealth() {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error(`API health ${res.status}`);
  console.log('api health: ok');
}

async function main() {
  await apiHealth();
  await ragHealth();
  await ragSearch();
  await apiChatbotLlmHealth();
  console.log('smoke-phase-7-vm-pilot: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
