# Leadflow session log — Nov 18, 2026

Continuation of [SEP_16.md](./SEP_16.md).

> **Standing rule:** Append here (or add a new dated file under `context/`) for product, infra, or architecture changes.

---

## Shipped today

### Dashboard dials and conversations
- Dashboard KPI row adds **Dials today** (call sessions started since local midnight) and **Conversations** (same day, someone answered, talk time at least 30 seconds)
- "Today" uses the browser timezone, sent as `tz` on `GET /history/stats`
- New calls store connected time on `call_sessions.duration_sec` (Leadflow project `vdwprpfcwrglorhlmyuj`). No-answer and voicemail never count. Older rows have a null duration and fall back to `ended_at - started_at`, which includes ring time
