"""Postgres access for KB articles, index jobs, and service snapshots."""
from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger(__name__)

# Prisma supports DATABASE_URL query parameters that libpq (and therefore
# psycopg) rejects — most notably `?schema=public`, which is set by the project's
# canonical infrastructure/.env. Strip these so the indexer can consume the same
# DATABASE_URL the Node/Prisma side uses, unchanged.
_PRISMA_ONLY_QUERY_PARAMS = frozenset({"schema", "pgbouncer", "connection_limit"})


def _sanitize_database_url(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url
    filtered = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key not in _PRISMA_ONLY_QUERY_PARAMS
    ]
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(filtered), parts.fragment),
    )


@dataclass(frozen=True)
class TenantRow:
    id: str
    code: str
    name: str


@dataclass(frozen=True)
class KbArticleRow:
    id: str
    tenant_id: str
    tenant_code: str
    slug: str
    title: dict[str, str]
    body: dict[str, str]
    tags: list[str]
    status: str


@dataclass(frozen=True)
class KbIndexJobRow:
    id: str
    tenant_id: str
    article_id: str
    trigger: str


@dataclass(frozen=True)
class ServiceSnapshotRow:
    tenant_id: str
    tenant_code: str
    service_code: str
    name: dict[str, Any]
    description: dict[str, Any]
    fee_config: dict[str, Any]
    sla_days: int | None
    is_active: bool


@contextmanager
def connect(database_url: str) -> Iterator[psycopg.Connection[Any]]:
    with psycopg.connect(_sanitize_database_url(database_url), row_factory=dict_row) as conn:
        yield conn


def ping(database_url: str) -> bool:
    try:
        with connect(database_url) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception as exc:
        logger.warning("Postgres ping failed: %s", exc)
        return False


def list_operational_tenants(conn: psycopg.Connection[Any]) -> list[TenantRow]:
    rows = conn.execute(
        """
        SELECT id::text, code, name
        FROM tenants
        WHERE is_active = TRUE AND code <> 'WBPORTAL'
        ORDER BY code
        """,
    ).fetchall()
    return [TenantRow(id=row["id"], code=row["code"], name=row["name"]) for row in rows]


def get_tenant_by_code(conn: psycopg.Connection[Any], tenant_code: str) -> TenantRow | None:
    row = conn.execute(
        """
        SELECT id::text, code, name
        FROM tenants
        WHERE code = %s AND is_active = TRUE
        """,
        (tenant_code,),
    ).fetchone()
    if not row:
        return None
    return TenantRow(id=row["id"], code=row["code"], name=row["name"])


def list_published_kb_articles(
    conn: psycopg.Connection[Any],
    tenant_id: str | None = None,
) -> list[KbArticleRow]:
    clause = "AND a.tenant_id = %s::uuid" if tenant_id else ""
    params: tuple[Any, ...] = (tenant_id,) if tenant_id else ()
    rows = conn.execute(
        f"""
        SELECT
          a.id::text,
          a.tenant_id::text,
          t.code AS tenant_code,
          a.slug,
          a.title,
          a.body,
          a.tags,
          a.status
        FROM kb_articles a
        JOIN tenants t ON t.id = a.tenant_id
        WHERE a.status = 'published'
        {clause}
        ORDER BY t.code, a.slug
        """,
        params,
    ).fetchall()
    return [_row_to_article(row) for row in rows]


def get_kb_article(conn: psycopg.Connection[Any], article_id: str) -> KbArticleRow | None:
    row = conn.execute(
        """
        SELECT
          a.id::text,
          a.tenant_id::text,
          t.code AS tenant_code,
          a.slug,
          a.title,
          a.body,
          a.tags,
          a.status
        FROM kb_articles a
        JOIN tenants t ON t.id = a.tenant_id
        WHERE a.id = %s::uuid
        """,
        (article_id,),
    ).fetchone()
    if not row:
        return None
    return _row_to_article(row)


def list_service_snapshots(
    conn: psycopg.Connection[Any],
    tenant_id: str,
) -> list[ServiceSnapshotRow]:
    rows = conn.execute(
        """
        SELECT
          ts.tenant_id::text,
          t.code AS tenant_code,
          ts.code AS service_code,
          ts.name,
          ts.description,
          ts.effective_fee_config AS fee_config,
          ts.effective_sla_days AS sla_days,
          ts.is_active
        FROM services ts
        JOIN tenants t ON t.id = ts.tenant_id
        WHERE ts.tenant_id = %s::uuid
        ORDER BY ts.code
        """,
        (tenant_id,),
    ).fetchall()
    return [
        ServiceSnapshotRow(
            tenant_id=row["tenant_id"],
            tenant_code=row["tenant_code"],
            service_code=row["service_code"],
            name=_as_dict(row["name"]),
            description=_as_dict(row["description"]),
            fee_config=_as_dict(row["fee_config"]),
            sla_days=row["sla_days"],
            is_active=bool(row["is_active"]),
        )
        for row in rows
    ]


def claim_kb_index_jobs(
    conn: psycopg.Connection[Any],
    limit: int,
) -> list[KbIndexJobRow]:
    rows = conn.execute(
        """
        UPDATE kb_index_jobs
        SET status = 'processing', updated_at = NOW()
        WHERE id IN (
          SELECT id
          FROM kb_index_jobs
          WHERE status = 'queued'
          ORDER BY created_at
          LIMIT %s
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id::text, tenant_id::text, article_id::text, trigger
        """,
        (limit,),
    ).fetchall()
    conn.commit()
    return [
        KbIndexJobRow(
            id=row["id"],
            tenant_id=row["tenant_id"],
            article_id=row["article_id"],
            trigger=row["trigger"],
        )
        for row in rows
    ]


def complete_kb_index_job(conn: psycopg.Connection[Any], job_id: str) -> None:
    conn.execute(
        """
        UPDATE kb_index_jobs
        SET status = 'completed', completed_at = NOW(), updated_at = NOW(), error = NULL
        WHERE id = %s::uuid
        """,
        (job_id,),
    )
    conn.commit()


def fail_kb_index_job(conn: psycopg.Connection[Any], job_id: str, error: str) -> None:
    conn.execute(
        """
        UPDATE kb_index_jobs
        SET status = 'failed', updated_at = NOW(), error = %s
        WHERE id = %s::uuid
        """,
        (error[:2000], job_id),
    )
    conn.commit()


def _row_to_article(row: dict[str, Any]) -> KbArticleRow:
    return KbArticleRow(
        id=row["id"],
        tenant_id=row["tenant_id"],
        tenant_code=row["tenant_code"],
        slug=row["slug"],
        title=_as_dict(row["title"]),
        body=_as_dict(row["body"]),
        tags=list(row["tags"] or []),
        status=row["status"],
    )


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    return {}
