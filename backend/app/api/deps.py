from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.db import get_supabase

SettingsDep = Annotated[Settings, Depends(get_settings)]

bearer_scheme = HTTPBearer(auto_error=False)


def require_supabase() -> Client:
    client = get_supabase()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persistence is not configured (missing Supabase settings).",
        )
    return client


SupabaseDep = Annotated[Client, Depends(require_supabase)]


class AuthUser(BaseModel):
    id: str
    email: str | None = None


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    client: SupabaseDep,
) -> AuthUser:
    """Validate the Supabase access token from the Authorization header."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        # Network call to Supabase Auth; run off the event loop.
        resp = await run_in_threadpool(client.auth.get_user, credentials.credentials)
    except Exception:
        resp = None
    if resp is None or resp.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AuthUser(id=resp.user.id, email=resp.user.email)


CurrentUserDep = Annotated[AuthUser, Depends(get_current_user)]
