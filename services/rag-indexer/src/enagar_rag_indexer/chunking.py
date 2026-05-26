"""Markdown chunking (~500 tokens ≈ 2000 chars, 50-token overlap)."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    index: int
    text: str


_WHITESPACE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    return _WHITESPACE.sub(" ", text.strip())


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[TextChunk]:
    """Split text into overlapping chunks (character-based token proxy)."""
    normalized = normalize_text(text)
    if not normalized:
        return []

    if len(normalized) <= chunk_size:
        return [TextChunk(index=0, text=normalized)]

    chunks: list[TextChunk] = []
    start = 0
    index = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        piece = normalized[start:end].strip()
        if piece:
            chunks.append(TextChunk(index=index, text=piece))
            index += 1
        if end >= len(normalized):
            break
        start = max(end - overlap, start + 1)

    return chunks
