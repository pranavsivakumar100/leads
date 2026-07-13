from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.schemas.health import HealthResponse
from app.services import health as health_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(settings: SettingsDep) -> HealthResponse:
    return health_service.get_health(settings)
