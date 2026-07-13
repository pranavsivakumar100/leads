"""Campaigns — named outreach lists built from the user's lead library."""
from __future__ import annotations

from supabase import Client

from app.services.library import list_leads as list_library_leads


def _status_counts(statuses: list[str]) -> dict:
    counts = {"new": 0, "contacted": 0, "interested": 0, "passed": 0}
    for s in statuses:
        if s in counts:
            counts[s] += 1
    return counts


def list_campaigns(client: Client, user_id: str) -> list[dict]:
    """All campaigns with lead counts and per-status breakdown."""
    campaigns = (
        client.table("campaigns")
        .select("id, name, description, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    if not campaigns:
        return []

    members = (
        client.table("campaign_leads")
        .select("campaign_id, place_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    # Status lives on the leads table; map place_id -> outreach_status.
    place_ids = list({m["place_id"] for m in members})
    status_by_place: dict[str, str] = {}
    for i in range(0, len(place_ids), 200):
        chunk = place_ids[i : i + 200]
        rows = (
            client.table("leads")
            .select("place_id, outreach_status")
            .eq("user_id", user_id)
            .in_("place_id", chunk)
            .execute()
        ).data or []
        for r in rows:
            status_by_place[r["place_id"]] = r["outreach_status"]

    by_campaign: dict[str, list[str]] = {}
    for m in members:
        by_campaign.setdefault(m["campaign_id"], []).append(
            status_by_place.get(m["place_id"], "new")
        )

    for c in campaigns:
        statuses = by_campaign.get(c["id"], [])
        c["lead_count"] = len(statuses)
        c["status_counts"] = _status_counts(statuses)
    return campaigns


def create_campaign(
    client: Client, user_id: str, *, name: str, description: str = ""
) -> dict:
    row = (
        client.table("campaigns")
        .insert({"user_id": user_id, "name": name, "description": description})
        .execute()
    ).data[0]
    row["lead_count"] = 0
    row["status_counts"] = _status_counts([])
    return row


def delete_campaign(client: Client, user_id: str, campaign_id: str) -> bool:
    res = (
        client.table("campaigns")
        .delete()
        .eq("id", campaign_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def _owns_campaign(client: Client, user_id: str, campaign_id: str) -> bool:
    res = (
        client.table("campaigns")
        .select("id")
        .eq("id", campaign_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def add_leads(
    client: Client, user_id: str, campaign_id: str, place_ids: list[str]
) -> int | None:
    """Add leads to a campaign (idempotent). Returns count added, or None if not owner."""
    if not _owns_campaign(client, user_id, campaign_id):
        return None
    if not place_ids:
        return 0
    rows = [
        {"campaign_id": campaign_id, "user_id": user_id, "place_id": pid}
        for pid in dict.fromkeys(place_ids)
    ]
    res = (
        client.table("campaign_leads")
        .upsert(rows, on_conflict="campaign_id,place_id", ignore_duplicates=True)
        .execute()
    )
    return len(res.data or [])


def remove_lead(
    client: Client, user_id: str, campaign_id: str, place_id: str
) -> bool:
    res = (
        client.table("campaign_leads")
        .delete()
        .eq("campaign_id", campaign_id)
        .eq("user_id", user_id)
        .eq("place_id", place_id)
        .execute()
    )
    return bool(res.data)


def campaign_leads(
    client: Client, user_id: str, campaign_id: str
) -> list[dict] | None:
    """Library-style lead rows for one campaign, or None if not the owner."""
    if not _owns_campaign(client, user_id, campaign_id):
        return None
    members = (
        client.table("campaign_leads")
        .select("place_id")
        .eq("campaign_id", campaign_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []
    wanted = {m["place_id"] for m in members}
    if not wanted:
        return []
    # Reuse the deduped library and filter to this campaign's members.
    return [l for l in list_library_leads(client, user_id) if l["place_id"] in wanted]
