from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client | None:
    """Return a cached Supabase client, or None if persistence isn't configured."""
    settings = get_settings()
    if not settings.persistence_enabled:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_key)
