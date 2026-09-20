# DocuMind

AI-powered document assistant. Upload a PDF, get an instant summary, 
then ask anything about it.

## Stack

- **Frontend:** React · TypeScript · Vite
- **Backend:** Python · FastAPI
- **AI:** Google Gemini API
- **PDF parsing:** pypdf

## Run locally

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in `/backend` with:
```
GEMINI_API_KEY=your_key_here
```
