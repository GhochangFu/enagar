"""Qdrant per-tenant collections for KB chunks."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, cast

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from .config import Settings


@dataclass(frozen=True)
class ChunkPoint:
    point_id: str
    vector: list[float]
    payload: dict[str, Any]


def create_client(settings: Settings) -> QdrantClient:
    return QdrantClient(
        url=settings.qdrant_url,
        timeout=30,
        check_compatibility=False,
    )


def ping(client: QdrantClient) -> bool:
    try:
        client.get_collections()
        return True
    except Exception:
        return False


def ensure_collection(
    client: QdrantClient,
    collection_name: str,
    vector_size: int,
) -> None:
    exists = client.collection_exists(collection_name)
    if exists:
        return
    client.create_collection(
        collection_name=collection_name,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


def delete_article_points(
    client: QdrantClient,
    collection_name: str,
    article_id: str,
) -> None:
    if not client.collection_exists(collection_name):
        return
    client.delete(
        collection_name=collection_name,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="article_id",
                        match=qmodels.MatchValue(value=article_id),
                    ),
                ],
            ),
        ),
    )


def delete_source_points(
    client: QdrantClient,
    collection_name: str,
    source_type: str,
    source_key: str,
) -> None:
    if not client.collection_exists(collection_name):
        return
    client.delete(
        collection_name=collection_name,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="source_type",
                        match=qmodels.MatchValue(value=source_type),
                    ),
                    qmodels.FieldCondition(
                        key="source_key",
                        match=qmodels.MatchValue(value=source_key),
                    ),
                ],
            ),
        ),
    )


def upsert_points(
    client: QdrantClient,
    collection_name: str,
    points: list[ChunkPoint],
    vector_size: int,
) -> int:
    if not points:
        return 0
    ensure_collection(client, collection_name, vector_size)
    client.upsert(
        collection_name=collection_name,
        points=[
            qmodels.PointStruct(
                id=point.point_id,
                vector=point.vector,
                payload=point.payload,
            )
            for point in points
        ],
    )
    return len(points)


def search(
    client: QdrantClient,
    collection_name: str,
    vector: list[float],
    limit: int = 5,
) -> list[dict[str, Any]]:
    if not client.collection_exists(collection_name):
        return []
    if hasattr(client, "query_points"):
        response = client.query_points(
            collection_name=collection_name,
            query=vector,
            limit=limit,
            with_payload=True,
        )
        hits = response.points
    else:
        # Legacy qdrant-client API; stubs omit `.search` even though runtime may expose it.
        hits = cast(Any, client).search(
            collection_name=collection_name,
            query_vector=vector,
            limit=limit,
            with_payload=True,
        )
    return [
        {
            "score": hit.score,
            "payload": hit.payload or {},
        }
        for hit in hits
    ]


def point_id_for_chunk(
    tenant_id: str,
    source_type: str,
    source_id: str,
    locale: str,
    chunk_index: int,
) -> str:
    name = f"{tenant_id}:{source_type}:{source_id}:{locale}:{chunk_index}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, name))
