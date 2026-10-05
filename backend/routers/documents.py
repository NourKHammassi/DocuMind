"""
routers/documents.py
Document management endpoints — upload, list, delete, summarize, Q&A, streaming Q&A.
All heavy logic is delegated to services/; this file handles only HTTP concerns.
"""

import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
import models
from schemas import (
    DocumentResponse,
    QuestionRequest,
    AnswerResponse,
    ConversationResponse,
    SummaryResponse,
)
from security import get_current_user
from services.rag_service import (
    chunk_text,
    embed_text,
    embed_query,
    embedding_to_str,
    find_relevant_chunks,
)
from services.gemini_service import generate_answer, generate_answer_stream, summarize_document
import PyPDF2

router = APIRouter(prefix="/documents", tags=["documents"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_pdf_text(file_bytes: bytes) -> tuple[str, int]:
    """Extract raw text and page count from PDF bytes."""
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = "".join(page.extract_text() or "" for page in reader.pages)
    return text, len(reader.pages)


def _get_doc_or_404(doc_id: str, user_id: str, db: Session) -> models.Document:
    """Fetch a document by ID scoped to the current user, or raise 404."""
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == user_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=DocumentResponse)
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload a PDF, extract text, split into chunks, embed each chunk,
    and persist everything to the database.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    content, page_count = _extract_pdf_text(file_bytes)
    word_count = len(content.split())

    doc = models.Document(
        user_id=current_user.id,
        filename=file.filename,
        content=content,
        page_count=page_count,
        word_count=word_count,
    )
    db.add(doc)
    db.flush()

    for i, chunk_content in enumerate(chunk_text(content)):
        embedding = embed_text(chunk_content)
        db.add(models.DocumentChunk(
            document_id=doc.id,
            chunk_index=i,
            content=chunk_content,
            embedding=embedding_to_str(embedding),
        ))

    db.commit()
    db.refresh(doc)
    return doc


# ---------------------------------------------------------------------------
# List / Get / Delete
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return all documents belonging to the current user."""
    return db.query(models.Document).filter(
        models.Document.user_id == current_user.id
    ).all()


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return a single document by ID."""
    return _get_doc_or_404(doc_id, current_user.id, db)


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a document and all its chunks/conversations."""
    doc = _get_doc_or_404(doc_id, current_user.id, db)
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}


# ---------------------------------------------------------------------------
# Summarize
# ---------------------------------------------------------------------------

@router.post("/{doc_id}/summarize", response_model=SummaryResponse)
def summarize(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a short summary of the document using Gemini."""
    doc = _get_doc_or_404(doc_id, current_user.id, db)
    summary = summarize_document(doc.content)
    return SummaryResponse(summary=summary)


# ---------------------------------------------------------------------------
# Q&A — blocking
# ---------------------------------------------------------------------------

@router.post("/{doc_id}/ask", response_model=AnswerResponse)
def ask(
    doc_id: str,
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Answer a question using RAG (blocking).
    Retrieves the top-4 relevant chunks, sends them with the question to Gemini,
    persists the exchange in conversation history, and returns the answer.
    """
    doc = _get_doc_or_404(doc_id, current_user.id, db)

    chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.document_id == doc_id
    ).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no indexed chunks")

    query_embedding = embed_query(request.question)
    relevant_chunks = find_relevant_chunks(query_embedding, chunks, top_k=4)
    context = "\n\n".join(c.content for c in relevant_chunks)

    answer, model_used = generate_answer(request.question, context)

    db.add(models.Conversation(
        document_id=doc_id,
        user_id=current_user.id,
        question=request.question,
        answer=answer,
    ))
    db.commit()

    return AnswerResponse(answer=answer, model=model_used)


# ---------------------------------------------------------------------------
# Q&A — streaming (SSE)
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/ask/stream")
def ask_stream(
    doc_id: str,
    question: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Streaming Q&A using Server-Sent Events (SSE).

    The client sends the question as a query param:
        GET /documents/{id}/ask/stream?question=...

    Each token is sent as:
        data: <token text>\\n\\n

    The stream ends with:
        data: [DONE]\\n\\n

    The full answer is saved to conversation history after streaming completes.
    """
    doc = _get_doc_or_404(doc_id, current_user.id, db)

    chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.document_id == doc_id
    ).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no indexed chunks")

    query_embedding = embed_query(question)
    relevant_chunks = find_relevant_chunks(query_embedding, chunks, top_k=4)
    context = "\n\n".join(c.content for c in relevant_chunks)

    def event_stream():
        full_answer_parts = []

        for token in generate_answer_stream(question, context):
            full_answer_parts.append(token)
            safe_token = token.replace("\n", "\\n")
            yield f"data: {safe_token}\n\n"

        full_answer = "".join(full_answer_parts)
        db.add(models.Conversation(
            document_id=doc_id,
            user_id=current_user.id,
            question=question,
            answer=full_answer,
        ))
        db.commit()

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/conversations", response_model=list[ConversationResponse])
def get_conversations(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the full conversation history for a document, oldest first."""
    _get_doc_or_404(doc_id, current_user.id, db)

    return db.query(models.Conversation).filter(
        models.Conversation.document_id == doc_id
    ).order_by(models.Conversation.created_at).all()