from fastapi import APIRouter

from app.api.deps import AuthUser, CurrentUserDep

router = APIRouter(tags=["account"])


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUserDep) -> AuthUser:
    """Return the authenticated user — verifies the Supabase token end-to-end."""
    return user
