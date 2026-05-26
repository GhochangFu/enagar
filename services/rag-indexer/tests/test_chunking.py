from enagar_rag_indexer.chunking import chunk_text, normalize_text


def test_chunk_text_splits_long_body() -> None:
    text = "word " * 800
    chunks = chunk_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    assert chunks[0].index == 0
    assert all(chunk.text for chunk in chunks)


def test_normalize_text_collapses_whitespace() -> None:
    assert normalize_text("  hello \n\n world  ") == "hello world"
