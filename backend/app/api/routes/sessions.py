from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SettingsDep, SupabaseDep
from app.schemas.coach import (
    CallSession,
    CallSessionCreate,
    CallSessionDetail,
    CallSessionUpdate,
    CoachRequest,
    CoachSuggestion,
    SessionEvent,
    SessionEventCreate,
    TranscribeResult,
)
from app.services import coach as coach_service
from app.services import knowledge as knowledge_service
from app.services import sessions as sessions_service
from app.services import settings as settings_service
from app.services import transcribe as transcribe_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[CallSession])
async def list_sessions(user: CurrentUserDep, client: SupabaseDep) -> list[CallSession]:
    rows = await run_in_threadpool(sessions_service.list_sessions, client, user.id)
    return [CallSession(**row) for row in rows]


@router.post("", response_model=CallSessionDetail, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CallSessionCreate, user: CurrentUserDep, client: SupabaseDep
) -> CallSessionDetail:
    row = await run_in_threadpool(
        sessions_service.create_session,
        client,
        user.id,
        lead_place_id=payload.lead_place_id,
        lead_name=payload.lead_name,
        campaign_id=payload.campaign_id,
        script_id=None,
        offer="",
    )
    return CallSessionDetail(**row)


@router.get("/{session_id}", response_model=CallSessionDetail)
async def get_session(
    session_id: str, user: CurrentUserDep, client: SupabaseDep
) -> CallSessionDetail:
    row = await run_in_threadpool(
        sessions_service.get_session, client, user.id, session_id
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )
    return CallSessionDetail(**row)


@router.patch("/{session_id}", response_model=CallSessionDetail)
async def update_session(
    session_id: str,
    payload: CallSessionUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> CallSessionDetail:
    fields = payload.model_dump(exclude_unset=True)
    row = await run_in_threadpool(
        sessions_service.update_session, client, user.id, session_id, fields
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )
    return CallSessionDetail(**row)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str, user: CurrentUserDep, client: SupabaseDep
) -> None:
    ok = await run_in_threadpool(
        sessions_service.delete_session, client, user.id, session_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )


@router.post("/{session_id}/coach", response_model=CoachSuggestion)
async def coach_next_line(
    session_id: str,
    payload: CoachRequest,
    user: CurrentUserDep,
    client: SupabaseDep,
    settings: SettingsDep,
) -> CoachSuggestion:
    """Suggest the rep's next line from enabled Skills docs and the live transcript."""
    secrets = await run_in_threadpool(
        settings_service.resolve, client, user.id, settings
    )
    if not secrets.coach_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Add your OpenAI API key in Settings to use the coach.",
        )
    session = await run_in_threadpool(
        sessions_service.get_session, client, user.id, session_id
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )

    knowledge = await run_in_threadpool(
        knowledge_service.enabled_texts, client, user.id
    )

    try:
        text = await run_in_threadpool(
            coach_service.suggest_next_line,
            api_key=secrets.openai_api_key,
            base_url=secrets.coach_base_url,
            model=secrets.coach_model,
            lead_name=session.get("lead_name", ""),
            knowledge=knowledge,
            transcript=[t.model_dump() for t in payload.transcript],
        )
    except coach_service.CoachError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    # Persist the suggestion so the review transcript includes coach turns.
    await run_in_threadpool(
        sessions_service.add_event,
        client,
        user.id,
        session_id,
        role="coach",
        text=text,
        t_ms=0,
    )
    return CoachSuggestion(text=text)


@router.post("/{session_id}/transcribe", response_model=TranscribeResult)
async def transcribe_utterance(
    session_id: str,
    user: CurrentUserDep,
    client: SupabaseDep,
    settings: SettingsDep,
    file: UploadFile = File(...),
) -> TranscribeResult:
    """Whisper a short clip from one call channel (rep or prospect)."""
    secrets = await run_in_threadpool(
        settings_service.resolve, client, user.id, settings
    )
    if not secrets.coach_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Add your OpenAI API key in Settings to transcribe the call.",
        )
    session = await run_in_threadpool(
        sessions_service.get_session, client, user.id, session_id
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )
    data = await file.read()
    try:
        text = await run_in_threadpool(
            transcribe_service.transcribe_audio,
            api_key=secrets.openai_api_key,
            base_url=secrets.coach_base_url,
            data=data,
            filename=file.filename or "clip.webm",
            mime_type=file.content_type or "application/octet-stream",
        )
    except transcribe_service.TranscribeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
    return TranscribeResult(text=text)


@router.post(
    "/{session_id}/events",
    response_model=SessionEvent,
    status_code=status.HTTP_201_CREATED,
)
async def add_event(
    session_id: str,
    payload: SessionEventCreate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> SessionEvent:
    row = await run_in_threadpool(
        sessions_service.add_event,
        client,
        user.id,
        session_id,
        role=payload.role,
        text=payload.text,
        t_ms=payload.t_ms,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )
    return SessionEvent(**row)
