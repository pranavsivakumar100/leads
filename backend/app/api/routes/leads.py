from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.leads import FollowUpUpdate, LibraryLead, OutreachStatusUpdate
from app.services import library as library_service

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=list[LibraryLead])
async def list_leads(user: CurrentUserDep, client: SupabaseDep) -> list[LibraryLead]:
    """The user's master lead library, deduped across all searches."""
    rows = await run_in_threadpool(library_service.list_leads, client, user.id)
    return [LibraryLead(**row) for row in rows]


@router.patch("/{place_id}/status", status_code=status.HTTP_204_NO_CONTENT)
async def update_status(
    place_id: str,
    payload: OutreachStatusUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> None:
    """Set the outreach status for one lead (all copies the user owns)."""
    ok = await run_in_threadpool(
        library_service.set_status, client, user.id, place_id, payload.status
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found."
        )


@router.patch("/{place_id}/follow-up", status_code=status.HTTP_204_NO_CONTENT)
async def update_follow_up(
    place_id: str,
    payload: FollowUpUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> None:
    """Toggle follow-up on one lead (all copies the user owns)."""
    ok = await run_in_threadpool(
        library_service.set_follow_up,
        client,
        user.id,
        place_id,
        payload.follow_up,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found."
        )
