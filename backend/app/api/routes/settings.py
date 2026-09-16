from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SettingsDep, SupabaseDep
from app.schemas.settings import (
    CoachModelOption,
    CoachModelsResponse,
    CoachStatus,
    IntegrationStatus,
    SettingsResponse,
    SettingsUpdate,
    SettingsUsage,
    VoiceStatus,
)
from app.services import history as history_service
from app.services import settings as settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


def _snapshot(
    *,
    email: str | None,
    name: str,
    secrets: settings_service.EffectiveSecrets,
    usage: SettingsUsage,
    row: dict,
    settings,
) -> SettingsResponse:
    webhook = ""
    if secrets.public_api_base_url:
        webhook = secrets.public_api_base_url.rstrip("/") + "/api/v1/voice/outbound"
    return SettingsResponse(
        email=email,
        name=name,
        env_fallback=settings.allow_env_key_fallback,
        usage=usage,
        search=IntegrationStatus(
            configured=secrets.scraping_enabled,
            hint=settings_service.mask_secret(secrets.google_maps_api_key),
            source=settings_service.integration_source(
                row, ("google_maps_api_key",), settings
            ),
        ),
        coach=CoachStatus(
            configured=secrets.coach_enabled,
            hint=settings_service.mask_secret(secrets.openai_api_key),
            source=settings_service.integration_source(
                row, ("openai_api_key",), settings
            ),
            model=secrets.coach_model,
            base_url=secrets.coach_base_url,
        ),
        voice=VoiceStatus(
            configured=secrets.voice_enabled,
            hint=settings_service.mask_secret(secrets.twilio_api_secret),
            source=settings_service.integration_source(
                row,
                (
                    "twilio_account_sid",
                    "twilio_auth_token",
                    "twilio_api_key",
                    "twilio_api_secret",
                    "twilio_twiml_app_sid",
                    "twilio_caller_id",
                ),
                settings,
            ),
            account_hint=settings_service.mask_secret(secrets.twilio_account_sid),
            caller_id=secrets.twilio_caller_id,
            twiml_hint=settings_service.mask_secret(secrets.twilio_twiml_app_sid),
            webhook_url=webhook,
        ),
    )


def _load_snapshot(client, user, settings: SettingsDep) -> SettingsResponse:
    row = settings_service.load_row(client, user.id)
    secrets = settings_service.resolve(client, user.id, settings)
    stats = history_service.dashboard_stats(client, user.id)
    sessions = settings_service.count_sessions(client, user.id)
    balance, currency = settings_service.twilio_balance(secrets)
    usage = SettingsUsage(
        total_leads=stats.get("total_leads", 0),
        searches_run=stats.get("searches_run", 0),
        markets=stats.get("markets", 0),
        sessions=sessions,
        twilio_balance=balance,
        twilio_currency=currency,
    )
    name = (user.email or "Account").split("@")[0]
    return _snapshot(
        email=user.email,
        name=name,
        secrets=secrets,
        usage=usage,
        row=row,
        settings=settings,
    )


@router.get("/models", response_model=CoachModelsResponse)
async def list_coach_models(
    user: CurrentUserDep, client: SupabaseDep, settings: SettingsDep
) -> CoachModelsResponse:
    secrets = settings_service.resolve(client, user.id, settings)
    models, source, error = await run_in_threadpool(
        settings_service.list_chat_models,
        secrets.openai_api_key,
        secrets.coach_base_url,
    )
    return CoachModelsResponse(
        models=[CoachModelOption(**row) for row in models],
        source=source,
        error=error,
    )


@router.get("", response_model=SettingsResponse)
async def get_settings_view(
    user: CurrentUserDep, client: SupabaseDep, settings: SettingsDep
) -> SettingsResponse:
    return await run_in_threadpool(_load_snapshot, client, user, settings)


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    payload: SettingsUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
    settings: SettingsDep,
) -> SettingsResponse:
    updates = payload.model_dump(exclude_none=True)
    if updates:
        await run_in_threadpool(
            settings_service.save_overrides, client, user.id, updates
        )
    return await run_in_threadpool(_load_snapshot, client, user, settings)
