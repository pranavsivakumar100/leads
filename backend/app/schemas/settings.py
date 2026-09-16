from pydantic import BaseModel


class IntegrationStatus(BaseModel):
    configured: bool
    hint: str = ""
    source: str = "none"  # account | env | none


class CoachStatus(IntegrationStatus):
    model: str = ""
    base_url: str = ""


class VoiceStatus(IntegrationStatus):
    account_hint: str = ""
    caller_id: str = ""
    twiml_hint: str = ""
    webhook_url: str = ""


class SettingsUsage(BaseModel):
    total_leads: int = 0
    searches_run: int = 0
    markets: int = 0
    sessions: int = 0
    twilio_balance: str | None = None
    twilio_currency: str | None = None


class SettingsResponse(BaseModel):
    email: str | None = None
    name: str = ""
    env_fallback: bool = False
    usage: SettingsUsage
    search: IntegrationStatus
    coach: CoachStatus
    voice: VoiceStatus


class CoachModelOption(BaseModel):
    id: str
    provider: str


class CoachModelsResponse(BaseModel):
    models: list[CoachModelOption]
    source: str = "fallback"  # api | fallback
    error: str = ""


class SettingsUpdate(BaseModel):
    google_maps_api_key: str | None = None
    openai_api_key: str | None = None
    coach_model: str | None = None
    coach_base_url: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_api_key: str | None = None
    twilio_api_secret: str | None = None
    twilio_twiml_app_sid: str | None = None
    twilio_caller_id: str | None = None
    public_api_base_url: str | None = None
