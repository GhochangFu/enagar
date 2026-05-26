# enagar-rag-indexer (Phase 7.1)

Python service that indexes **published `kb_articles`** and **tenant service catalogue** rows into **per-tenant Qdrant collections** for Sahayak RAG.

## Stack

- Python 3.12 + Poetry
- FastAPI + uvicorn
- `sentence-transformers` — `paraphrase-multilingual-MiniLM-L12-v2` (384-dim, on-prem)
- `qdrant-client` — collections `kb_kmc`, `kb_hmc`, …
- `psycopg` — Postgres (`kb_articles`, `kb_index_jobs`, `tenant_services`)

## Run locally

```bash
pnpm infra:up
pnpm db:seed
cd services/rag-indexer
poetry install
poetry run uvicorn enagar_rag_indexer.main:app --reload --port 8100
```

### Without Poetry (Windows)

If `poetry` is not on your PATH, use the bundled script (Python 3.11+):

```powershell
cd services\rag-indexer
.\run-indexer.ps1
# or with auto-reload:
.\run-indexer.ps1 -Reload
```

Or install Poetry once: [python-poetry.org/docs/#installation](https://python-poetry.org/docs/#installation), then reopen the terminal.

## HTTP API

| Method | Path                    | Purpose                         |
| ------ | ----------------------- | ------------------------------- |
| GET    | `/health`               | Postgres + Qdrant reachability  |
| POST   | `/jobs/process`         | Drain `kb_index_jobs` queue     |
| POST   | `/index/tenant/{code}`  | Full reindex for one ULB        |
| POST   | `/index/tenant-all`     | Reindex all operational ULBs    |
| POST   | `/index/article/{uuid}` | Reindex one KB article          |
| GET    | `/benchmark/embeddings` | P50/P95 embed latency (ms)      |
| POST   | `/search`               | Dev semantic search (JSON body) |

## Smoke

```bash
node scripts/smoke-sprint-71-rag-indexer.mjs
```

## Sprint docs

- Plan: [`docs/runbooks/master-sprint-71-plan.md`](../../docs/runbooks/master-sprint-71-plan.md)
- KB corpus: [`docs/help/sahayak-kb-service-help.md`](../../docs/help/sahayak-kb-service-help.md)
