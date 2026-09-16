from pydantic import BaseModel


class KnowledgeDoc(BaseModel):
    id: str
    name: str
    filename: str
    mime_type: str = ""
    size_bytes: int = 0
    storage_path: str = ""
    coach_enabled: bool = False
    created_at: str


class KnowledgeToggle(BaseModel):
    coach_enabled: bool
