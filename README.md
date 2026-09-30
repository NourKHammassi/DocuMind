# DocuMind

AI-powered PDF assistant. Upload a document, get an instant summary, ask anything about it — answers grounded in the document via RAG.

## Features

- JWT authentication (register / login)
- PDF upload with automatic text extraction
- Instant AI summary on upload
- Context-aware Q&A using RAG (Retrieval-Augmented Generation)
- Persistent conversation history per document
- Document management (list, delete)

## How the RAG pipeline works

1. **Chunk** — uploaded PDF text is split into 500-word overlapping chunks
2. **Embed** — each chunk is embedded using `fastembed` (BAAI/bge-small-en-v1.5, runs locally)
3. **Store** — embeddings saved as JSON in PostgreSQL alongside the chunk text
4. **Retrieve** — on each question, the query is embedded and top-4 chunks found via cosine similarity
5. **Generate** — retrieved chunks + question sent to Gemini 3.5-flash-lite to produce a grounded answer

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Database | PostgreSQL + SQLAlchemy |
| Auth | JWT (python-jose) |
| Embeddings | fastembed — BAAI/bge-small-en-v1.5 (local, no API) |
| Generation | Google Gemini 3.5-flash-lite |
| PDF parsing | PyPDF2 |

## Run locally

Prerequisites: Python 3.10+, Node 18+, PostgreSQL running locally.

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Create `backend/.env`:
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/documind
SECRET_KEY=your_secret_key_here


**Frontend**

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:8000`.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| POST | `/documents/upload` | Upload PDF |
| GET | `/documents/` | List user's documents |
| DELETE | `/documents/{id}` | Delete document |
| POST | `/documents/{id}/summarize` | Generate summary |
| POST | `/documents/{id}/ask` | Ask a question (RAG) |
| GET | `/documents/{id}/conversations` | Get conversation history |

## Status

v1 working locally. Deployment (Railway + Vercel) coming next.
