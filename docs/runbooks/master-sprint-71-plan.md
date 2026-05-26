# Master Sprint 7.1 Plan — RAG indexer, Qdrant & embedding benchmark

**Status:** **Closed — engineering** (2026-05-26) · Exit: [`master-sprint-71-exit.md`](./master-sprint-71-exit.md)  
**Phase:** 7 — Sahayak AI · [`ROADMAP.md`](../../ROADMAP.md) § Phase 7  
**Depends on:** KB articles seeded ([`docs/help/sahayak-kb-service-help.md`](../help/sahayak-kb-service-help.md)), Qdrant in `infrastructure/docker-compose.yml`, Sprint 6.11 `kb_index_jobs` table

## Objective

Ship a working **on-prem RAG indexing pipeline**: read published `kb_articles` (+ tenant service catalogue snapshot) from Postgres, chunk and embed with **paraphrase-multilingual-MiniLM-L12-v2**, upsert into **per-tenant Qdrant collections**, and drain **`kb_index_jobs`**.

## Deliverables

| #   | Deliverable                                                                                                 | Location                                                |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| D1  | Config (Postgres, Qdrant, chunk sizes, model name)                                                          | `services/rag-indexer/src/enagar_rag_indexer/config.py` |
| D2  | Postgres loaders + job claim/complete                                                                       | `db.py`                                                 |
| D3  | Chunker (~500 token / 50 overlap)                                                                           | `chunking.py`                                           |
| D4  | Embedding model wrapper + benchmark                                                                         | `embeddings.py`                                         |
| D5  | Qdrant collection per tenant `kb_<code>`                                                                    | `qdrant_store.py`                                       |
| D6  | Indexer orchestration (article, tenant, jobs)                                                               | `indexer.py`                                            |
| D7  | FastAPI: `/health`, `/jobs/process`, `/index/tenant/{code}`, `/index/article/{id}`, `/benchmark/embeddings` | `main.py`                                               |
| D8  | Env examples                                                                                                | `infrastructure/.env.example`                           |
| D9  | Security contract spec                                                                                      | `tests/security/master-sprint-71.spec.ts`               |
| D10 | Smoke script                                                                                                | `scripts/smoke-sprint-71-rag-indexer.mjs`               |
| D11 | Unit tests                                                                                                  | `services/rag-indexer/tests/`                           |

## Out of scope (Sprint 7.2+)

- LLM providers, chatbot API, PII redaction, citizen UI
- PDF/DOCX loaders (KB is markdown JSON today)
- BM25 rerank (retrieval consumer in 7.3)
- Nightly cron container (manual/`/jobs/process` for 7.1)

## Exit criteria

| ID  | Criterion                                                                         | Verification         |
| --- | --------------------------------------------------------------------------------- | -------------------- |
| E1  | `poetry run ruff check` + `mypy` + `pytest` green in `services/rag-indexer`       | CI Python job        |
| E2  | `pnpm test:security -- master-sprint-71.spec.ts` green                            | Repo root            |
| E3  | `/health` reports Postgres + Qdrant reachability when infra up                    | `curl :8000/health`  |
| E4  | `POST /jobs/process` completes queued `kb_index_jobs` from Sahayak seed           | Smoke script         |
| E5  | Qdrant collection `kb_kmc` has points with payload `article_id`, `slug`, `locale` | Qdrant REST or smoke |
| E6  | Bengali query embedding + search returns `help-services-birth-cert` chunk for KMC | Smoke search step    |
| E7  | `/benchmark/embeddings` documents P50/P95 ms per encode (≥10 samples)             | Smoke / manual       |

## Verification commands

```bash
pnpm infra:up
cd services/rag-indexer && poetry install
poetry run uvicorn enagar_rag_indexer.main:app --port 8100
# another terminal:
node scripts/smoke-sprint-71-rag-indexer.mjs
pnpm test:security -- --runTestsByPath tests/security/master-sprint-71.spec.ts
```
