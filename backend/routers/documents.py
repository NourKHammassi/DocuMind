import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
import models
from schemas import DocumentResponse, QuestionRequest, AnswerResponse, ConversationResponse, SummaryResponse
from auth import get_current_user
from rag import chunk_text, embed_text, embed_query, embedding_to_str, find_relevant_chunks
import PyPDF2
from google import genai

router = APIRouter(prefix="/documents", tags=["documents"])

GEMINI_MODEL = "gemini-3.5-flash-lite"


def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text, len(reader.pages)


@router.post("/upload", response_model=DocumentResponse)
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()
    content, page_count = extract_text_from_pdf(file_bytes)
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

    chunks = chunk_text(content)
    for i, chunk_content in enumerate(chunks):
        embedding = embed_text(chunk_content)
        chunk = models.DocumentChunk(
            document_id=doc.id,
            chunk_index=i,
            content=chunk_content,
            embedding=embedding_to_str(embedding),
        )
        db.add(chunk)

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Document).filter(models.Document.user_id == current_user.id).all()


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}


@router.post("/{doc_id}/summarize", response_model=SummaryResponse)
def summarize(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    prompt = f"Summarize the following document in 3-5 sentences:\n\n{doc.content[:4000]}"
    client = genai.Client()
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return SummaryResponse(summary=response.text)


@router.post("/{doc_id}/ask", response_model=AnswerResponse)
def ask(
    doc_id: str,
    request: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.document_id == doc_id
    ).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no chunks")

    query_embedding = embed_query(request.question)
    relevant_chunks = find_relevant_chunks(query_embedding, chunks, top_k=4)
    context = "\n\n".join([c.content for c in relevant_chunks])

    prompt = f"""You are a helpful assistant. Answer the question based only on the context below.

Context:
{context}

Question: {request.question}

Answer:"""

    client = genai.Client()
    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    answer = response.text

    conversation = models.Conversation(
        document_id=doc_id,
        user_id=current_user.id,
        question=request.question,
        answer=answer,
    )
    db.add(conversation)
    db.commit()

    return AnswerResponse(answer=answer, model=GEMINI_MODEL)


@router.get("/{doc_id}/conversations", response_model=list[ConversationResponse])
def get_conversations(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return db.query(models.Conversation).filter(
        models.Conversation.document_id == doc_id
    ).order_by(models.Conversation.created_at).all()