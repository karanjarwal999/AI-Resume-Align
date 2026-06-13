# AI Resume Align

Paste a job description, drop in your PDF resume, and the app produces a
customized resume tailored to that role using Google Gemini.

This repo is a two-project setup: a Next.js frontend and a FastAPI
backend. They run as independent processes during local development.

## Prerequisites

- **Node.js >= 20.9** (Next.js 16 requires this)
- **Python 3.11+** (3.14 verified)
- A Google Gemini API key

## First-time setup

```powershell
# 1. Clone and enter the repo
git clone https://github.com/karanjarwal999/AI-Resume-Align.git
cd AI-Resume-Align

# 2. Frontend deps
cd frontend
npm install
Copy-Item .env.example .env.local

# 3. Backend deps (in a new shell, from repo root)
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# then edit .env and set GEMINI_API_KEY
```

## Local development (two terminals)

### Terminal 1 — frontend

```powershell
cd frontend
npm run dev
# -> http://localhost:3000
```

### Terminal 2 — backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONIOENCODING = "utf-8"   # Windows console can't render fastapi-cli's emoji without this
fastapi dev app/main.py
# -> http://localhost:8000 (docs at /docs)
```

The frontend reads `NEXT_PUBLIC_API_BASE_URL` from `.env.local`.
The backend reads `ALLOWED_ORIGINS` and `GEMINI_API_KEY` from `.env`.
CORS is preconfigured to allow `http://localhost:3000`.

## Project layout

```
frontend/    Next.js 16 app router, TypeScript, Tailwind v4
backend/     FastAPI app + virtualenv (.venv/, gitignored)
  app/
    main.py    FastAPI app, CORS middleware, /health
    config.py  pydantic-settings (env vocabulary)
```

## Quick health check

```powershell
curl http://localhost:8000/health
# -> {"ok":true}
```
