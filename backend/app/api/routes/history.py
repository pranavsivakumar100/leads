from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.leads import DashboardStats, Lead, SearchHistoryItem
from app.services import history as history_service

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[SearchHistoryItem])
async def list_history(
    user: CurrentUserDep,
    client: SupabaseDep,
    limit: int = 20,
) -> list[SearchHistoryItem]:
    """The user's recent searches, newest first."""
    rows = await run_in_threadpool(
        history_service.list_searches, client, user.id, limit=min(limit, 100)
    )
    return [SearchHistoryItem(**row) for row in rows]


@router.get("/stats", response_model=DashboardStats)
async def get_stats(user: CurrentUserDep, client: SupabaseDep) -> DashboardStats:
    """Aggregate KPIs for the dashboard."""
    stats = await run_in_threadpool(
        history_service.dashboard_stats, client, user.id
    )
    return DashboardStats(**stats)


@router.get("/{search_id}/leads", response_model=list[Lead])
async def get_saved_leads(
    search_id: str,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> list[Lead]:
    """Leads from a previously saved search."""
    rows = await run_in_threadpool(
        history_service.get_search_leads, client, user.id, search_id
    )
    if rows is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Search not found."
        )
    return [Lead(**row) for row in rows]
