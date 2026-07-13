"""Offers — what the user sells. Drives lead qualification and coach context."""
from __future__ import annotations

from datetime import datetime, timezone

from supabase import Client

_COLS = "id, name, description, pricing, fit_type, created_at, updated_at"


def list_offers(client: Client, user_id: str) -> list[dict]:
    return (
        client.table("offers")
        .select(_COLS)
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    ).data or []


def create_offer(
    client: Client,
    user_id: str,
    *,
    name: str,
    description: str,
    pricing: str,
    fit_type: str,
) -> dict:
    return (
        client.table("offers")
        .insert(
            {
                "user_id": user_id,
                "name": name,
                "description": description,
                "pricing": pricing,
                "fit_type": fit_type,
            }
        )
        .execute()
    ).data[0]


def update_offer(
    client: Client, user_id: str, offer_id: str, fields: dict
) -> dict | None:
    if not fields:
        res = (
            client.table("offers")
            .select(_COLS)
            .eq("id", offer_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None
    fields = {**fields, "updated_at": datetime.now(timezone.utc).isoformat()}
    res = (
        client.table("offers")
        .update(fields)
        .eq("id", offer_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete_offer(client: Client, user_id: str, offer_id: str) -> bool:
    res = (
        client.table("offers")
        .delete()
        .eq("id", offer_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
