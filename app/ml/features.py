# app/ml/features.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models.task import Task


@dataclass
class TaskFeatures:
    title: str
    category_id: int | None
    priority: str
    planned_weekday: int | None
    planned_hour: int | None


def normalize_title(title: str | None) -> str:
    return " ".join((title or "").strip().lower().split())


def get_planned_datetime(task: Task) -> datetime | None:
    """
    Берём planned_start_local как основную локальную дату/время планового старта.
    Если её нет — признаки по времени будут None.
    """
    return task.planned_start_local


def extract_task_features(task: Task) -> TaskFeatures:
    planned_dt = get_planned_datetime(task)

    return TaskFeatures(
        title=normalize_title(task.title),
        category_id=task.category_id,
        priority=task.priority.value if hasattr(task.priority, "value") else str(task.priority),
        planned_weekday=planned_dt.weekday() if planned_dt else None,
        planned_hour=planned_dt.hour if planned_dt else None,
    )


def task_to_feature_dict(task: Task) -> dict[str, Any]:
    """
    Преобразует задачу в словарь признаков для sklearn Pipeline.
    """
    features = extract_task_features(task)

    return {
        "title": features.title,
        "category_id": features.category_id,
        "priority": features.priority,
        "planned_weekday": features.planned_weekday,
        "planned_hour": features.planned_hour,
    }