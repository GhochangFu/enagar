/**
 * Sprint 7.1 smoke — RAG indexer health, job drain, Qdrant points, Bengali search.
 *
 * Prerequisites:
 *   pnpm infra:up
 *   pnpm db:seed
 *   cd services/rag-indexer && poetry install && poetry run uvicorn enagar_rag_indexer.main:app --port 8100
 */
const BASE = process.env.RAG_INDEXER_URL ?? 'http://127.0.0.1:8100';
const QDRANT = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return data;
}

async function qdrantCount(collection) {
  const res = await fetch(`${QDRANT}/collections/${collection}`);
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`Qdrant ${collection}: ${res.status}`);
  const data = await res.json();
  return data?.result?.points_count ?? 0;
}

async function main() {
  const health = await json('GET', '/health');
  console.log('health:', health);
  if (!health.postgres) throw new Error('Postgres not reachable from indexer');
  if (!health.qdrant) throw new Error('Qdrant not reachable from indexer');

  const bench = await json('GET', '/benchmark/embeddings?samples=5');
  console.log('benchmark:', bench);

  const jobs = await json('POST', '/jobs/process?limit=100');
  console.log('jobs:', jobs);

  const kmc = await json('POST', '/index/tenant/KMC');
  console.log('index KMC:', kmc);

  const points = await qdrantCount('kb_kmc');
  console.log('qdrant kb_kmc points:', points);
  if (points < 10) {
    throw new Error(`Expected kb_kmc points >= 10, got ${points}`);
  }

  const search = await json('POST', '/search', {
    tenant_code: 'KMC',
    query: 'আমি কীভাবে জন্ম সার্টিফিকেট পাবো?',
    limit: 3,
  });
  console.log('search hits:', search.hits?.map((h) => h.payload?.slug));
  const topSlug = search.hits?.[0]?.payload?.slug;
  if (topSlug !== 'help-services-birth-cert') {
    throw new Error(`Expected top hit help-services-birth-cert, got ${topSlug}`);
  }

  console.log('smoke-sprint-71-rag-indexer: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
