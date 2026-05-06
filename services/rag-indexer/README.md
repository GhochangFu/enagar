# enagar-rag-indexer — STUB (Phase 7)

The **only Python service** in the monorepo. Lives here because the embeddings + retrieval ecosystem is mature in Python and we want to keep the chatbot's RAG quality bench-marking close to industry standards.

## Stack

- **Python 3.12** + **Poetry**
- **FastAPI** (HTTP) + **uvicorn**
- **sentence-transformers** for multilingual embeddings (en/bn/hi)
- **qdrant-client** for vector upsert + retrieval
- **httpx** for async ingestion
- **pytest**, **ruff**, **mypy** for hygiene

## Workspace bridge

Turbo treats this folder as a workspace (via the lightweight `package.json` here) so `pnpm run lint` / `test` reach it. The real commands run through Poetry — see `package.json` script bodies.

```bash
cd services/rag-indexer
poetry install
poetry run uvicorn enagar_rag_indexer.main:app --reload --port 8000
poetry run pytest
```

## Status

Phase-0 stub. The real indexer (crawl / chunk / embed / upsert / re-rank) lands in Phase 7 alongside the chatbot service in `apps/api`.
