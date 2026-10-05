# DocuMind

AI-powered PDF assistant built with FastAPI + React. Upload any PDF, get an instant summary, then ask questions in plain language — answers are grounded in the document via a local RAG pipeline with real-time streaming.

![stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![stack](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![stack](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![stack](https://img.shields.io/badge/Gemini-4285F4?style=flat&logo=google&logoColor=white)

---

## Features

- **JWT auth** — register / login, all routes protected
- **PDF ingestion** — text extraction, chunking, local embedding, stored in PostgreSQL
- **Instant summary** — Gemini generates a structured summary on upload
- **RAG Q&A** — cosine similarity retrieval over embedded chunks, answer grounded in top-4 passages
- **SSE streaming** — tokens stream to the client in real time via Server-Sent Events
- **Conversation history** — full Q&A history persisted per document per user
- **Document management** — list, select, delete

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     React + Vite                    │
│  AuthPage  │  Sidebar  │  Chat (SSE)  │  InfoPanel  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────┐
│                      FastAPI                        │
│   /auth  │  /documents  │  /ask  │  /ask/stream     │
└──────┬───────────────────────────────────┬──────────┘
       │ SQLAlchemy                        │ Gemini API
┌──────▼──────┐                   ┌────────▼────────┐
│ PostgreSQL  │                   │  Gemini Flash   │
│  users      │                   │  (generation)   │
│  documents  │                   └─────────────────┘
│  chunks     │  ← embeddings stored as JSON vectors
│  conversations
└─────────────┘
```

---

## RAG Pipeline

```
PDF upload
   │
   ▼
Extract text (PyPDF2)
   │
   ▼
Chunk — 500-word windows, 50-word overlap
   │
   ▼
Embed — fastembed BAAI/bge-small-en-v1.5 (runs locally, no API cost)
   │
   ▼
Store — embedding JSON + chunk text in PostgreSQL
   │
   ▼  (on each question)
Embed query → cosine similarity → top-4 chunks
   │
   ▼
Gemini Flash — context + question → streamed answer via SSE
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Python 3.11, FastAPI |
| Database | PostgreSQL, SQLAlchemy ORM |
| Auth | JWT (python-jose + passlib) |
| Embeddings | fastembed — BAAI/bge-small-en-v1.5 (local, no API cost) |
| Generation | Google Gemini 2.0 Flash Lite |
| Streaming | Server-Sent Events (SSE) |
| PDF parsing | PyPDF2 |

---

## Run locally

**Prerequisites:** Python 3.10+, Node 18+, PostgreSQL running locally.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/documind
SECRET_KEY=your_secret_key_here
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:8000`.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Get JWT token |
| POST | `/documents/upload` | ✓ | Upload PDF (extracts, chunks, embeds) |
| GET | `/documents/` | ✓ | List user's documents |
| DELETE | `/documents/{id}` | ✓ | Delete document + chunks + history |
| POST | `/documents/{id}/summarize` | ✓ | Generate summary |
| POST | `/documents/{id}/ask` | ✓ | Q&A — blocking |
| GET | `/documents/{id}/ask/stream` | ✓ | Q&A — SSE streaming |
| GET | `/documents/{id}/conversations` | ✓ | Conversation history |

---

## Status

v1 working locally. Deployment (Railway + Vercel) coming next.
