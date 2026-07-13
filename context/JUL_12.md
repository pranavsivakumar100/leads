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
| GET | `/leads` | Yes | Master lead library — deduped by place_id across all searches |
| PATCH | `/leads/{place_id}/status` | Yes | Set outreach status (new/contacted/interested/passed) |
| GET/POST | `/campaigns` | Yes | List / create outreach campaigns |
| DELETE | `/campaigns/{id}` | Yes | Delete a campaign (leads stay in library) |
| GET/POST | `/campaigns/{id}/leads` | Yes | List / bulk-add campaign leads |
| DELETE | `/campaigns/{id}/leads/{place_id}` | Yes | Remove a lead from a campaign |
| GET/POST | `/scripts` | Yes | List / create call scripts (frameworks) |
| PATCH/DELETE | `/scripts/{id}` | Yes | Update / delete a script |
| GET/POST | `/sessions` | Yes | List / create call sessions |
| GET/PATCH/DELETE | `/sessions/{id}` | Yes | Get (with events) / update (outcome, notes, end) / delete |
| POST | `/sessions/{id}/events` | Yes | Append a transcript/coach event to a session |
| GET/POST | `/offers` | Yes | List / create offers (what you sell) |
| PATCH/DELETE | `/offers/{id}` | Yes | Update / delete an offer |

**Search params:** `service`, `location`, `deep`, `max_results`, `radius_km` (1–80 km).

#### Frontend (`frontend/`)

- **Auth gate** — sign-in card when logged out; full app when logged in
- **Sidebar** — Dashboard, Search, Leads, Campaigns, Sessions, Skills (Scripts + Offers combined under one **Skills** tab via a segmented toggle). No separate Exports tab — export lives on each data view.
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

