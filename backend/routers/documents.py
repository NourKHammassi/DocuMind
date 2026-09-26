from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user
import models
from schemas import QuestionRequest, DocumentOut, ConversationOut
from pypdf import PdfReader
from google import genai
import io
import os

router = APIRouter(prefix="/documents", tags=["documents"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash"]


def generate(prompt: str) -> str:
    for model in MODELS:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            return response.text
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                continue
            raise
    raise Exception("All models unavailable.")


@router.post("/upload", response_model=DocumentOut)
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content = await file.read()
    reader = PdfReader(io.BytesIO(content))
    text = "".join(page.extract_text() or "" for page in reader.pages)

    words = len(text.split())
    doc = models.Document(
        user_id=current_user.id,
        filename=file.filename,
        pages=len(reader.pages),
        word_count=words,
        read_time=max(1, round(words / 200)),
        content=text,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{doc_id}/summarize")
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

    summary = generate(f"Summarize this document with structured sections:\n\n{doc.content[:8000]}")
    db.add(models.Conversation(document_id=doc_id, role="assistant", content=summary))
    db.commit()
    return {"summary": summary}


@router.post("/{doc_id}/ask")
def ask(
    doc_id: str,
    body: QuestionRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.Document).filter(
        models.Document.id == doc_id,
        models.Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.add(models.Conversation(document_id=doc_id, role="user", content=body.question))
    answer = generate(f"Document:\n{doc.content[:8000]}\n\nQuestion: {body.question}")
    db.add(models.Conversation(document_id=doc_id, role="assistant", content=answer))
    db.commit()
    return {"answer": answer}


@router.get("/", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Document).filter(
        models.Document.user_id == current_user.id
    ).order_by(models.Document.created_at.desc()).all()


@router.get("/{doc_id}/conversations", response_model=List[ConversationOut])
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
    return doc.conversations


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
    return {"message": "deleted"}