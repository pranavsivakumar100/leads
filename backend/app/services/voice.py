"""Twilio Voice — access tokens and outbound TwiML for the browser dialer."""
from __future__ import annotations

import re

from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import Dial, VoiceResponse

_NON_DIGIT = re.compile(r"\D+")


class VoiceError(Exception):
    pass


def to_e164(raw: str) -> str:
    """Normalize a US-centric phone string to E.164."""
    trimmed = (raw or "").strip()
    digits = _NON_DIGIT.sub("", trimmed)
    if not digits:
        raise VoiceError("Enter a phone number.")
    if trimmed.startswith("+"):
        if len(digits) < 8:
            raise VoiceError("That number looks too short.")
        return f"+{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    raise VoiceError("Use a 10-digit US number, or include the country code.")


def mint_token(
    *,
    account_sid: str,
    api_key: str,
    api_secret: str,
    twiml_app_sid: str,
    identity: str,
) -> str:
    token = AccessToken(
        account_sid,
        api_key,
        api_secret,
        identity=identity,
        ttl=3600,
    )
    token.add_grant(
        VoiceGrant(
            outgoing_application_sid=twiml_app_sid,
            incoming_allow=False,
        )
    )
    return token.to_jwt()


def outbound_twiml(*, caller_id: str, to: str) -> str:
    dest = to_e164(to)
    response = VoiceResponse()
    dial = Dial(caller_id=caller_id, timeout=30, answer_on_bridge=True)
    dial.number(dest)
    response.append(dial)
    return str(response)
