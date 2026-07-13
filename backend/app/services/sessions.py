"""Call sessions — one per call, reviewable later like a chat transcript."""
from __future__ import annotations

from datetime import datetime, timezone

from supabase import Client

_SESSION_COLS = (
    "id, lead_place_id, lead_name, campaign_id, script_id, offer, outcome, "
    "notes, started_at, ended_at"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_sessions(client: Client, user_id: str) -> list[dict]:
    sessions = (
        client.table("call_sessions")
        .select(_SESSION_COLS)
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .execute()
    ).data or []
    if not sessions:
        return []

    # Attach event counts without pulling full transcripts.
    events = (
        client.table("session_events")
        .select("session_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []
    counts: dict[str, int] = {}
    for e in events:
        counts[e["session_id"]] = counts.get(e["session_id"], 0) + 1
    for s in sessions:
        s["event_count"] = counts.get(s["id"], 0)
    return sessions


def get_session(client: Client, user_id: str, session_id: str) -> dict | None:
    res = (
        client.table("call_sessions")
        .select(_SESSION_COLS)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        return None
    session = res.data[0]
    events = (
        client.table("session_events")
        .select("id, role, text, t_ms, created_at")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .order("t_ms")
        .order("created_at")
        .execute()
    ).data or []
    session["events"] = events
    session["event_count"] = len(events)
    return session


def create_session(
    client: Client,
    user_id: str,
    *,
    lead_place_id: str,
    lead_name: str,
    campaign_id: str | None,
    script_id: str | None,
    offer: str,
) -> dict:
    session = (
        client.table("call_sessions")
        .insert(
            {
                "user_id": user_id,
                "lead_place_id": lead_place_id,
                "lead_name": lead_name,
                "campaign_id": campaign_id,
                "script_id": script_id,
                "offer": offer,
            }
        )
        .execute()
    ).data[0]
    session["events"] = []
    session["event_count"] = 0
    return session


def update_session(
    client: Client, user_id: str, session_id: str, fields: dict
) -> dict | None:
    payload = dict(fields)
    if payload.pop("ended", None):
        payload["ended_at"] = _now()
    if not payload:
        return get_session(client, user_id, session_id)
    res = (
        client.table("call_sessions")
        .update(payload)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        return None
    return get_session(client, user_id, session_id)


def delete_session(client: Client, user_id: str, session_id: str) -> bool:
    res = (
        client.table("call_sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def add_event(
    client: Client,
    user_id: str,
    session_id: str,
    *,
    role: str,
    text: str,
    t_ms: int,
) -> dict | None:
    # Ensure the session belongs to the user before appending.
    owns = (
        client.table("call_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not owns.data:
        return None
    return (
        client.table("session_events")
        .insert(
            {
                "session_id": session_id,
                "user_id": user_id,
                "role": role,
                "text": text,
                "t_ms": t_ms,
            }
        )
        .execute()
    ).data[0]
