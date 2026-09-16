"""The user's master lead library — deduped across all searches."""
from __future__ import annotations

from supabase import Client

OUTREACH_STATUSES = ("new", "contacted", "interested", "passed")

_FETCH_LIMIT = 10000


def list_leads(client: Client, user_id: str) -> list[dict]:
    """All unique leads for a user, deduped by place_id (latest wins).

    Each row carries the service/location of the search that found it, plus
    how many searches surfaced it.
    """
    res = (
        client.table("leads")
        .select(
            "place_id, name, phone, website, address, rating, reviews, score, "
            "has_website, status, maps_uri, hours, outreach_status, follow_up, "
            "created_at, searches(service, location)"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(_FETCH_LIMIT)
        .execute()
    )
    rows = res.data or []

    deduped: dict[str, dict] = {}
    for row in rows:
        pid = row["place_id"]
        search = row.pop("searches", None) or {}
        if pid not in deduped:
            row["service"] = search.get("service", "")
            row["location"] = search.get("location", "")
            row["times_seen"] = 1
            deduped[pid] = row
        else:
            deduped[pid]["times_seen"] += 1

    leads = list(deduped.values())
    leads.sort(key=lambda x: (x.get("score") or 0, x.get("reviews") or 0), reverse=True)
    return leads


def set_status(client: Client, user_id: str, place_id: str, status: str) -> bool:
    """Update outreach status on every copy of this lead the user owns."""
    if status not in OUTREACH_STATUSES:
        return False
    # update() already returns representation; .select() after .eq() 500s on
    # this supabase-py (FilterRequestBuilder has no select).
    res = (
        client.table("leads")
        .update({"outreach_status": status})
        .eq("user_id", user_id)
        .eq("place_id", place_id)
        .execute()
    )
    return bool(res.data)


def set_follow_up(
    client: Client, user_id: str, place_id: str, follow_up: bool
) -> bool:
    """Set follow-up flag on every copy of this lead the user owns."""
    res = (
        client.table("leads")
        .update({"follow_up": follow_up})
        .eq("user_id", user_id)
        .eq("place_id", place_id)
        .execute()
    )
    return bool(res.data)
