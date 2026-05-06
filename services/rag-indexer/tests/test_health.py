"""Smoke test for the Phase-0 stub."""
from fastapi.testclient import TestClient

from enagar_rag_indexer.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "enagar-rag-indexer",
        "phase": "phase-0",
    }
