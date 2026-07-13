from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.coach import (
    CallSession,
    CallSessionCreate,
    CallSessionDetail,
    CallSessionUpdate,
    SessionEvent,
    SessionEventCreate,
)
from app.services import sessions as sessions_service

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
        script_id=payload.script_id,
        offer=payload.offer.strip(),
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
