from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from pypdf import PdfReader
import io
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash"]

def generate(prompt: str) -> str:
    for model in MODELS:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            return response.text
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                continue
            raise
    raise Exception("All models unavailable. Try again in a moment.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

document_store: dict[str, str] = {}


class QuestionRequest(BaseModel):
    session_id: str
    question: str


class TextRequest(BaseModel):
    session_id: str


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    contents = await file.read()
    reader = PdfReader(io.BytesIO(contents))
    text = "\n".join(
        page.extract_text() for page in reader.pages if page.extract_text()
    )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    session_id = file.filename
    document_store[session_id] = text
    word_count = len(text.split())

    return {
        "session_id": session_id,
        "pages": len(reader.pages),
        "word_count": word_count,
        "read_time": max(1, round(word_count / 200)),
        "preview": text[:300],
    }


@app.post("/summarize")
async def summarize(request: TextRequest):
    text = document_store.get(request.session_id)
    if not text:
        raise HTTPException(status_code=404, detail="Document not found")

    prompt = f"""Summarize the following document clearly and concisely.
Extract the key points, main arguments, and important conclusions.
Format the output with clear sections.

Document:
{text}"""

    return {"summary": generate(prompt)}


@app.post("/ask")
async def ask_question(request: QuestionRequest):
    text = document_store.get(request.session_id)
    if not text:
        raise HTTPException(status_code=404, detail="Document not found")

    prompt = f"""Based on the following document, answer this question accurately and concisely.
If the answer is not found in the document, say so clearly. Do not make things up.

Document:
{text}

Question: {request.question}"""

    return {"answer": generate(prompt)}


@app.get("/health")
def health():
    return {"status": "ok"}