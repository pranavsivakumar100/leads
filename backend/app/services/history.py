"""Persist searches + leads to Supabase and read them back for the dashboard."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from supabase import Client

logger = logging.getLogger(__name__)

_LEAD_FIELDS = (
    "place_id",
    "name",
    "phone",
    "website",
    "address",
    "rating",
    "reviews",
    "score",
    "has_website",
    "status",
    "maps_uri",
    "hours",
)

# Fields returned when reopening a saved search (includes outreach status).
_SAVED_LEAD_FIELDS = _LEAD_FIELDS + ("outreach_status", "follow_up")


def save_search(
    client: Client,
    user_id: str,
    *,
    service: str,
    location: str,
    deep: bool,
    radius_km: float | None,
    leads: list[dict],
) -> str | None:
    """Insert the search + its leads. Returns the search id, or None on failure.

    Persistence is best-effort: a DB hiccup should never fail the search itself.
    """
    try:
        search_row = (
            client.table("searches")
            .insert(
                {
                    "user_id": user_id,
                    "service": service,
                    "location": location,
                    "deep": deep,
                    "radius_km": radius_km,
                    "total_results": len(leads),
                }
            )
            .execute()
        )
        search_id = search_row.data[0]["id"]

        if leads:
            payload = [
                {
                    "user_id": user_id,
                    "search_id": search_id,
                    **{f: lead.get(f) for f in _LEAD_FIELDS},
                }
                for lead in leads
                if lead.get("place_id")
            ]
            # Chunk inserts to stay well under request-size limits.
            for i in range(0, len(payload), 500):
                client.table("leads").insert(payload[i : i + 500]).execute()

        return search_id
    except Exception:
        logger.exception("Failed to persist search history")
        return None


def list_searches(client: Client, user_id: str, *, limit: int = 20) -> list[dict]:
    res = (
        client.table("searches")
        .select("id, service, location, deep, radius_km, total_results, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def get_search_leads(client: Client, user_id: str, search_id: str) -> list[dict] | None:
    """Leads for one saved search, or None if the search isn't the user's."""
    owner = (
        client.table("searches")
        .select("id")
        .eq("id", search_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not owner.data:
        return None
    res = (
        client.table("leads")
        .select(", ".join(_SAVED_LEAD_FIELDS))
        .eq("search_id", search_id)
        .order("score", desc=True)
        .execute()
    )
    return res.data or []


# A pickup that ends in a few seconds is not a conversation.
CONVERSATION_MIN_SEC = 30
_NOT_A_CONVERSATION = frozenset({"no_answer", "voicemail", "in_progress"})


def _utc_start_of_local_day(tz_name: str) -> str:
    name = (tz_name or "UTC").strip()[:64] or "UTC"
    try:
        tz = ZoneInfo(name)
    except Exception:
        tz = ZoneInfo("UTC")
    now = datetime.now(tz)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.astimezone(timezone.utc).isoformat()


def _talk_seconds(row: dict) -> int | None:
    """Connected time. Prefer the dialer's talk timer; older rows use the wall clock."""
    raw = row.get("duration_sec")
    if raw is not None:
        try:
            return max(0, int(raw))
        except (TypeError, ValueError):
            return None
    started, ended = row.get("started_at"), row.get("ended_at")
    if not started or not ended:
        return None
    try:
        a = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
        b = datetime.fromisoformat(str(ended).replace("Z", "+00:00"))
    except ValueError:
        return None
    return max(0, int((b - a).total_seconds()))


def _is_conversation(row: dict) -> bool:
    if row.get("outcome") in _NOT_A_CONVERSATION:
        return False
    seconds = _talk_seconds(row)
    return seconds is not None and seconds >= CONVERSATION_MIN_SEC


def _today_call_stats(client: Client, user_id: str, tz_name: str) -> tuple[int, int]:
    day_start = _utc_start_of_local_day(tz_name)
    rows = (
        client.table("call_sessions")
        .select("outcome, started_at, ended_at, duration_sec")
        .eq("user_id", user_id)
        .gte("started_at", day_start)
        .execute()
    ).data or []
    return len(rows), sum(1 for row in rows if _is_conversation(row))


def dashboard_stats(client: Client, user_id: str, tz_name: str = "UTC") -> dict:
    searches = (
        client.table("searches")
        .select("location, total_results")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    total_leads = sum(s["total_results"] for s in searches)
    markets = len({s["location"].strip().lower() for s in searches})
    runs = len(searches)
    try:
        dials_today, conversations_today = _today_call_stats(client, user_id, tz_name)
    except Exception:
        logger.exception("Failed to load today's call stats")
        dials_today, conversations_today = 0, 0
    return {
        "total_leads": total_leads,
        "searches_run": runs,
        "markets": markets,
        "avg_leads_per_search": round(total_leads / runs, 1) if runs else 0.0,
        "dials_today": dials_today,
        "conversations_today": conversations_today,
    }
