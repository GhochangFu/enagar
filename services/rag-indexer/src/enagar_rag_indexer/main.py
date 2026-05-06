"""FastAPI entrypoint — Phase-0 placeholder.

Phase 7 implements the actual indexer:
    1. Crawl/ingest government source PDFs, CSVs, HTML pages.
    2. Chunk + extract metadata (citation URL, last-updated).
    3. Embed via sentence-transformers (multilingual).
    4. Upsert into Qdrant with tenant-scoped collections.
    5. Re-rank hits before they reach the chatbot service.
"""
from fastapi import FastAPI

app = FastAPI(
    title="eNagarSeba RAG Indexer",
    version="0.0.0",
    description="Phase-0 stub. Real indexer arrives in Phase 7.",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — kept lightweight (no Qdrant ping in Phase 0)."""
    return {"status": "ok", "service": "enagar-rag-indexer", "phase": "phase-0"}
