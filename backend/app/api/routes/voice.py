"""Twilio Voice — browser dialer token + outbound TwiML webhook."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import CurrentUserDep, SettingsDep, SupabaseDep
from app.core.db import get_supabase
from app.services import settings as settings_service
from app.services.voice import VoiceError, mint_token, outbound_twiml

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceTokenResponse(BaseModel):
    token: str
    identity: str
    caller_id: str


class VoiceStatusResponse(BaseModel):
    ready: bool
    caller_id: str = ""


def _require_voice(secrets: settings_service.EffectiveSecrets) -> None:
    if not secrets.voice_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Add your Twilio keys in Settings to place calls.",
        )


@router.get("/status", response_model=VoiceStatusResponse)
async def voice_status(
    user: CurrentUserDep, client: SupabaseDep, settings: SettingsDep
) -> VoiceStatusResponse:
    secrets = await run_in_threadpool(
        settings_service.resolve, client, user.id, settings
    )
    return VoiceStatusResponse(
        ready=secrets.voice_enabled,
        caller_id=secrets.twilio_caller_id if secrets.voice_enabled else "",
    )


@router.get("/token", response_model=VoiceTokenResponse)
async def voice_token(
    user: CurrentUserDep, client: SupabaseDep, settings: SettingsDep
) -> VoiceTokenResponse:
    secrets = await run_in_threadpool(
        settings_service.resolve, client, user.id, settings
    )
    _require_voice(secrets)
    identity = f"user_{user.id.replace('-', '')}"
    token = mint_token(
        account_sid=secrets.twilio_account_sid,
        api_key=secrets.twilio_api_key,
        api_secret=secrets.twilio_api_secret,
        twiml_app_sid=secrets.twilio_twiml_app_sid,
        identity=identity,
    )
    return VoiceTokenResponse(
        token=token, identity=identity, caller_id=secrets.twilio_caller_id
    )


def _hangup_twiml(message: str) -> str:
    from twilio.twiml.voice_response import VoiceResponse

    response = VoiceResponse()
    response.say(message)
    response.hangup()
    return str(response)


@router.post("/outbound")
async def outbound_voice(request: Request, settings: SettingsDep) -> Response:
    """TwiML webhook Twilio hits when the browser places a call.

    No user JWT — Twilio POSTs here from the public internet. Destination
    is still validated (US E.164) before we dial.
    """
    form = await request.form()
    to = str(form.get("To") or form.get("to") or "")
    supabase = get_supabase()
    user_id = settings_service.user_id_from_client_from(
        str(form.get("From") or "")
    )
    if supabase is None or not user_id:
        xml = _hangup_twiml("The dialer is not configured.")
        return Response(content=xml, media_type="application/xml")
    secrets = await run_in_threadpool(
        settings_service.resolve, supabase, user_id, settings
    )
    if not secrets.voice_enabled:
        xml = _hangup_twiml("The dialer is not configured.")
        return Response(content=xml, media_type="application/xml")
    caller_id = secrets.twilio_caller_id
    try:
        xml = outbound_twiml(caller_id=caller_id, to=to)
    except VoiceError as exc:
        xml = _hangup_twiml(str(exc))
    return Response(content=xml, media_type="application/xml")
