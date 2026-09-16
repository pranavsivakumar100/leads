# Leadflow session log — Sep 15, 2026

Continuation of [JUL_13.md](./JUL_13.md). Dialer, per-account Settings (BYOK), Follow up, and production key storage.

> **Standing rule:** Append here (or add a new dated file under `context/`) for product, infra, or architecture changes.

---

## Shipped today

### Search — Follow up toggle
- Toggle next to **Called**; independent boolean (`leads.follow_up`)
- `PATCH /leads/{place_id}/follow-up` updates every copy of that place for the user
- Hydrated from the library on scrape / saved-search load; amber/blue so it stays distinct from Called green

### Skills — knowledge bank
- Skills is a document bank (PDF / DOCX / TXT / MD), not Scripts + Offers editors
- Upload stores file in Supabase `knowledge` bucket + extracted text on `knowledge_docs`
- **Use with coach** toggle per doc (off by default). Live coach prompt uses only enabled docs
- Offers/script pickers removed from Sessions and Leads (offer-fit filter dropped)

### Dialer ↔ Sessions
- Placing a call creates a `call_sessions` row; hangup sets `ended_at` then asks **Not interested / Follow up / Meeting booked**
- Those choices wait for the CRM write: Follow up / Meeting booked flag `leads.follow_up`; Follow-up page refreshes when that lands. Skip keeps `connected` / `no_answer`
- During a live call the pad swaps the keypad for the coach. STT taps Twilio **local + remote** MediaStreams (you vs prospect) — no Me/Prospect toggle, no laptop-mic/speakerphone path. Clips go to Whisper on the account’s OpenAI key.
- Sessions is a **call log** (review transcript + notes + outcome). Optional “Log a call” for off-platform. No standalone Live call start

### CRM section
- Sidebar grouped: **Find** (Dashboard, Search) · **CRM** (Follow-up, Leads, Campaigns) · **Call** (Sessions) · **Prep** (Skills)
- **Follow-up** is the work queue for flagged businesses — not a second library. Sorted Interested → Contacted → New → Passed, oldest first
- Pipeline chips filter the queue; **Done** clears the follow-up flag. Click-to-call via the existing dial pad

### Browser dial pad
- Floating **Dial** FAB (bottom-right) — not a new sidebar item. Click again to close
- Popup keypad; drag the header to move; drag any corner to resize; position sticks until refresh
- Click a phone on Search / Leads / Follow-up / Campaigns to open the pad prefilled (`LeadPhone` + `placeId`)
- Twilio Voice JS SDK click-to-call; hang up / mute / DTMF on the pad
- Backend: `GET /voice/status`, `GET /voice/token`, `POST /voice/outbound` (TwiML `<Dial>`)
- TwiML App `AP31cccb0e406a1c527bb091f69a146f60` — Voice URL must be public (tunnel locally, Railway in prod)
- Secrets only in `backend/.env` / `user_settings` (never committed). Rotate Twilio auth token + API key after this setup

### Account menu + Settings
- Sidebar profile opens Settings / Log out instead of signing out immediately
- **Settings** (not in primary nav): usage (leads, searches, sessions, Twilio balance) + Google Maps, OpenAI, Twilio keys
- Keys on `user_settings` (per user). Production Search / Coach / Dialer use **only that account’s keys** — never the server `.env`
- Local: `ALLOW_ENV_KEY_FALLBACK=true` lets `.env` stand in until keys are saved. Keep **false** on Railway
- Settings GET never returns full secrets (`••••last4` only); status: Connected / Local .env / Not set
- Coach **Model** is a custom scrollable listbox (app chrome, sticky family headers, check on current model). Live chat models from the account’s OpenAI-compatible `/v1/models` via `GET /settings/models`. Dated snapshots / embeddings / TTS / image omitted. No key → public OpenAI chat-model fallback

### Production (Leadflow Supabase + Railway)
- Table `user_settings` on project `vdwprpfcwrglorhlmyuj` (not Dreams)
- Table `knowledge_docs` + private Storage bucket `knowledge` (same project). Service role writes; extracted_text capped at 24k chars; max file 8 MB
- Founder `pranav.sivakumar100@gmail.com` (`0c858017-e231-4ead-b2ce-36c3aba5690d`) has Google / OpenAI / Twilio on `user_settings` (re-upserted this evening from local `.env`). Caller ID `+19084956516`
- Railway CLI deploys succeeded: backend `60b01d1f`, frontend `91330921`. GitHub roots restored to `/backend` and `/frontend`
- Railway: `ALLOW_ENV_KEY_FALLBACK=false`, `PUBLIC_API_BASE_URL=https://backend-production-501f.up.railway.app`
- Live: `/api/v1/settings`, `/api/v1/settings/models`, `/api/v1/voice/*`, `/api/v1/skills/docs`
- Cursor’s global Supabase MCP is still pinned to Dreams (`toskpiypmhgefwxcbuto`). For this repo, use `backend/.env` (`SUPABASE_URL` + service role) — do not run Leadflow migrations through that MCP

### Prior (Aug 5) — moved here from JUL_13
- Search **Called** toggle (on = `contacted`, off = `new`); same `PATCH /leads/{place_id}/status` as Leads; hydrates from the library

---

## Sidebar (current)

**Find** — Dashboard, Search  
**CRM** — Follow-up, Leads, Campaigns  
**Call** — Sessions  
**Prep** — Skills  
Settings via account menu · Dial FAB (not a nav item)

---

## Next up (not built)

- [ ] CRM pipeline extras — due dates, activity timeline, contact person on the business
- [ ] **Coach v2** — streaming STT + suggestions (SSE/websocket) for lower latency than Whisper clips
- [ ] **Outbound workflow** — phone-present filter; campaign dial mode (one lead at a time, big Call button, quick status, auto-advance)
- [ ] Multi-service batch search in web UI
- [ ] Deep search progress streaming / background jobs
- [ ] Root README with setup instructions
- [ ] Transfer Leadflow Supabase project out of the Dreams org (see JUL_12)

---

## Key files added today

```
backend/app/api/routes/settings.py
backend/app/api/routes/voice.py
backend/app/schemas/settings.py
backend/app/services/settings.py
backend/app/services/voice.py
backend/app/api/routes/knowledge.py
backend/app/schemas/knowledge.py
backend/app/services/knowledge.py
frontend/src/components/crm/FollowUpPage.tsx
frontend/src/components/dialer/DialCoach.tsx
frontend/src/lib/api/skills.ts
frontend/src/components/dialer/DialPad.tsx
frontend/src/components/dialer/LeadPhone.tsx
frontend/src/components/settings/SettingsPage.tsx
frontend/src/components/settings/ModelSelect.tsx
frontend/src/hooks/useDialer.tsx
frontend/src/lib/api/settings.ts
frontend/src/lib/api/voice.ts
frontend/src/lib/phone.ts
```
