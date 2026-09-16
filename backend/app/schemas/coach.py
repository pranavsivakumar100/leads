"""Schemas for the sales coach: scripts and call sessions."""
from __future__ import annotations

from pydantic import BaseModel, Field

# Call outcomes. `in_progress` is the default while a session is live.
SESSION_OUTCOMES = (
    "in_progress",
    "connected",
    "interested",
    "not_interested",
    "callback",
    "voicemail",
    "no_answer",
    "meeting_booked",
)

EVENT_ROLES = ("prospect", "rep", "coach", "system")

# How an offer targets leads — drives offer-fit scoring on the Leads page.
OFFER_FIT_TYPES = (
    "any",
    "no_website",
    "few_reviews",
    "low_rating",
    "high_volume",
)


class Offer(BaseModel):
    id: str
    name: str
    description: str = ""
    pricing: str = ""
    fit_type: str = "any"
    created_at: str
    updated_at: str


class OfferCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field("", max_length=2000)
    pricing: str = Field("", max_length=200)
    fit_type: str = Field(
        "any", pattern="^(any|no_website|few_reviews|low_rating|high_volume)$"
    )


class OfferUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=2000)
    pricing: str | None = Field(None, max_length=200)
    fit_type: str | None = Field(
        None, pattern="^(any|no_website|few_reviews|low_rating|high_volume)$"
    )


class ScriptStep(BaseModel):
    title: str = Field("", max_length=120)
    body: str = Field("", max_length=4000)


class Script(BaseModel):
    id: str
    name: str
    description: str = ""
    steps: list[ScriptStep] = []
    created_at: str
    updated_at: str


class ScriptCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field("", max_length=500)
    steps: list[ScriptStep] = []


class ScriptUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=500)
    steps: list[ScriptStep] | None = None


class SessionEvent(BaseModel):
    id: str
    role: str
    text: str = ""
    t_ms: int = 0
    created_at: str


class SessionEventCreate(BaseModel):
    role: str = Field(..., pattern="^(prospect|rep|coach|system)$")
    text: str = Field("", max_length=8000)
    t_ms: int = Field(0, ge=0)


class CallSession(BaseModel):
    id: str
    lead_place_id: str = ""
    lead_name: str = ""
    campaign_id: str | None = None
    script_id: str | None = None
    offer: str = ""
    outcome: str = "in_progress"
    notes: str = ""
    started_at: str
    ended_at: str | None = None
    event_count: int = 0


class CallSessionDetail(CallSession):
    events: list[SessionEvent] = []


class CallSessionCreate(BaseModel):
    lead_place_id: str = Field("", max_length=200)
    lead_name: str = Field("", max_length=200)
    campaign_id: str | None = None
    script_id: str | None = None
    offer: str = Field("", max_length=2000)


class TranscriptTurn(BaseModel):
    role: str = Field(..., pattern="^(prospect|rep)$")
    text: str = Field(..., max_length=4000)


class CoachRequest(BaseModel):
    """Rolling transcript from the client; freshest state lives in the browser."""

    transcript: list[TranscriptTurn] = Field(default_factory=list, max_length=200)


class CoachSuggestion(BaseModel):
    text: str


class TranscribeResult(BaseModel):
    text: str = ""


class CallSessionUpdate(BaseModel):
    outcome: str | None = Field(
        None,
        pattern="^(in_progress|connected|interested|not_interested|callback|voicemail|no_answer|meeting_booked)$",
    )
    notes: str | None = Field(None, max_length=8000)
    offer: str | None = Field(None, max_length=2000)
    ended: bool | None = None
