# Leadflow Backend

FastAPI backend for the Leadflow lead-scraper product. Provides a health check
and Supabase-authenticated endpoints. Google Maps (Places API New) powers the
lead scraping (to be wired into API routes next).

## Project structure

```
backend/
├── app/
│   ├── main.py                # App factory (create_app) + middleware
│   ├── core/
│   │   ├── config.py          # Settings (env-driven)
│   │   └── db.py              # Supabase client (optional)
│   ├── api/
│   │   ├── deps.py            # Shared dependencies (auth, settings, supabase)
│   │   ├── router.py          # Aggregates all route modules
│   │   └── routes/
│   │       ├── health.py      # GET /health
│   │       └── me.py          # GET /me (auth-gated)
│   ├── schemas/               # Pydantic request/response models
│   └── services/              # Business logic
├── requirements.txt
└── .env.example
```

Layer responsibilities:

- **routes** — thin HTTP handlers (status codes, serialization).
- **services** — business logic, framework-light.
- **repositories** — all Supabase/DB access lives here (add as needed).
- **schemas** — Pydantic models for validation and serialization.
- **core** — config and shared clients (Supabase).

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your keys
```

## Run

```bash
uvicorn app.main:app --reload
```

- Docs: `http://localhost:8000/docs`
- Health: `GET /api/v1/health`
- Current user (auth): `GET /api/v1/me` with `Authorization: Bearer <supabase-access-token>`

## Auth

Endpoints protected with `CurrentUserDep` require a Supabase access token
(`Authorization: Bearer <token>`), obtained by the frontend via Supabase Auth.
The token is verified server-side against Supabase.

## Configuration

| Variable               | Description                                   | Default        |
| ---------------------- | --------------------------------------------- | -------------- |
| `APP_NAME`             | Application name                              | `Leadflow API` |
| `ENVIRONMENT`          | Environment name                             | `development`  |
| `API_V1_PREFIX`        | Prefix for versioned API routes              | `/api/v1`      |
| `CORS_ORIGINS`         | Comma-separated allowed CORS origins         | localhost 3000/5173 |
| `GOOGLE_MAPS_API_KEY`  | Google Maps Platform key (Places API New)    | (empty)        |
| `SUPABASE_URL`         | Supabase project URL (blank = stateless)     | (empty)        |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key (server-side only) | (empty)        |

## Deployment

Deployed on Railway with root directory `backend/`. Build/start settings live in
`railway.json`.
