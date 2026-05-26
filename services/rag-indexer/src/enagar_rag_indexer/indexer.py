"""Index KB articles and service snapshots into Qdrant."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient

from .chunking import chunk_text
from .config import Settings, collection_name_for_tenant
from .db import (
    KbArticleRow,
    ServiceSnapshotRow,
    complete_kb_index_job,
    connect,
    fail_kb_index_job,
    get_kb_article,
    get_tenant_by_code,
    list_operational_tenants,
    list_published_kb_articles,
    list_service_snapshots,
)
from .embeddings import encode_texts
from .qdrant_store import (
    ChunkPoint,
    create_client,
    delete_article_points,
    delete_source_points,
    point_id_for_chunk,
    upsert_points,
)


@dataclass(frozen=True)
class IndexStats:
    articles_indexed: int
    chunks_upserted: int
    services_indexed: int


@dataclass(frozen=True)
class JobProcessResult:
    processed: int
    completed: int
    failed: int
    errors: list[str]


def _locale_text(record: dict[str, Any], locale: str) -> str:
    value = record.get(locale)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ""


def _article_chunks(
    settings: Settings,
    article: KbArticleRow,
) -> list[tuple[str, str, int, str]]:
    """Return tuples of (locale, chunk_text, chunk_index, title)."""
    output: list[tuple[str, str, int, str]] = []
    for locale in ("en", "bn", "hi"):
        body = _locale_text(article.body, locale)
        title = _locale_text(article.title, locale) or article.slug
        if not body:
            continue
        prefix = f"# {title}\n\n"
        for chunk in chunk_text(
            prefix + body,
            settings.chunk_size_chars,
            settings.chunk_overlap_chars,
        ):
            output.append((locale, chunk.text, chunk.index, title))
    return output


def index_kb_article(
    settings: Settings,
    client: QdrantClient,
    article: KbArticleRow,
) -> int:
    if article.status != "published":
        return 0

    collection = collection_name_for_tenant(article.tenant_code)
    delete_article_points(client, collection, article.id)

    tuples = _article_chunks(settings, article)
    if not tuples:
        return 0

    texts = [item[1] for item in tuples]
    vectors = encode_texts(settings.embedding_model, texts)
    points: list[ChunkPoint] = []
    for (locale, text, chunk_index, title), vector in zip(tuples, vectors, strict=True):
        points.append(
            ChunkPoint(
                point_id=point_id_for_chunk(
                    article.tenant_id,
                    "kb_article",
                    article.id,
                    locale,
                    chunk_index,
                ),
                vector=vector,
                payload={
                    "tenant_id": article.tenant_id,
                    "tenant_code": article.tenant_code,
                    "article_id": article.id,
                    "slug": article.slug,
                    "locale": locale,
                    "chunk_index": chunk_index,
                    "title": title,
                    "text": text,
                    "tags": article.tags,
                    "source_type": "kb_article",
                    "source_key": article.slug,
                },
            ),
        )

    return upsert_points(client, collection, points, settings.vector_size)


def _service_markdown(service: ServiceSnapshotRow) -> str:
    name_en = _locale_text(service.name, "en") or service.service_code
    desc_en = _locale_text(service.description, "en")
    fee = service.fee_config
    sla = (
        f"{service.sla_days} working days"
        if service.sla_days is not None
        else "instant / payment flow"
    )
    active = "active" if service.is_active else "inactive"
    return (
        f"# Service: {name_en} ({service.service_code})\n\n"
        f"Status: {active}\n\n"
        f"{desc_en}\n\n"
        f"Fee config: {fee}\n\n"
        f"SLA: {sla}\n"
    )


def index_service_snapshots(
    settings: Settings,
    client: QdrantClient,
    tenant_id: str,
    tenant_code: str,
    services: list[ServiceSnapshotRow],
) -> int:
    collection = collection_name_for_tenant(tenant_code)
    total = 0
    for service in services:
        source_key = f"service:{service.service_code}"
        delete_source_points(client, collection, "service_snapshot", source_key)
        markdown = _service_markdown(service)
        chunks = chunk_text(
            markdown,
            settings.chunk_size_chars,
            settings.chunk_overlap_chars,
        )
        if not chunks:
            continue
        texts = [chunk.text for chunk in chunks]
        vectors = encode_texts(settings.embedding_model, texts)
        points: list[ChunkPoint] = []
        for chunk, vector in zip(chunks, vectors, strict=True):
            points.append(
                ChunkPoint(
                    point_id=point_id_for_chunk(
                        tenant_id,
                        "service_snapshot",
                        source_key,
                        "en",
                        chunk.index,
                    ),
                    vector=vector,
                    payload={
                        "tenant_id": tenant_id,
                        "tenant_code": tenant_code,
                        "article_id": None,
                        "slug": source_key,
                        "locale": "en",
                        "chunk_index": chunk.index,
                        "title": _locale_text(service.name, "en") or service.service_code,
                        "text": chunk.text,
                        "tags": ["service_snapshot", service.service_code],
                        "source_type": "service_snapshot",
                        "source_key": source_key,
                        "service_active": service.is_active,
                    },
                ),
            )
        total += upsert_points(client, collection, points, settings.vector_size)
    return total


def index_tenant(settings: Settings, tenant_code: str) -> IndexStats:
    client = create_client(settings)
    with connect(settings.database_url) as conn:
        tenant = get_tenant_by_code(conn, tenant_code)
        if not tenant:
            raise ValueError(f"Unknown tenant code: {tenant_code}")
        articles = list_published_kb_articles(conn, tenant.id)
        services = list_service_snapshots(conn, tenant.id)

    chunks = 0
    for article in articles:
        chunks += index_kb_article(settings, client, article)
    service_chunks = index_service_snapshots(settings, client, tenant.id, tenant.code, services)
    return IndexStats(
        articles_indexed=len(articles),
        chunks_upserted=chunks + service_chunks,
        services_indexed=len(services),
    )


def index_all_tenants(settings: Settings) -> dict[str, IndexStats]:
    client = create_client(settings)
    with connect(settings.database_url) as conn:
        tenants = list_operational_tenants(conn)
        articles = list_published_kb_articles(conn)

    by_tenant: dict[str, list[KbArticleRow]] = {}
    for article in articles:
        by_tenant.setdefault(article.tenant_code, []).append(article)

    results: dict[str, IndexStats] = {}
    for tenant in tenants:
        tenant_articles = by_tenant.get(tenant.code, [])
        chunk_total = 0
        for article in tenant_articles:
            chunk_total += index_kb_article(settings, client, article)
        with connect(settings.database_url) as conn:
            services = list_service_snapshots(conn, tenant.id)
        service_chunks = index_service_snapshots(
            settings,
            client,
            tenant.id,
            tenant.code,
            services,
        )
        results[tenant.code] = IndexStats(
            articles_indexed=len(tenant_articles),
            chunks_upserted=chunk_total + service_chunks,
            services_indexed=len(services),
        )
    return results


def index_article_by_id(settings: Settings, article_id: str) -> int:
    client = create_client(settings)
    with connect(settings.database_url) as conn:
        article = get_kb_article(conn, article_id)
    if not article:
        raise ValueError(f"KB article not found: {article_id}")
    return index_kb_article(settings, client, article)


def process_index_jobs(settings: Settings, batch_limit: int | None = None) -> JobProcessResult:
    client = create_client(settings)
    from .db import claim_kb_index_jobs

    limit = batch_limit if batch_limit is not None else settings.job_batch_limit
    with connect(settings.database_url) as conn:
        jobs = claim_kb_index_jobs(conn, limit)

    completed = 0
    failed = 0
    errors: list[str] = []
    for job in jobs:
        try:
            with connect(settings.database_url) as conn:
                article = get_kb_article(conn, job.article_id)
            if not article:
                raise ValueError("article missing")
            index_kb_article(settings, client, article)
            with connect(settings.database_url) as conn:
                complete_kb_index_job(conn, job.id)
            completed += 1
        except Exception as exc:  # noqa: BLE001 — job failure must not abort batch
            message = f"{job.id}: {exc}"
            errors.append(message)
            with connect(settings.database_url) as conn:
                fail_kb_index_job(conn, job.id, message)
            failed += 1

    return JobProcessResult(
        processed=len(jobs),
        completed=completed,
        failed=failed,
        errors=errors,
    )
