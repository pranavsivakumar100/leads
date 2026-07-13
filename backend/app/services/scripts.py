"""Call scripts / frameworks the rep works from during a call."""
from __future__ import annotations

from supabase import Client


def list_scripts(client: Client, user_id: str) -> list[dict]:
    return (
        client.table("scripts")
        .select("id, name, description, steps, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    ).data or []


def get_script(client: Client, user_id: str, script_id: str) -> dict | None:
    res = (
        client.table("scripts")
        .select("id, name, description, steps, created_at, updated_at")
        .eq("id", script_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def create_script(
    client: Client, user_id: str, *, name: str, description: str, steps: list[dict]
) -> dict:
    return (
        client.table("scripts")
        .insert(
            {
                "user_id": user_id,
                "name": name,
                "description": description,
                "steps": steps,
            }
        )
        .execute()
    ).data[0]


def update_script(
    client: Client, user_id: str, script_id: str, fields: dict
) -> dict | None:
    if not fields:
        return get_script(client, user_id, script_id)
    from datetime import datetime, timezone

    fields = {**fields, "updated_at": datetime.now(timezone.utc).isoformat()}
    res = (
        client.table("scripts")
        .update(fields)
        .eq("id", script_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0] if res.data else None


def delete_script(client: Client, user_id: str, script_id: str) -> bool:
    res = (
        client.table("scripts")
        .delete()
        .eq("id", script_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
