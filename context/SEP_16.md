# Leadflow session log — Sep 16, 2026

Continuation of [SEP_15.md](./SEP_15.md).

> **Standing rule:** Append here (or add a new dated file under `context/`) for product, infra, or architecture changes.

---

## Shipped today

### Open / Closed badge
- Search, Leads, Follow-up, and Campaigns show a pill next to the business name: **Open**, **Closed**, or **Temp. closed**
- Hours come from Google Places `regularOpeningHours` + `timeZone` on the existing Text Search request (already Enterprise SKU because of phone / rating / website — no extra SKU)
- Weekly schedule is stored on `leads.hours` (jsonb). The UI computes open/closed in the place’s timezone at render time, so it stays current without a live Places call per row
- Hover the badge for today’s close/open time plus the weekly hours. No hours from Google → no badge. Old saved leads stay blank until re-scraped
- Temporarily closed uses `businessStatus` (`CLOSED_TEMPORARILY`)

### Hangup CRM save
- Disposition (Follow up / Meeting booked / Not interested) 500’d: `set_follow_up` / `set_status` chained `.select()` after `.eq()`, which this supabase-py build does not support. Updates already return the row; the extra select was removed. Retry the hangup choice — the call session itself had already saved.

### Dialer 31005 “webhook” message
- TwiML Voice URL is Railway (`/api/v1/voice/outbound`) and is reachable. Quick Cloudflare tunnels die; do not point Twilio at trycloudflare.
- SDK 31005 is a generic connect error (expired token, declined, signaling drop), not proof the webhook is down. Device now `register()`s, only reuses a Registered device, refreshes the token, and retries 31005 once. Error copy no longer blames the webhook.

### Prod frontend build
- GitHub `ce77c41` deployed: backend OK, frontend **failed** (`tsc` on `useCallTranscript` Uint8Array vs DOM lib). Prod UI stayed on the last successful frontend from Sep 16 00:08. Cast the analyser buffer so `npm run build` passes.

---

## Key files

```
frontend/src/lib/hours.ts
frontend/src/components/leads/LeadNameCell.tsx
backend/app/services/leads.py   (extract_hours)
```
