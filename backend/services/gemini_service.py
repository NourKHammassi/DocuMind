"""
services/gemini_service.py
All Gemini API calls in one place.
Falls back to next model if the primary is unavailable or rate-limited.
"""

from typing import Generator
from google import genai
from google.genai import errors

# Priority order — first available model wins
GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

_client = genai.Client()


def _call_with_fallback(fn):
    """
    Try each model in GEMINI_MODELS in order.
    Moves to the next if the current returns 404 or 429 (rate limit).
    Raises the last error if all models fail.
    """
    last_error = None
    for model in GEMINI_MODELS:
        try:
            return fn(model)
        except errors.ClientError as e:
            if e.status_code in (404, 429):
                last_error = e
                continue
            raise
    raise last_error


def build_qa_prompt(context: str, question: str) -> str:
    return f"""You are a helpful document assistant. \
Answer the question based ONLY on the context provided below. \
If the answer is not in the context, say so clearly.

Context:
{context}

Question: {question}

Answer:"""


def generate_answer(question: str, context: str) -> tuple[str, str]:
    """
    Blocking Q&A with automatic model fallback.
    Returns (answer_text, model_used).
    """
    prompt = build_qa_prompt(context, question)
    def _call(model):
        text = _client.models.generate_content(model=model, contents=prompt).text
        return (text, model)
    return _call_with_fallback(_call)


def generate_answer_stream(question: str, context: str) -> Generator[str, None, None]:
    """
    Streaming Q&A with automatic model fallback.
    Yields text tokens as they arrive from Gemini.
    """
    prompt = build_qa_prompt(context, question)
    last_error = None
    for model in GEMINI_MODELS:
        try:
            for chunk in _client.models.generate_content_stream(model=model, contents=prompt):
                if chunk.text:
                    yield chunk.text
            return
        except errors.ClientError as e:
            if e.status_code in (404, 429):
                last_error = e
                continue
            raise
    raise last_error


def summarize_document(content: str) -> str:
    """Summarize document with automatic model fallback."""
    prompt = "Summarize the following document in 3-5 clear, concise sentences:\n\n" + content[:4000]
    def _call(model):
        return _client.models.generate_content(model=model, contents=prompt).text
    return _call_with_fallback(_call)