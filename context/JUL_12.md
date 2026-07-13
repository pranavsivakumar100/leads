# Leadflow — Session Context (Jul 12, 2026)

> **Standing rule:** Update this file (and add new dated entries under `context/`) whenever we make a relevant product, infra, or architecture change.

---

## Project overview

**Leadflow** — monetizable B2B lead-scraper product for local business outreach (initial use case: AI receptionist agency). Users sign in, search by service + location, get ranked leads (phone, website, rating, quality score), filter, and export CSV/Excel.

**Repo:** https://github.com/pranavsivakumar100/leads  
**Stack:** FastAPI backend + React/Vite frontend + Supabase Auth + Google Places API (New)

---

## What we built today

### 1. Lead scraping (CLI / `stuff/`)

- Started with Google Maps MCP exploration; settled on Places API (New) via Python.
- Built `stuff/generate_leads.py` — tiles searches across metro sub-areas to beat Google's ~60/query cap, dedupes by place id, ranks with Bayesian quality score.
- Generated lead workbooks:
  - **Newark NJ** — 2,709 leads (deep, 22 home-service categories)
  - **Atlanta GA** — 3,249 leads (deep, 22 categories)
- Output: `stuff/newark_home_services_leads.xlsx`, `stuff/atlanta_home_services_leads.xlsx`, per-service CSVs in `stuff/csv_newark/` and `stuff/csv_atlanta/`.
- `stuff/` is gitignored (generated data, not part of the app).

### 2. Product app (`backend/` + `frontend/`)

Copied foundational patterns from `~/Documents/GitHub/dreams`:
- FastAPI app factory, CORS, layered routes/services/schemas
- Supabase JWT auth (`CurrentUserDep` verifies token server-side)
- React auth (Google OAuth + email OTP), `apiFetch` with bearer token

#### Backend (`backend/`)

| Layer | What |
|---|---|
| `app/core/config.py` | Settings: Supabase, `GOOGLE_MAPS_API_KEY`, CORS |
| `app/core/db.py` | Supabase client (service-role) |
| `app/api/deps.py` | `get_current_user` — validates Supabase access token |
| `app/services/places.py` | Places API client: text search, pagination, autocomplete |
| `app/services/leads.py` | Scraper: presets, grid tiling, dedup, Bayesian score |
| `app/services/export.py` | Formatted `.xlsx` export (emerald header, frozen panes) |

**API routes** (`/api/v1`):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/me` | Yes | Verify auth, return user |
| GET | `/search/services` | No | 22 service presets |
| GET | `/search/locations/autocomplete?input=` | Yes | City/area suggestions |
| POST | `/search` | Yes | Run lead scrape (auto-saves search + leads to DB) |
| POST | `/search/export` | Yes | Download `.xlsx` |
| GET | `/history` | Yes | Recent searches (newest first) |
| GET | `/history/stats` | Yes | Dashboard KPIs (leads, searches, markets) |
| GET | `/history/{id}/leads` | Yes | Leads from a saved search |

**Search params:** `service`, `location`, `deep`, `max_results`, `radius_km` (1–80 km).

#### Frontend (`frontend/`)

- **Auth gate** — sign-in card when logged out; full app when logged in
- **Sidebar** — Dashboard + Search tabs active; Leads/Campaigns/Exports marked "Soon"
- **Dashboard** — KPI cards wired to real data (`/history/stats`) + recent-searches table (`/history`); empty state with CTA when no searches yet
- **Search page:**
  - Service input (datalist from presets)
  - Location with **autocomplete** (debounced 300ms, keyboard nav)
  - **Coverage** dropdown (City / Metro / Wide) — only active when deep search is on
  - **Deep search** toggle with (i) hover tooltips explaining behavior
  - Results table ranked by quality score
  - **Client-side filters** (instant, no re-scrape): min rating, review range, has website
  - CSV + Excel export (exports respect active filters)

**Brand:** "Leadflow" (placeholder). Light SaaS theme, dark sidebar, emerald accent.

**Design note (anti-"vibecoded" pass):** Audited the UI against the [vibecoded-design-tells](https://github.com/JCarterJohnson/vibecoded-design-tells) dataset. Already avoided the big tells (no AI-purple, no glassmorphism, no gradient-everywhere, no bento grid, no emoji in copy). Reworked the **auth gate** from a dead-centered card + radial "aurora" glow (three tells at once) into an asymmetric two-column split (value prop + feature checklist on the left, sign-in card on the right), flat background. Remaining mild tell: Inter + Space Grotesk pairing (a distinctive display font would differentiate further — not yet changed).

### 3. Supabase project

- **Project:** Leadflow — ref `vdwprpfcwrglorhlmyuj`, org: Dreams, region: us-east-1
- **Dashboard:** https://supabase.com/dashboard/project/vdwprpfcwrglorhlmyuj
- `.env` files created locally (gitignored); only `.env.example` in repo

#### Database tables (added late Jul 12)

| Table | Purpose |
|---|---|
| `searches` | One row per search: user_id, service, location, deep, radius_km, total_results, created_at |
| `leads` | Scraped leads linked to their search; unique `(search_id, place_id)` |

- Both have **RLS enabled** with owner-only select/insert/delete policies (`auth.uid() = user_id`).
- Backend writes with the service key (bypasses RLS) but always scopes queries by `user_id` explicitly (`app/services/history.py`).
- Persistence is **best-effort**: a DB failure never breaks the search response.
- ⚠️ The Supabase MCP in `~/.cursor/mcp.json` is pinned to the **Dreams** project (`toskpiypmhgefwxcbuto`), not Leadflow. Migration was applied via the Supabase Management API instead. Consider re-pointing the MCP `--project-ref` to `vdwprpfcwrglorhlmyuj`.
- After DDL via the Management API, PostgREST needs `notify pgrst, 'reload schema';` or new tables 404 with PGRST205.

### 4. Git

- Pushed `backend/` + `frontend/` to https://github.com/pranavsivakumar100/leads (`main`)
- Secrets excluded; `stuff/` excluded

---

## Auth & security (verified)

| Secret | Where | Role | Exposed to browser? |
|---|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` | `anon` | Yes (by design — auth only) |
| `SUPABASE_SERVICE_KEY` | `backend/.env` | `service_role` | No (server-only) |
| `GOOGLE_MAPS_API_KEY` | `backend/.env` | — | No (all Places calls proxied through API) |