- **Project:** Leadflow — ref `vdwprpfcwrglorhlmyuj`, region: us-east-1
- **Dashboard:** https://supabase.com/dashboard/project/vdwprpfcwrglorhlmyuj
- **Dreams is separate:** Dreams uses its own project `toskpiypmhgefwxcbuto` (`companions`, `conversations`, `messages`). Leadflow only has `searches` + `leads` — no Dreams tables or keys in this repo.
- **Org cleanup (Jul 13):** Leadflow project currently sits under the shared **Dreams** org in the Supabase dashboard. A dedicated **Leadflow** org was created (`psykhcylmmdjjdhjnjri`). Transfer the project there via [Project Settings → General → Transfer project](https://supabase.com/dashboard/project/vdwprpfcwrglorhlmyuj/settings/general) → target org **Leadflow**. API keys/URL stay the same; no app env changes needed.
- **MCP:** `~/.cursor/mcp.json` now points at `vdwprpfcwrglorhlmyuj` (was incorrectly pinned to Dreams).
- `.env` files created locally (gitignored); only `.env.example` in repo

#### Database tables (added late Jul 12)

| Table | Purpose |
|---|---|
| `searches` | One row per search: user_id, service, location, deep, radius_km, total_results, created_at |
| `leads` | Scraped leads linked to their search; unique `(search_id, place_id)`; `outreach_status` column (new/contacted/interested/passed) added Jul 13 for the Leads library |
| `campaigns` | Named outreach lists: user_id, name, description, created_at (added Jul 13) |
| `campaign_leads` | Join table campaign ↔ lead by `place_id`; PK `(campaign_id, place_id)` (added Jul 13) |
| `scripts` | Call frameworks: user_id, name, description, `steps` jsonb (array of {title, body}), timestamps (added Jul 13) |
| `call_sessions` | One row per call: user_id, lead_place_id/lead_name snapshot, campaign_id?, script_id?, `offer` (what you're selling), outcome, notes, started/ended (added Jul 13) |
| `session_events` | Timestamped call turns: session_id, role (prospect/rep/coach/system), text, t_ms — the transcript the AI coach will write into (added Jul 13) |
| `offers` | What the user sells: user_id, name, description (pitch), pricing, `fit_type` (any/no_website/few_reviews/low_rating/high_volume), timestamps (added Jul 13) |

- Both have **RLS enabled** with owner-only select/insert/delete policies (`auth.uid() = user_id`).
- Backend writes with the service key (bypasses RLS) but always scopes queries by `user_id` explicitly (`app/services/history.py`).
- Persistence is **best-effort**: a DB failure never breaks the search response.

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

## Deployment (Railway — Jul 12, 2026)

**Project:** `Leadflow` — ID `270ea311-9f0a-4d9b-b4bd-abf17aff67ac`  
**Dashboard:** https://railway.com/project/270ea311-9f0a-4d9b-b4bd-abf17aff67ac

| Service | URL | Deploy root |
|---|---|---|
| **frontend** | https://frontend-production-a5c6.up.railway.app | `frontend/` |
| **backend** | https://backend-production-501f.up.railway.app | `backend/` |

**Backend env (Railway):** `APP_NAME`, `ENVIRONMENT=production`, `CORS_ORIGINS` (includes prod frontend + localhost dev), `GOOGLE_MAPS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Frontend env (Railway, build-time):** `VITE_API_BASE_URL=https://backend-production-501f.up.railway.app/api/v1`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Redeploy manually:**
```bash
cd backend && railway up . --path-as-root --service backend --detach
cd frontend && railway up . --path-as-root --service frontend --detach
```

**Post-deploy todo:** Add `https://frontend-production-a5c6.up.railway.app` to Supabase Auth → URL Configuration (Site URL + Redirect URLs) so sign-in works in prod.

---

## Next steps (discussed, not built)

- [x] Saved searches / lead history per user (Supabase tables + RLS) ✅ built
- [x] Dashboard KPIs wired to real data ✅ built
- [x] Frontend UI to reopen a saved search's leads ✅ built — click a recent-searches row → opens Search tab, loads saved leads via `GET /history/{id}/leads` (filters + CSV/Excel export all work on the loaded set)
- [x] **Leads tab** ✅ built (Jul 13) — master lead library: dedupes all leads by `place_id` (`times_seen` counts repeats), shows which search found each lead, text/status/website filters, per-lead **outreach status** dropdown (new/contacted/interested/passed — persisted via `outreach_status` column on `leads`, optimistic UI), CSV export of filtered set
- [x] **Campaigns tab** ✅ built (Jul 13) — named outreach lists built from the lead library. Backend: `GET/POST /campaigns`, `DELETE /campaigns/{id}`, `GET/POST /campaigns/{id}/leads`, `DELETE /campaigns/{id}/leads/{place_id}` (`app/services/campaigns.py`). List view shows per-campaign lead count, % worked progress bar, and interested count; detail view is a lead table with status dropdowns (shared with library), remove-from-campaign, and CSV export. Leads page gained checkbox selection + a bulk "Add to campaign…" picker (with inline "+ New campaign"). Deleting a campaign keeps leads in the library.
- [x] **Exports tab** — dropped (Jul 13); redundant with per-page CSV/Excel on Search, Leads, and Campaigns. Excel export added to Leads + Campaigns to match Search.
- [x] **Sales coach foundation** ✅ built (Jul 13) — no live AI yet. **Scripts** tab: CRUD for cold-call frameworks (ordered steps of {title, body}, seeded with a starter template). **Sessions** tab: one record per call (lead snapshot + optional script + outcome + notes), created from a library lead or manual name; detail view is a two-column review — transcript (empty until live coach) + notes on the left, attached script reference on the right; outcome badge + status select. Backend `scripts`/`sessions`/`session_events` tables + services/routes. This is the container the real-time AI coach will write into (`session_events` role=coach/prospect/rep).
- [x] **Offers + offer-fit qualification** ✅ built (Jul 13) — **Offers** tab (CRUD: name, pitch, pricing, `fit_type`). Offer-fit scoring (`frontend/src/lib/offerFit.ts`) ranks library leads by fit using signals we already scrape (website presence, review count, rating). Leads page gained an "Offer fit" selector + "Strong fit only" toggle + a Fit column (Strong/Possible/Weak with reason), auto-sorted by fit. Sessions "New session" form can pick a saved offer to prefill the offer text. Decision: offer is deliberately NOT a Search input (doesn't change Google results); it's a lens on the library instead — better than the competitor's confused search-box approach.
- [ ] **AI sales coach (real-time)** — next big build. Plan: prototype audio via **laptop mic on speakerphone** (getUserMedia → streaming STT), later move to **Twilio browser softphone** for dual-channel audio. Streaming LLM prompt = attached script + lead context + rolling transcript → suggested next line, written as `coach` events on the open session. Needs a live call UI (current lead, script, transcript, suggestion) + websockets + latency tuning.
- [ ] Multi-service batch search in web UI
- [ ] Phone-present filter
- [ ] Deep search progress streaming / background jobs
- [ ] Railway deploy (configs exist: `railway.json` in both dirs) ✅ deployed Jul 12 — see **Deployment** section below
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
