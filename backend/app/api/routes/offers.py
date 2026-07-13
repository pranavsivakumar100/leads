from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.coach import Offer, OfferCreate, OfferUpdate
from app.services import offers as offers_service

router = APIRouter(prefix="/offers", tags=["offers"])


@router.get("", response_model=list[Offer])
async def list_offers(user: CurrentUserDep, client: SupabaseDep) -> list[Offer]:
    rows = await run_in_threadpool(offers_service.list_offers, client, user.id)
    return [Offer(**row) for row in rows]


@router.post("", response_model=Offer, status_code=status.HTTP_201_CREATED)
async def create_offer(
    payload: OfferCreate, user: CurrentUserDep, client: SupabaseDep
) -> Offer:
    row = await run_in_threadpool(
        offers_service.create_offer,
        client,
        user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        pricing=payload.pricing.strip(),
        fit_type=payload.fit_type,
    )
    return Offer(**row)


@router.patch("/{offer_id}", response_model=Offer)
async def update_offer(
    offer_id: str,
    payload: OfferUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> Offer:
    fields = payload.model_dump(exclude_unset=True)
    row = await run_in_threadpool(
        offers_service.update_offer, client, user.id, offer_id, fields
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found."
        )
    return Offer(**row)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_offer(
    offer_id: str, user: CurrentUserDep, client: SupabaseDep
) -> None:
    ok = await run_in_threadpool(
        offers_service.delete_offer, client, user.id, offer_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found."
        )
