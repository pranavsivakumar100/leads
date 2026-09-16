import re

from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUserDep, SettingsDep, SupabaseDep
from app.schemas.leads import (
    LeadExportRequest,
    LeadSearchRequest,
    LeadSearchResponse,
    LocationSuggestion,
    ServicePreset,
)
from app.services import history as history_service
from app.services import leads as leads_service
from app.services import settings as settings_service
from app.services.export import leads_to_xlsx
from app.services.places import PlacesClient, PlacesError

router = APIRouter(prefix="/search", tags=["search"])


def _maps_key(settings, client, user_id: str) -> str:
    secrets = settings_service.resolve(client, user_id, settings)
    if not secrets.scraping_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Add your Google Maps API key in Settings to run a search.",
        )
    return secrets.google_maps_api_key


@router.get("/locations/autocomplete", response_model=list[LocationSuggestion])
async def autocomplete_locations(
    input: str,
    settings: SettingsDep,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> list[LocationSuggestion]:
    """Suggest cities / areas as the user types a location."""
    query = input.strip()
    if len(query) < 2:
        return []
    api_key = _maps_key(settings, client, user.id)
    try:
        rows = await run_in_threadpool(
            PlacesClient(api_key).autocomplete, query
        )
    except PlacesError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
    return [LocationSuggestion(**row) for row in rows]


@router.get("/services", response_model=list[ServicePreset])
def list_services() -> list[ServicePreset]:
    """Preset service categories available for search."""
    return [
        ServicePreset(label=label, query=query)
        for label, query in leads_service.SERVICE_PRESETS.items()
    ]


@router.post("", response_model=LeadSearchResponse)
async def run_search(
    payload: LeadSearchRequest,
    settings: SettingsDep,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> LeadSearchResponse:
    api_key = _maps_key(settings, client, user.id)
    try:
        rows = await run_in_threadpool(
            leads_service.run_search,
            api_key,
            payload.service,
            payload.location,
            deep=payload.deep,
            max_results=payload.max_results,
            radius_km=payload.radius_km,
        )
    except PlacesError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    # Best-effort persistence — a DB failure never breaks the search response.
    search_id = await run_in_threadpool(
        history_service.save_search,
        client,
        user.id,
        service=payload.service,
        location=payload.location,
        deep=payload.deep,
        radius_km=payload.radius_km if payload.deep else None,
        leads=rows,
    )

    return LeadSearchResponse(
        service=payload.service,
        location=payload.location,
        total=len(rows),
        leads=rows,
        search_id=search_id,
    )


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or "leads"


@router.post("/export")
async def export_leads(
    payload: LeadExportRequest,
    _user: CurrentUserDep,
) -> StreamingResponse:
    """Return the leads as a formatted .xlsx workbook."""
    data = await run_in_threadpool(
        leads_to_xlsx, payload.service, payload.location, payload.leads
    )
    filename = f"{_slug(payload.location)}_{_slug(payload.service)}_leads.xlsx"
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
