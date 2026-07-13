from fastapi import APIRouter, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.coach import Script, ScriptCreate, ScriptUpdate
from app.services import scripts as scripts_service

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.get("", response_model=list[Script])
async def list_scripts(user: CurrentUserDep, client: SupabaseDep) -> list[Script]:
    rows = await run_in_threadpool(scripts_service.list_scripts, client, user.id)
    return [Script(**row) for row in rows]


@router.post("", response_model=Script, status_code=status.HTTP_201_CREATED)
async def create_script(
    payload: ScriptCreate, user: CurrentUserDep, client: SupabaseDep
) -> Script:
    row = await run_in_threadpool(
        scripts_service.create_script,
        client,
        user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        steps=[s.model_dump() for s in payload.steps],
    )
    return Script(**row)


@router.patch("/{script_id}", response_model=Script)
async def update_script(
    script_id: str,
    payload: ScriptUpdate,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> Script:
    fields = payload.model_dump(exclude_unset=True)
    if "steps" in fields and fields["steps"] is not None:
        fields["steps"] = [s for s in fields["steps"]]
    row = await run_in_threadpool(
        scripts_service.update_script, client, user.id, script_id, fields
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Script not found."
        )
    return Script(**row)


@router.delete("/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(
    script_id: str, user: CurrentUserDep, client: SupabaseDep
) -> None:
    ok = await run_in_threadpool(
        scripts_service.delete_script, client, user.id, script_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Script not found."
        )
