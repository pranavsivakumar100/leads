from fastapi import APIRouter

from app.api.routes import (
    campaigns,
    health,
    history,
    leads,
    me,
    offers,
    scripts,
    search,
    sessions,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(search.router)
api_router.include_router(history.router)
api_router.include_router(leads.router)
api_router.include_router(campaigns.router)
api_router.include_router(scripts.router)
api_router.include_router(sessions.router)
api_router.include_router(offers.router)
