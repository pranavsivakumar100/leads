from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Leadflow API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Comma-separated list of allowed CORS origins.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Google Maps Platform (Places API New) — used by the lead scraper.
    google_maps_api_key: str = ""

    # Supabase
    supabase_url: str = ""
    # Use the service-role key on the server (never expose it to the frontend).
    supabase_service_key: str = ""

    # AI sales coach — any OpenAI-compatible chat completions API.
    openai_api_key: str = ""
    coach_model: str = "gpt-4o-mini"
    coach_base_url: str = "https://api.openai.com/v1"

    # Twilio Voice — browser dialer (never expose these to the frontend).
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_api_key: str = ""
    twilio_api_secret: str = ""
    twilio_twiml_app_sid: str = ""
    twilio_caller_id: str = ""
    # Public origin Twilio uses to fetch TwiML (Railway in prod; a tunnel locally).
    public_api_base_url: str = ""

    # When true, users without their own keys fall back to this server's .env.
    # Local only. MUST stay false in production so customers never share your
    # OpenAI / Twilio / Google credentials.
    allow_env_key_fallback: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def persistence_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
