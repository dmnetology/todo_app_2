# app/schemas/sync.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import false


class SyncCategoryExport(BaseModel):
    id: int
    name: str


class SyncTaskExport(BaseModel):
    id: int
    title: str
    description: str | None = None
    category_id: int | None = None
    priority: str
    status: str
    due_date: datetime | None = None
    created_at: datetime | None = None
    planned_start_local: datetime | None = None
    planned_start_timezone: str | None = None
    planned_start_at_utc: datetime | None = None
    actual_started_at: datetime | None = None
    current_started_at: datetime | None = None
    completed_at: datetime | None = None
    estimated_minutes: int | None = None
    actual_minutes: int | None = None
    is_completed: bool

class SyncTaskImport(BaseModel):
    title: str
    category_id: int
    priority: str
    status: str
    planned_start_local: datetime
    planned_start_timezone: str

    description: str | None = None
    due_date: datetime | None = None
    actual_started_at: datetime | None = None
    completed_at: datetime | None = None
    is_completed: bool | None = None

    @model_validator(mode="after")
    def validate_import_rules(self):
        if self.status == "new":
            if self.actual_started_at is not None:
                raise ValueError("actual_started_at is not allowed for status 'new'")
            if self.completed_at is not None:
                raise ValueError("completed_at is not allowed for status 'new'")
        elif self.status == "in_progress":
            if self.actual_started_at is None:
                raise ValueError("actual_started_at is required for status 'in_progress'")
            if self.completed_at is not None:
                raise ValueError("completed_at is not allowed for status 'in_progress'")
        elif self.status == "completed":
            if self.actual_started_at is None:
                raise ValueError("actual_started_at is required for status 'completed'")
            if self.completed_at is None:
                raise ValueError("completed_at is required for status 'completed'")
        else:
            raise ValueError(f"Unknown status: {self.status}")

        if self.status != "completed" and self.is_completed not in (None, False):
            raise ValueError("is_completed must be false for statuses other than 'completed'")

        return self


class SyncJsonExport(BaseModel):
    categories: list[SyncCategoryExport] = Field(default_factory=list)
    tasks: list[SyncTaskExport] = Field(default_factory=list)


class SyncJsonImport(BaseModel):
    tasks: list[SyncTaskImport] = Field(default_factory=list)


class SyncImportResult(BaseModel):
    tasks_created: int = 0
    tasks_skipped: int = 0
    created_task_ids: list[int] = Field(default_factory=list)
    problems: list[str] = Field(default_factory=list)