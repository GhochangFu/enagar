"""Runtime configuration from environment."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    qdrant_url: str
    embedding_model: str
    chunk_size_chars: int
    chunk_overlap_chars: int
    vector_size: int
    job_batch_limit: int

    @staticmethod
    def from_env() -> Settings:
        return Settings(
            database_url=os.environ.get(
                "DATABASE_URL",
                "postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba",
            ),
            qdrant_url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
            embedding_model=os.environ.get(
                "RAG_EMBEDDING_MODEL",
                "paraphrase-multilingual-MiniLM-L12-v2",
            ),
            chunk_size_chars=int(os.environ.get("RAG_CHUNK_SIZE_CHARS", "2000")),
            chunk_overlap_chars=int(os.environ.get("RAG_CHUNK_OVERLAP_CHARS", "200")),
            vector_size=int(os.environ.get("RAG_VECTOR_SIZE", "384")),
            job_batch_limit=int(os.environ.get("RAG_JOB_BATCH_LIMIT", "50")),
        )


def collection_name_for_tenant(tenant_code: str) -> str:
    safe = tenant_code.strip().lower().replace("-", "_")
    return f"kb_{safe}"
