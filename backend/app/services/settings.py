"""Per-user API keys overlaying server env, plus settings snapshots for the UI."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from supabase import Client

from app.core.config import Settings

logger = logging.getLogger(__name__)

CUSTOMER_FIELDS = (
    "google_maps_api_key",
    "openai_api_key",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_api_key",
    "twilio_api_secret",
    "twilio_twiml_app_sid",
    "twilio_caller_id",
)

# Safe app defaults — not billed credentials.
DEFAULT_FIELDS = (
    "coach_model",
    "coach_base_url",
    "public_api_base_url",
)

ALL_FIELDS = CUSTOMER_FIELDS + DEFAULT_FIELDS

# Chat-completions aliases when the account has no key yet, or /models fails.
FALLBACK_CHAT_MODELS: tuple[tuple[str, str], ...] = (
    ("gpt-5.5", "GPT-5+"),
    ("gpt-5.5-pro", "GPT-5+"),
    ("gpt-5.4", "GPT-5+"),
    ("gpt-5.4-mini", "GPT-5+"),
    ("gpt-5.4-nano", "GPT-5+"),
    ("gpt-5.4-pro", "GPT-5+"),
    ("gpt-5.2", "GPT-5+"),
    ("gpt-5.2-chat-latest", "GPT-5+"),
    ("gpt-5.2-pro", "GPT-5+"),
    ("gpt-5.1", "GPT-5+"),
    ("gpt-5.1-chat-latest", "GPT-5+"),
    ("gpt-5", "GPT-5+"),
    ("gpt-5-chat-latest", "GPT-5+"),
    ("gpt-5-mini", "GPT-5+"),
    ("gpt-5-nano", "GPT-5+"),
    ("gpt-5-pro", "GPT-5+"),
    ("gpt-4.1", "GPT-4.1"),
    ("gpt-4.1-mini", "GPT-4.1"),
    ("gpt-4.1-nano", "GPT-4.1"),
    ("gpt-4o", "GPT-4o"),
    ("gpt-4o-mini", "GPT-4o"),
    ("gpt-4-turbo", "GPT-4"),
    ("gpt-4", "GPT-4"),
    ("o3", "OpenAI o-series"),
    ("o3-mini", "OpenAI o-series"),
    ("o4-mini", "OpenAI o-series"),
    ("o1", "OpenAI o-series"),
    ("o1-pro", "OpenAI o-series"),
    ("gpt-3.5-turbo", "GPT-3.5"),
)

_NON_CHAT = (
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "dall_e",
    "gpt-image",
    "chatgpt-image",
    "transcribe",
    "moderation",
    "sora",
    "realtime",
    "babbage",
    "davinci",
    "instruct",
    "search-api",
    "search-preview",
    "codex",
    "chat-latest",
    "gpt-live",
)
_SNAPSHOT = re.compile(r"-(?:\d{4}-\d{2}-\d{2}|\d{4}|16k)$")
_MODELS_TIMEOUT = httpx.Timeout(12.0, connect=4.0)


def resolve(client: Client | None, user_id: str, settings: Settings) -> EffectiveSecrets:
    """Account keys first. Server .env only when ALLOW_ENV_KEY_FALLBACK is on."""
    row = load_row(client, user_id) if client is not None else {}
    allow_env = settings.allow_env_key_fallback

    def pick(field: str) -> str:
        user_val = str(row.get(field) or "").strip()
        if user_val:
            return user_val
        env_val = (getattr(settings, field, "") or "").strip()
        if field in DEFAULT_FIELDS:
            return env_val
        if allow_env:
            return env_val
        return ""

    values = {field: pick(field) for field in ALL_FIELDS}
    if not values.get("coach_model"):
        values["coach_model"] = "gpt-4o-mini"
    if not values.get("coach_base_url"):
        values["coach_base_url"] = "https://api.openai.com/v1"
    return EffectiveSecrets(**values)


def field_source(
    row: dict, field: str, settings: Settings
) -> str:
    if str(row.get(field) or "").strip():
        return "account"
    env_val = (getattr(settings, field, "") or "").strip()
    if field in CUSTOMER_FIELDS and settings.allow_env_key_fallback and env_val:
        return "env"
    if field in DEFAULT_FIELDS and env_val:
        return "env"
    return "none"


def integration_source(row: dict, fields: tuple[str, ...], settings: Settings) -> str:
    sources = {field_source(row, f, settings) for f in fields}
    if "account" in sources:
        return "account"
    if "env" in sources:
        return "env"
    return "none"


@dataclass(frozen=True)
class EffectiveSecrets:
    google_maps_api_key: str
    openai_api_key: str
    coach_model: str
    coach_base_url: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_api_key: str
    twilio_api_secret: str
    twilio_twiml_app_sid: str
    twilio_caller_id: str
    public_api_base_url: str

    @property
    def scraping_enabled(self) -> bool:
        return bool(self.google_maps_api_key)

    @property
    def coach_enabled(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def voice_enabled(self) -> bool:
        return bool(
            self.twilio_account_sid
            and self.twilio_api_key
            and self.twilio_api_secret
            and self.twilio_twiml_app_sid
            and self.twilio_caller_id
        )


def _is_chat_model(model_id: str) -> bool:
    low = model_id.lower()
    if any(token in low for token in _NON_CHAT):
        return False
    if "-audio" in low or low.endswith("-audio"):
        return False
    if _SNAPSHOT.search(model_id):
        return False
    return bool(model_id.strip())


def _provider_label(model_id: str, owned_by: str = "") -> str:
    if "/" in model_id:
        prefix = model_id.split("/", 1)[0].strip()
        aliases = {
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "google": "Google",
            "meta-llama": "Meta",
            "mistralai": "Mistral",
            "groq": "Groq",
            "x-ai": "xAI",
            "deepseek": "DeepSeek",
        }
        return aliases.get(prefix.lower(), prefix)
    low = model_id.lower()
    if low.startswith(("o1", "o3", "o4")):
        return "OpenAI o-series"
    if low.startswith("gpt-3.5"):
        return "GPT-3.5"
    if low.startswith("gpt-4o"):
        return "GPT-4o"
    if low.startswith("gpt-4.1"):
        return "GPT-4.1"
    if low.startswith("gpt-4"):
        return "GPT-4"
    if low.startswith(("gpt-5", "gpt-6")):
        return "GPT-5+"
    if owned_by and owned_by not in {"system", "openai", "openai-internal"}:
        return owned_by
    return "OpenAI"


def list_chat_models(api_key: str, base_url: str) -> tuple[list[dict[str, str]], str, str]:
    """Return (models, source, error). source is api or fallback."""
    fallback = [
        {"id": model_id, "provider": provider}
        for model_id, provider in FALLBACK_CHAT_MODELS
    ]
    key = (api_key or "").strip()
    origin = (base_url or "https://api.openai.com/v1").rstrip("/")
    if not key:
        return fallback, "fallback", ""

    try:
        resp = httpx.get(
            f"{origin}/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=_MODELS_TIMEOUT,
        )
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPError as exc:
        logger.info("OpenAI models list failed", exc_info=True)
        return fallback, "fallback", f"Couldn't load models from the API ({exc})."
    except ValueError:
        return fallback, "fallback", "The models API returned an unexpected response."

    rows = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return fallback, "fallback", "The models API returned an unexpected response."

    seen: set[str] = set()
    models: list[dict[str, str]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        model_id = str(row.get("id") or "").strip()
        if not model_id or model_id in seen or not _is_chat_model(model_id):
            continue
        seen.add(model_id)
        models.append(
            {
                "id": model_id,
                "provider": _provider_label(model_id, str(row.get("owned_by") or "")),
            }
        )
    if not models:
        return fallback, "fallback", "No chat models were returned for this key."
    models.sort(key=lambda item: (item["provider"], item["id"]))
    return models, "api", ""


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    return f"••••{value[-4:]}"


def user_id_from_client_from(from_field: str) -> str | None:
    """Parse Twilio Client identity `client:user_{uuidhex}` back to a UUID."""
    value = (from_field or "").strip()
    if value.startswith("client:"):
        value = value[7:]
    if not value.startswith("user_"):
        return None
    hex_id = value[5:]
    if len(hex_id) != 32 or any(c not in "0123456789abcdef" for c in hex_id.lower()):
        return None
    return (
        f"{hex_id[0:8]}-{hex_id[8:12]}-{hex_id[12:16]}-"
        f"{hex_id[16:20]}-{hex_id[20:32]}"
    )


def load_row(client: Client, user_id: str) -> dict:
    try:
        res = (
            client.table("user_settings")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.warning("user_settings read failed", exc_info=True)
        return {}
    rows = res.data or []
    return rows[0] if rows else {}


def save_overrides(
    client: Client, user_id: str, updates: dict[str, str]
) -> dict:
    """Merge non-empty updates into the user's settings row."""
    clean = {k: v.strip() for k, v in updates.items() if k in ALL_FIELDS and v.strip()}
    if not clean:
        return load_row(client, user_id)
    existing = load_row(client, user_id)
    payload = {
        **{k: existing.get(k) for k in ALL_FIELDS if existing.get(k)},
        **clean,
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    client.table("user_settings").upsert(payload, on_conflict="user_id").execute()
    return load_row(client, user_id)


def count_sessions(client: Client, user_id: str) -> int:
    try:
        res = (
            client.table("call_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return int(res.count or 0)
    except Exception:
        logger.warning("session count failed", exc_info=True)
        return 0


def twilio_balance(secrets: EffectiveSecrets) -> tuple[str | None, str | None]:
    """Return (balance, currency) using Twilio REST, or (None, None)."""
    sid = secrets.twilio_account_sid
    token = secrets.twilio_auth_token
    if not sid or not token:
        return None, None
    try:
        from twilio.rest import Client as TwilioClient

        client = TwilioClient(sid, token)
        bal = client.balance.fetch()
        return (getattr(bal, "balance", None), getattr(bal, "currency", None))
    except Exception:
        logger.info("Twilio balance fetch failed", exc_info=True)
        return None, None
