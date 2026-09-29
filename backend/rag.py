import json
import math
from fastembed import TextEmbedding

_model = TextEmbedding("BAAI/bge-small-en-v1.5")  # 384 dims, downloads once


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = words[i:i + chunk_size]
        chunks.append(" ".join(chunk))
        i += chunk_size - overlap
    return chunks


def embed_text(text: str, task_type: str = None) -> list[float]:
    return list(_model.embed([text]))[0].tolist()


def embed_query(text: str) -> list[float]:
    return list(_model.embed([text]))[0].tolist()


def embedding_to_str(embedding: list[float]) -> str:
    return json.dumps(embedding)


def str_to_embedding(s: str) -> list[float]:
    return json.loads(s)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def find_relevant_chunks(query_embedding: list[float], chunks, top_k: int = 4) -> list:
    scored = []
    for chunk in chunks:
        chunk_embedding = str_to_embedding(chunk.embedding)
        score = cosine_similarity(query_embedding, chunk_embedding)
        scored.append((score, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]