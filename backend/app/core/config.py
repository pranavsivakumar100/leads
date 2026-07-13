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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def persistence_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def scraping_enabled(self) -> bool:
        return bool(self.google_maps_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
