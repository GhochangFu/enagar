"""FastAPI entrypoint — Phase 7.1 RAG indexer."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .config import Settings, collection_name_for_tenant
from .db import ping as db_ping
from .embeddings import benchmark_encode, encode_texts
from .indexer import (
    index_all_tenants,
    index_article_by_id,
    index_tenant,
    process_index_jobs,
)
from .qdrant_store import create_client, ping as qdrant_ping, search

app = FastAPI(
    title="eNagarSeba RAG Indexer",
    version="7.1.0",
    description="Chunk, embed, and upsert KB + service catalogue into per-tenant Qdrant collections.",
)


class SearchRequest(BaseModel):
    tenant_code: str
    query: str = Field(min_length=3, max_length=2000)
    limit: int = Field(default=5, ge=1, le=20)


@app.get("/health")
def health() -> dict[str, Any]:
    settings = Settings.from_env()
    client = create_client(settings)
    return {
        "status": "ok",
        "service": "enagar-rag-indexer",
        "phase": "7.1",
        "postgres": db_ping(settings.database_url),
        "qdrant": qdrant_ping(client),
        "embedding_model": settings.embedding_model,
        "chunk_size_chars": settings.chunk_size_chars,
    }


@app.post("/jobs/process")
def jobs_process(limit: int | None = Query(default=None, ge=1, le=200)) -> dict[str, Any]:
    settings = Settings.from_env()
    result = process_index_jobs(settings, batch_limit=limit)
    return {
        "processed": result.processed,
        "completed": result.completed,
        "failed": result.failed,
        "errors": result.errors,
    }


@app.post("/index/tenant/{tenant_code}")
def index_tenant_route(tenant_code: str) -> dict[str, Any]:
    settings = Settings.from_env()
    try:
        stats = index_tenant(settings, tenant_code.upper())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "tenant_code": tenant_code.upper(),
        "collection": collection_name_for_tenant(tenant_code),
        "articles_indexed": stats.articles_indexed,
        "chunks_upserted": stats.chunks_upserted,
        "services_indexed": stats.services_indexed,
    }


@app.post("/index/tenant-all")
def index_all_route() -> dict[str, Any]:
    settings = Settings.from_env()
    results = index_all_tenants(settings)
    return {
        tenant: {
            "articles_indexed": stats.articles_indexed,
            "chunks_upserted": stats.chunks_upserted,
            "services_indexed": stats.services_indexed,
        }
        for tenant, stats in results.items()
    }


@app.post("/index/article/{article_id}")
def index_article_route(article_id: str) -> dict[str, Any]:
    settings = Settings.from_env()
    try:
        chunks = index_article_by_id(settings, article_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"article_id": article_id, "chunks_upserted": chunks}


@app.get("/benchmark/embeddings")
def benchmark_route(samples: int = Query(default=10, ge=1, le=50)) -> dict[str, Any]:
    settings = Settings.from_env()
    return benchmark_encode(settings.embedding_model, samples)


@app.post("/search")
def search_route(body: SearchRequest) -> dict[str, Any]:
    """Dev-only semantic search against a tenant collection."""
    settings = Settings.from_env()
    client = create_client(settings)
    vector = encode_texts(settings.embedding_model, [body.query])[0]
    collection = collection_name_for_tenant(body.tenant_code)
    hits = search(client, collection, vector, body.limit)
    return {"tenant_code": body.tenant_code.upper(), "collection": collection, "hits": hits}
