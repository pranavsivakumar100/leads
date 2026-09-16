from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import CurrentUserDep, SupabaseDep
from app.schemas.knowledge import KnowledgeDoc, KnowledgeToggle
from app.services import knowledge as knowledge_service

router = APIRouter(prefix="/skills", tags=["skills"])


def _to_doc(row: dict) -> KnowledgeDoc:
    return KnowledgeDoc(
        id=row["id"],
        name=row.get("name") or "",
        filename=row.get("filename") or "",
        mime_type=row.get("mime_type") or "",
        size_bytes=int(row.get("size_bytes") or 0),
        storage_path=row.get("storage_path") or "",
        coach_enabled=bool(row.get("coach_enabled")),
        created_at=row.get("created_at") or "",
    )


@router.get("/docs", response_model=list[KnowledgeDoc])
async def list_docs(user: CurrentUserDep, client: SupabaseDep) -> list[KnowledgeDoc]:
    rows = await run_in_threadpool(knowledge_service.list_docs, client, user.id)
    return [_to_doc(row) for row in rows]


@router.post("/docs", response_model=KnowledgeDoc, status_code=status.HTTP_201_CREATED)
async def upload_doc(
    user: CurrentUserDep,
    client: SupabaseDep,
    file: UploadFile = File(...),
) -> KnowledgeDoc:
    data = await file.read()
    try:
        row = await run_in_threadpool(
            knowledge_service.create_doc,
            client,
            user.id,
            filename=file.filename or "document",
            mime_type=file.content_type or "",
            data=data,
        )
    except knowledge_service.KnowledgeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't store that document.",
        ) from exc
    return _to_doc(row)


@router.patch("/docs/{doc_id}", response_model=KnowledgeDoc)
async def toggle_doc(
    doc_id: str,
    payload: KnowledgeToggle,
    user: CurrentUserDep,
    client: SupabaseDep,
) -> KnowledgeDoc:
    row = await run_in_threadpool(
        knowledge_service.set_coach_enabled,
        client,
        user.id,
        doc_id,
        payload.coach_enabled,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found."
        )
    return _to_doc(row)


@router.delete("/docs/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doc(
    doc_id: str, user: CurrentUserDep, client: SupabaseDep
) -> None:
    ok = await run_in_threadpool(
        knowledge_service.delete_doc, client, user.id, doc_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found."
        )
