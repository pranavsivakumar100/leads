"""Per-user knowledge docs the AI coach can read."""
from __future__ import annotations

import io
import logging
import re
import uuid
from pathlib import Path

from supabase import Client

logger = logging.getLogger(__name__)

BUCKET = "knowledge"
MAX_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 24_000
ALLOWED_EXT = {".pdf", ".docx", ".txt", ".md", ".text"}

_COLS = (
    "id, name, filename, mime_type, size_bytes, storage_path, "
    "coach_enabled, created_at"
)


class KnowledgeError(Exception):
    pass


def _safe_filename(name: str) -> str:
    base = Path(name or "document").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return (cleaned or "document")[:120]


def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext in {".txt", ".md", ".text"}:
        text = data.decode("utf-8", errors="replace")
    elif ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    elif ext == ".docx":
        from docx import Document

        doc = Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        raise KnowledgeError("Use a PDF, Word (.docx), or text file.")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        raise KnowledgeError("Couldn't read any text from that file.")
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]
    return text


def ensure_bucket(client: Client) -> None:
    try:
        client.storage.create_bucket(BUCKET, options={"public": False})
    except Exception:
        logger.debug("knowledge bucket already exists", exc_info=True)


def list_docs(client: Client, user_id: str) -> list[dict]:
    return (
        client.table("knowledge_docs")
        .select(_COLS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []


def enabled_texts(client: Client, user_id: str) -> list[dict]:
    rows = (
        client.table("knowledge_docs")
        .select("name, extracted_text")
        .eq("user_id", user_id)
        .eq("coach_enabled", True)
        .order("created_at")
        .execute()
    ).data or []
    return [
        {"name": r.get("name") or "Untitled", "text": (r.get("extracted_text") or "").strip()}
        for r in rows
        if (r.get("extracted_text") or "").strip()
    ]


def create_doc(
    client: Client,
    user_id: str,
    *,
    filename: str,
    mime_type: str,
    data: bytes,
) -> dict:
    if len(data) > MAX_BYTES:
        raise KnowledgeError("File is too large (max 8 MB).")
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise KnowledgeError("Use a PDF, Word (.docx), or text file.")
    text = extract_text(filename, data)
    ensure_bucket(client)
    doc_id = str(uuid.uuid4())
    safe = _safe_filename(filename)
    path = f"{user_id}/{doc_id}/{safe}"
    client.storage.from_(BUCKET).upload(
        path,
        data,
        file_options={"content-type": mime_type or "application/octet-stream"},
    )
    row = (
        client.table("knowledge_docs")
        .insert(
            {
                "id": doc_id,
                "user_id": user_id,
                "name": Path(filename).stem or safe,
                "filename": safe,
                "mime_type": mime_type or "",
                "size_bytes": len(data),
                "storage_path": path,
                "extracted_text": text,
                "coach_enabled": False,
            }
        )
        .execute()
    ).data[0]
    row.pop("extracted_text", None)
    return row


def set_coach_enabled(
    client: Client, user_id: str, doc_id: str, enabled: bool
) -> dict | None:
    res = (
        client.table("knowledge_docs")
        .update({"coach_enabled": enabled})
        .eq("id", doc_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    row = rows[0]
    row.pop("extracted_text", None)
    return row


def delete_doc(client: Client, user_id: str, doc_id: str) -> bool:
    res = (
        client.table("knowledge_docs")
        .select("id, storage_path")
        .eq("id", doc_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return False
    path = rows[0].get("storage_path") or ""
    if path:
        try:
            client.storage.from_(BUCKET).remove([path])
        except Exception:
            logger.info("knowledge file delete failed", exc_info=True)
    client.table("knowledge_docs").delete().eq("id", doc_id).eq("user_id", user_id).execute()
    return True
