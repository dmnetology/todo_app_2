# app/schemas/task.py

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.task import TaskPriority


class TaskStatus(str, Enum):
    new = "new"
    in_progress = "in_progress"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class TaskDatePreset(str, Enum):
    all = "all"
    all_from_today = "all_from_today"
    today = "today"
    tomorrow = "tomorrow"
    week = "week"


class TaskSortBy(str, Enum):
    title = "title"
    status = "status"
    priority = "priority"
    planned_start_at_utc = "planned_start_at_utc"
    actual_started_at = "actual_started_at"
    completed_at = "completed_at"
    estimated_minutes = "estimated_minutes"
    actual_minutes = "actual_minutes"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    category_id: int
    priority: TaskPriority = TaskPriority.medium
    due_date: datetime | None = None
    planned_start_local: datetime
    planned_start_timezone: str
    planned_start_at_utc: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    category_id: int | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    planned_start_local: datetime | None = None
    planned_start_timezone: str | None = None
    planned_start_at_utc: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskCompleteUpdate(BaseModel):
    actual_minutes: int | None = Field(default=None, ge=1)


class TaskPauseRead(BaseModel):
    id: int
    task_id: int
    paused_at: datetime
    resumed_at: datetime | None
    pause_reason: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class TaskRead(BaseModel):
    id: int
    title: str
    description: str | None
    status: TaskStatus
    is_completed: bool
    priority: TaskPriority
    due_date: datetime | None
    created_at: datetime

    planned_start_local: datetime | None
    planned_start_timezone: str | None
    planned_start_at_utc: datetime | None

    actual_started_at: datetime | None
    current_started_at: datetime | None
    completed_at: datetime | None
    estimated_minutes: int | None
    actual_minutes: int | None
    category_id: int | None

    model_config = {
        "from_attributes": True,
    }


class TaskEstimateMetadataResponse(BaseModel):
    trained_at: datetime | None = None
    mae: float | None = None
    trained_on_count: int | None = None


class TaskEstimateResponse(BaseModel):
    predicted_minutes: int = Field(..., ge=1)
    source: str = Field(..., examples=["ml", "heuristic", "fallback"])
    model_type: str | None = None
    model_id: int | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    metadata: TaskEstimateMetadataResponse | None = None


class TaskListResponse(BaseModel):
    items: list[TaskRead]
    total: int
    skip: int
    limit: int