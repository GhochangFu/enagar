"""API smoke tests (no Qdrant/Postgres required for basic routes)."""
from fastapi.testclient import TestClient

from enagar_rag_indexer.main import app

client = TestClient(app)


def test_health_shape() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "enagar-rag-indexer"
    assert body["phase"] == "7.1"
    assert "postgres" in body
    assert "qdrant" in body
    assert "embedding_model" in body


def test_benchmark_route(monkeypatch) -> None:
    class _FakeModel:
        def encode(self, texts, normalize_embeddings=True):
            return [[0.1] * 384 for _ in texts]

    monkeypatch.setattr(
        "enagar_rag_indexer.embeddings.get_model",
        lambda _name: _FakeModel(),
    )
    response = client.get("/benchmark/embeddings?samples=2")
    assert response.status_code == 200
    body = response.json()
    assert body["samples"] == 2
    assert "p50_ms" in body
    assert "p95_ms" in body
    assert body["vector_size"] == 384
