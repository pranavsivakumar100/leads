# Leadflow session log — Jul 13, 2026

Continuation of [JUL_12.md](./JUL_12.md). This session focused on outbound workflow (campaigns), sales-coach infrastructure, offer-aware lead qualification, and the first live AI coach prototype.

Sep 15 work: [SEP_15.md](./SEP_15.md).

---

## Shipped today

### Campaigns
- Supabase: `campaigns`, `campaign_leads` (PK `campaign_id, place_id`), owner RLS
- Backend: `GET/POST /campaigns`, `DELETE /campaigns/{id}`, `GET/POST /campaigns/{id}/leads`, `DELETE /campaigns/{id}/leads/{place_id}`
- Frontend: Campaigns tab — list cards with progress bar (% worked), detail lead table, CSV + Excel export
- Leads page: checkbox selection + bulk "Add to campaign…" (existing or inline new campaign)

### Exports tab — dropped
- Redundant with per-page CSV/Excel on Search, Leads, Campaigns
- Added Excel export to Leads + Campaigns to match Search

### Sales coach foundation
- Supabase: `scripts`, `call_sessions` (+ `offer` column), `session_events`
- **Skills** tab (Scripts + Offers combined via segmented toggle — replaced separate Scripts/Offers nav items)
- **Scripts**: ordered steps `{title, body}`, starter cold-call template on create
- **Sessions**: one record per call; create from library lead or manual name; attach script + offer; outcome + notes; review UI (transcript + script reference)
- Backend routes: `/scripts`, `/sessions`, `/sessions/{id}/events`

### Offers + offer-fit
- Supabase: `offers` (name, description, pricing, `fit_type`)
- Backend: `GET/POST /offers`, `PATCH/DELETE /offers/{id}`
- **Offers** (under Skills): CRUD with fit types — `any`, `no_website`, `few_reviews`, `low_rating`, `high_volume`
- **Leads**: "Offer fit" filter, Fit column (Strong/Possible/Weak + reason), "Strong fit only" toggle, sorted by fit score (`frontend/src/lib/offerFit.ts`)
- Sessions: pick saved offer to prefill offer text; remembers last offer in `localStorage`
- **Product decision:** offer is NOT a Search input (doesn't change Google results); it's a lens on the library — cleaner than competitor's confused search-box dropdown

### UI de-slop (vibecoded-design-tells audit)
- Replaced sparkles icon on Skills nav with book icon (sparkles = named AI tell)
- Removed stray `#1d4ed8` accent fallbacks; unified on emerald `--accent`
- Script editor: text ↑↓ → chevron SVGs + disabled icon-btn state

### AI sales coach — live call mode (v1)
- **Audio path:** laptop mic on speakerphone → browser **Web Speech API** (Chrome, zero STT cost)
- `frontend/src/hooks/useSpeech.ts` — continuous recognition, auto-restart on silence
- `frontend/src/components/sessions/LiveCallView.tsx` — live call screen
- Me / Prospect toggle (single-channel mic can't separate speakers)
- Live transcript + interim text; utterances persist as `rep`/`prospect` session events
- Coach panel: auto-suggest after prospect speaks (toggle) + manual "Suggest next line"
- Backend: `POST /sessions/{id}/coach` → `app/services/coach.py`
  - Prompt: offer + script steps + last 16 transcript turns
  - Any OpenAI-compatible API (`OPENAI_API_KEY`, `COACH_MODEL` default `gpt-4o-mini`, `COACH_BASE_URL`)
  - Suggestion saved as `coach` session event
  - 503 when `OPENAI_API_KEY` missing (transcription still works)
- Pinned `httpx==0.28.1` in `requirements.txt`
- `backend/.env.example` documents coach env vars

---

## Git

| Commit | Summary |
|---|---|
| `759dcdd` | Campaigns + drop Exports tab |
| `be2f301` | Sales-coach foundation: scripts, sessions, offers, offer-fit |
| `add4584` | De-slop new UI |
| *(this push)* | Live AI coach v1 |

---

## Env / deploy notes

**Coach (new):**
```bash
# backend/.env and Railway backend service
OPENAI_API_KEY=sk-...
COACH_MODEL=gpt-4o-mini          # optional
COACH_BASE_URL=https://api.openai.com/v1   # optional; any OpenAI-compatible endpoint
```

- Transcription works without `OPENAI_API_KEY`; suggestions require it
- Set on Railway backend + redeploy: `cd backend && railway up . --path-as-root --service backend --detach`
- New Supabase tables this session: `campaigns`, `campaign_leads`, `scripts`, `call_sessions`, `session_events`, `offers` — all applied to project `vdwprpfcwrglorhlmyuj`

**Prod URLs** (unchanged): frontend `https://frontend-production-a5c6.up.railway.app`, backend `https://backend-production-501f.up.railway.app`

---

## Sidebar (as of this session)

Dashboard · Search · Leads · Campaigns · Sessions · Skills

Later work (Aug 5 Called toggle, Sep 15 dialer / Settings / Follow up) lives in [SEP_15.md](./SEP_15.md).

---

## Next up (not built)

- [ ] **Coach v2** — stream dual-channel call audio into STT + suggestions (SSE/websocket)
- [ ] **Outbound workflow** — phone-present filter; campaign dial mode (one lead at a time, big Call button, quick status, auto-advance)
- [ ] Multi-service batch search in web UI
- [ ] Deep search progress streaming / background jobs
- [ ] Root README with setup instructions

---

## Key files added today

```
backend/app/services/campaigns.py
backend/app/services/scripts.py
backend/app/services/sessions.py
backend/app/services/offers.py
backend/app/services/coach.py
backend/app/schemas/coach.py
backend/app/api/routes/campaigns.py
backend/app/api/routes/scripts.py
backend/app/api/routes/sessions.py
backend/app/api/routes/offers.py
frontend/src/components/campaigns/CampaignsPage.tsx
frontend/src/components/skills/SkillsPage.tsx
frontend/src/components/scripts/ScriptsPage.tsx
frontend/src/components/offers/OffersPage.tsx
frontend/src/components/sessions/SessionsPage.tsx
frontend/src/components/sessions/LiveCallView.tsx
frontend/src/hooks/useSpeech.ts
frontend/src/lib/api/coach.ts
frontend/src/lib/offerFit.ts
```
