"""Local sentence-transformers embeddings (on-prem, no egress)."""
from __future__ import annotations

import statistics
import time
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_model(model_name: str) -> SentenceTransformer:
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def encode_texts(model_name: str, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = get_model(model_name)
    vectors = model.encode(texts, normalize_embeddings=True)
    return [vector.tolist() for vector in vectors]


def benchmark_encode(
    model_name: str,
    samples: int,
) -> dict[str, float | int | str]:
    """Return P50/P95 latency (ms) for single-string encodes."""
    model = get_model(model_name)
    probe = "আমি কীভাবে জন্ম সার্টিফিকেট পাবো?"
    latencies_ms: list[float] = []
    for _ in range(max(samples, 1)):
        started = time.perf_counter()
        model.encode([probe], normalize_embeddings=True)
        latencies_ms.append((time.perf_counter() - started) * 1000)

    latencies_ms.sort()
    p50 = statistics.median(latencies_ms)
    p95_index = min(int(len(latencies_ms) * 0.95), len(latencies_ms) - 1)
    p95 = latencies_ms[p95_index]
    return {
        "model": model_name,
        "samples": len(latencies_ms),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "vector_size": len(model.encode([probe], normalize_embeddings=True)[0]),
    }