**Flow:** Frontend authenticates via Supabase → gets access token → sends `Authorization: Bearer` on API calls → backend calls `auth.get_user(token)` to verify. Unauthed requests get 401.

**Caveat (now relevant):** Service key bypasses RLS. The `searches`/`leads` tables have RLS policies, but backend queries go through the service key, so every query in `app/services/history.py` filters by `user_id` explicitly.

**Not in repo:** Real `.env` files, `stuff/` lead data, Supabase personal access token (`sbp_...` in `~/.cursor/mcp.json`).

---

## Search inputs — implemented vs evaluated

### Implemented
- Service (preset or custom)
- Location (with autocomplete)
- Coverage area: City / Metro / Wide (only when deep search on; disabled otherwise)
- Deep search toggle (with info tooltip)
- Post-fetch filters: min rating, review range, has website

### Evaluated, not implemented
| Input | Verdict |
|---|---|
| Latino-owned / women-owned / etc. | **Not available** in Places API (GBP UI attribute only). Even if available, ethically risky as a filter. Bilingual outreach angle is valid as messaging, not as a scrape filter. |
| Business hours / "closed weekends" | Needs `regularOpeningHours` field (extra API cost). Useful for missed-call angle — future. |
| Exclude chains/franchises | Heuristic only (name/domain repetition). Future. |
| Multi-service batch search | Supported in CLI script; not yet in web UI. Future. |
| Phone present filter | Easy post-fetch filter — not yet added. |

---

## How to run locally

```bash
# Backend
cd backend
cp .env.example .env   # fill keys
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
cp .env.example .env   # fill Supabase URL + anon key
npm install
npm run dev
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:5173
- **Note:** Dreams dev server may still be on port 8000 — stop it or use a different port for Leadflow backend.

---

## Google Cloud setup (for new collaborators)

1. Enable **Places API (New)** + **Routes API**
2. Create API key → restrict to those APIs
3. Put key in `backend/.env` as `GOOGLE_MAPS_API_KEY`

For Google OAuth sign-in (optional): configure provider at  
https://supabase.com/dashboard/project/vdwprpfcwrglorhlmyuj/auth/providers  
Email OTP works out of the box.

---

## Next steps (discussed, not built)

- [x] Saved searches / lead history per user (Supabase tables + RLS) ✅ built
- [x] Dashboard KPIs wired to real data ✅ built
- [x] Frontend UI to reopen a saved search's leads ✅ built — click a recent-searches row → opens Search tab, loads saved leads via `GET /history/{id}/leads` (filters + CSV/Excel export all work on the loaded set)
- [ ] Leads / Campaigns / Exports tabs
- [ ] Multi-service batch search in web UI
- [ ] Phone-present filter
- [ ] Deep search progress streaming / background jobs
- [ ] Railway deploy (configs exist: `railway.json` in both dirs)
- [ ] Root README with setup instructions

---

## File map (app only)

```
Leads/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/          config, db
│   │   ├── api/           deps, router, routes/
│   │   ├── schemas/       health, leads
│   │   └── services/      places, leads, export, health
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    auth, dashboard, layout, search
│   │   ├── hooks/         useAuth
│   │   └── lib/           api/, supabase, csv
│   └── .env.example
├── context/               ← session logs (this file)
└── stuff/                 ← CLI scripts + generated lead files (gitignored)
```
