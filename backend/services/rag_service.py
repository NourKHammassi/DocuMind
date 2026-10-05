"""
services/rag_service.py
RAG pipeline — chunking, embedding, and retrieval.
All embedding logic is isolated here so the router stays thin.
"""

import json
import numpy as np
from fastembed import TextEmbedding

# Load the embedding model once at startup (downloaded on first run)
_embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

CHUNK_SIZE = 500       # words per chunk
CHUNK_OVERLAP = 50     # words overlap between consecutive chunks


def chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping chunks of CHUNK_SIZE words.
    Overlap helps preserve context at chunk boundaries.
    """
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        chunk = " ".join(words[start : start + CHUNK_SIZE])
        chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return a flat float list."""
    vectors = list(_embedding_model.embed([text]))
    return vectors[0].tolist()


def embed_query(query: str) -> list[float]:
    """Embed a query string (same model as document chunks)."""
    return embed_text(query)


def embedding_to_str(embedding: list[float]) -> str:
    """Serialize embedding to JSON string for PostgreSQL storage."""
    return json.dumps(embedding)


def embedding_from_str(embedding_str: str) -> list[float]:
    """Deserialize embedding from JSON string."""
    return json.loads(embedding_str)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    norm = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    if norm == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / norm)


def find_relevant_chunks(query_embedding: list[float], chunks, top_k: int = 4):
    """
    Score all chunks by cosine similarity to the query embedding,
    return the top_k most relevant chunks.
    """
    scored = [
        (chunk, cosine_similarity(query_embedding, embedding_from_str(chunk.embedding)))
        for chunk in chunks
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in scored[:top_k]]