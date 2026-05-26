# Master Sprint 7.1 Exit — RAG indexer, Qdrant & embedding benchmark

**Status:** **closed — engineering** (2026-05-26). Sponsor sign-off optional.  
**Plan:** [`master-sprint-71-plan.md`](./master-sprint-71-plan.md)

## Delivered (engineering)

| ID    | Deliverable                                                                            | Evidence                                        |
| ----- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| D1–D7 | Python RAG indexer (`chunk` → `embed` → Qdrant), FastAPI routes, `kb_index_jobs` drain | `services/rag-indexer/src/enagar_rag_indexer/*` |
| D8    | Env vars `QDRANT_URL`, `RAG_INDEXER_PORT`                                              | `infrastructure/.env.example`                   |
| D9    | Security contract                                                                      | `tests/security/master-sprint-71.spec.ts`       |
| D10   | Smoke script                                                                           | `scripts/smoke-sprint-71-rag-indexer.mjs`       |
| D11   | Pytest (chunking + health/benchmark)                                                   | `services/rag-indexer/tests/`                   |

## Exit criteria

| ID  | Criterion                                   | Pass | Evidence                                             |
| --- | ------------------------------------------- | ---- | ---------------------------------------------------- |
| E1  | `ruff` / `mypy` / `pytest` in rag-indexer   | ✅   | `pytest` 4 passed locally; CI runs Poetry job        |
| E2  | Security spec                               | ✅   | `pnpm test:security -- master-sprint-71.spec.ts`     |
| E3  | `/health` Postgres + Qdrant flags           | ✅   | Smoke 2026-05-26                                     |
| E4  | `/jobs/process` drains Sahayak seed jobs    | ✅   | 67 jobs completed on first run; queue empty after    |
| E5  | `kb_kmc` Qdrant points ≥ 10                 | ✅   | **41** points after `/index/tenant/KMC`              |
| E6  | Bengali search → `help-services-birth-cert` | ✅   | Smoke `POST /search` top hit                         |
| E7  | `/benchmark/embeddings` P50/P95             | ✅   | e.g. P50 ~25 ms, P95 ~366 ms (5 samples, warm model) |

## Verification commands

```bash
pnpm infra:up
pnpm db:seed
cd services/rag-indexer && poetry install
poetry run uvicorn enagar_rag_indexer.main:app --port 8100
node scripts/smoke-sprint-71-rag-indexer.mjs
pnpm test:security -- --runTestsByPath tests/security/master-sprint-71.spec.ts
```

## Next

**Sprint 7.2** — `ILLMProvider` + OpenAI/Gemini/Ollama + PII redaction + audit ([`ROADMAP.md`](../../ROADMAP.md)).
