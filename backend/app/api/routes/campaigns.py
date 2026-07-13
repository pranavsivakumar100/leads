from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.leads import (
    Campaign,
    CampaignAddLeads,
    CampaignCreate,
    LibraryLead,
)
from app.services import campaigns as campaigns_service

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[Campaign])
async def list_campaigns(user: CurrentUserDep, client: SupabaseDep) -> list[Campaign]:
    rows = await run_in_threadpool(
        campaigns_service.list_campaigns, client, user.id
    )
    return [Campaign(**row) for row in rows]


@router.post("", response_model=Campaign, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate, user: CurrentUserDep, client: SupabaseDep
) -> Campaign:
    row = await run_in_threadpool(
        campaigns_service.create_campaign,
        client,
        user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    return Campaign(**row)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str, user: CurrentUserDep, client: SupabaseDep
) -> None:
    ok = await run_in_threadpool(
        campaigns_service.delete_campaign, client, user.id, campaign_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found."
        )


@router.get("/{campaign_id}/leads", response_model=list[LibraryLead])
async def get_campaign_leads(
    campaign_id: str, user: CurrentUserDep, client: SupabaseDep
) -> list[LibraryLead]:
    rows = await run_in_threadpool(
        campaigns_service.campaign_leads, client, user.id, campaign_id
    )
    if rows is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found."
        )
    return [LibraryLead(**row) for row in rows]


@router.post("/{campaign_id}/leads", status_code=status.HTTP_204_NO_CONTENT)
async def add_campaign_leads(
    campaign_id: str,
    payload: CampaignAddLeads,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> None:
    added = await run_in_threadpool(
        campaigns_service.add_leads, client, user.id, campaign_id, payload.place_ids
    )
    if added is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found."
        )


@router.delete(
    "/{campaign_id}/leads/{place_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_campaign_lead(
    campaign_id: str,
    place_id: str,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> None:
    ok = await run_in_threadpool(
        campaigns_service.remove_lead, client, user.id, campaign_id, place_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not in campaign."
        )
