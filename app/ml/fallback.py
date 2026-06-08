# app/ml/fallback.py

from statistics import median
from sqlalchemy.orm import Session
from rapidfuzz import fuzz

from app.models.task import Task


DEFAULT_DURATION_MINUTES = 60
TITLE_SIMILARITY_THRESHOLD = 85


def normalize_title(title: str) -> str:
    return " ".join((title or "").strip().lower().split())


def median_minutes(tasks: list[Task]) -> int:
    values = [task.actual_minutes for task in tasks if task.actual_minutes and task.actual_minutes > 0]

    if not values:
        return DEFAULT_DURATION_MINUTES

    return int(round(median(values)))


def fallback_predict_task_duration(
    db: Session,
    user_id: int,
    title: str,
    category_id: int | None,
) -> int:
    normalized_title = normalize_title(title)

    tasks = (
        db.query(Task)
        .filter(
            Task.owner_id == user_id,
            Task.is_completed.is_(True),
            Task.actual_minutes > 0,
        )
        .all()
    )

    if not tasks:
        return DEFAULT_DURATION_MINUTES

    exact_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and normalize_title(task.title) == normalized_title
    ]

    if exact_tasks:
        return median_minutes(exact_tasks)

    similar_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and fuzz.ratio(normalize_title(task.title), normalized_title) >= TITLE_SIMILARITY_THRESHOLD
    ]

    if similar_tasks:
        return median_minutes(similar_tasks)

    category_tasks = [
        task for task in tasks
        if task.category_id == category_id
    ]

    if category_tasks:
        return median_minutes(category_tasks)

    return median_minutes(tasks)