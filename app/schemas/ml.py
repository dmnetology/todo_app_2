from datetime import datetime

from pydantic import BaseModel


class MLModelInfoResponse(BaseModel):
    source: str
    model_type: str | None = None
    model_id: int | None = None
    trained_at: datetime | None = None
    mae: float | None = None
    fallback_mae: float | None = None
    trained_on_count: int | None = None
    accepted: bool | None = None
    is_active: bool | None = None
    message: str
    summary: str | None = None