import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 7.1 — RAG indexer, Qdrant & embeddings', () => {
  const mainPy = readRepo('services/rag-indexer/src/enagar_rag_indexer/main.py');
  const indexerPy = readRepo('services/rag-indexer/src/enagar_rag_indexer/indexer.py');
  const qdrantPy = readRepo('services/rag-indexer/src/enagar_rag_indexer/qdrant_store.py');
  const embeddingsPy = readRepo('services/rag-indexer/src/enagar_rag_indexer/embeddings.py');
  const configPy = readRepo('services/rag-indexer/src/enagar_rag_indexer/config.py');
  const plan = readRepo('docs/runbooks/master-sprint-71-plan.md');
  const kbSeed = readRepo('apps/api/src/modules/kb/sahayak-service-help.seed.ts');

  it('ships FastAPI indexer routes for jobs, tenant index, benchmark, search', () => {
    expect(mainPy).toContain('/jobs/process');
    expect(mainPy).toContain('/index/tenant/{tenant_code}');
    expect(mainPy).toContain('/index/article/{article_id}');
    expect(mainPy).toContain('/benchmark/embeddings');
    expect(mainPy).toContain('/search');
    expect(mainPy).toContain('phase": "7.1"');
  });

  it('indexes kb_articles and service snapshots into per-tenant Qdrant collections', () => {
    expect(indexerPy).toContain('index_kb_article');
    expect(indexerPy).toContain('index_service_snapshots');
    expect(indexerPy).toContain('process_index_jobs');
    expect(qdrantPy).toContain('collection_name_for_tenant');
    expect(configPy).toContain('kb_');
  });

  it('uses on-prem multilingual MiniLM embeddings', () => {
    expect(configPy).toContain('paraphrase-multilingual-MiniLM-L12-v2');
    expect(embeddingsPy).toContain('normalize_embeddings=True');
    expect(embeddingsPy).toContain('benchmark_encode');
  });

  it('has sprint plan and Sahayak KB seed corpus for indexing', () => {
    expect(plan).toContain('Sprint 7.1');
    expect(kbSeed).toContain('seedSahayakServiceHelpArticles');
    expect(kbSeed).toContain('help-services-');
  });
});
