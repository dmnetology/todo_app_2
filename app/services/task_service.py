# app/services/task_service.py

from datetime import datetime, timezone, date, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.task import Task, TaskStatus
from app.models.task_pause import TaskPause
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskStatusFilter,
    TaskStatusUpdate,
    TaskDatePreset,
    TaskSortBy,
    SortOrder,
)
from app.ml.predictor import predict_task_duration


def validate_category_owner(
    db: Session,
    category_id: int | None,
    user_id: int,
) -> None:
    if category_id is None:
        return

    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == user_id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )


def _local_to_utc(dt: datetime | None, timezone_name: str | None) -> datetime | None:
    if dt is None:
        return None
    if not timezone_name:
        return None

    tz = ZoneInfo(timezone_name)

    if dt.tzinfo is None:
        local_dt = dt.replace(tzinfo=tz)
    else:
        local_dt = dt.astimezone(tz)

    return local_dt.astimezone(timezone.utc)


def _get_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _recalculate_actual_minutes(task: Task) -> None:
    if task.actual_started_at is None:
        raise ValueError("actual_started_at is required for completed task")

    end_time = task.completed_at or task.current_started_at
    if end_time is None:
        raise ValueError("end_time is required for completed task")

    started_at = _ensure_utc(task.actual_started_at)
    end_time = _ensure_utc(end_time)

    if started_at is None or end_time is None:
        raise ValueError("Invalid datetime values for actual minutes calculation")

    total_seconds = int((end_time - started_at).total_seconds())

    pauses = task.pauses or []
    paused_seconds = 0

    for pause in pauses:
        pause_started_at = _ensure_utc(pause.paused_at)
        pause_end = _ensure_utc(pause.resumed_at or end_time)

        if pause_started_at and pause_end and pause_end > pause_started_at:
            paused_seconds += int((pause_end - pause_started_at).total_seconds())

    effective_seconds = max(total_seconds - paused_seconds, 0)
    task.actual_minutes = max(effective_seconds // 60, 1) if effective_seconds > 0 else 0


def _start_of_day_utc(now: datetime) -> datetime:
    return now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_next_day_utc(now: datetime) -> datetime:
    return _start_of_day_utc(now) + timedelta(days=1)


def _start_of_tomorrow_utc(now: datetime) -> datetime:
    return _start_of_day_utc(now) + timedelta(days=1)


def _start_of_day_after_tomorrow_utc(now: datetime) -> datetime:
    return _start_of_day_utc(now) + timedelta(days=2)


def _next_monday_utc(now: datetime) -> datetime:
    start_today = _start_of_day_utc(now)
    days_until_monday = (7 - start_today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    return start_today + timedelta(days=days_until_monday)


def _start_of_next_week_utc(now: datetime) -> datetime:
    return _next_monday_utc(now)


def _start_of_week_after_next_utc(now: datetime) -> datetime:
    return _next_monday_utc(now) + timedelta(days=7)


def _apply_date_filter(
    query,
    date_preset: TaskDatePreset | None,
    planned_start_from: datetime | None,
    planned_start_to: datetime | None,
):
    now = _get_now()

    if date_preset and date_preset != TaskDatePreset.all:
        if date_preset == TaskDatePreset.all_from_today:
            query = query.filter(Task.planned_start_at_utc >= _start_of_day_utc(now))

        elif date_preset == TaskDatePreset.today:
            query = query.filter(
                Task.planned_start_at_utc >= _start_of_day_utc(now),
                Task.planned_start_at_utc < _start_of_next_day_utc(now),
            )

        elif date_preset == TaskDatePreset.tomorrow:
            query = query.filter(
                Task.planned_start_at_utc >= _start_of_tomorrow_utc(now),
                Task.planned_start_at_utc < _start_of_day_after_tomorrow_utc(now),
            )

        elif date_preset == TaskDatePreset.week:
            query = query.filter(
                Task.planned_start_at_utc >= _start_of_day_utc(now),
                Task.planned_start_at_utc < _start_of_week_after_next_utc(now),
            )

    if planned_start_from is not None:
        query = query.filter(Task.planned_start_at_utc >= planned_start_from)

    if planned_start_to is not None:
        query = query.filter(Task.planned_start_at_utc < planned_start_to)

    return query


def _apply_sorting(query, sort_by: TaskSortBy | None, sort_order: SortOrder | None):
    direction_desc = sort_order != SortOrder.asc

    sort_map = {
        TaskSortBy.title: Task.title,
        TaskSortBy.status: Task.status,
        TaskSortBy.priority: Task.priority,
        TaskSortBy.planned_start_at_utc: Task.planned_start_at_utc,
        TaskSortBy.actual_started_at: Task.actual_started_at,
        TaskSortBy.completed_at: Task.completed_at,
        TaskSortBy.estimated_minutes: Task.estimated_minutes,
        TaskSortBy.actual_minutes: Task.actual_minutes,
    }

    order_col = sort_map.get(sort_by, Task.created_at)
    order_expr = order_col.desc() if direction_desc else order_col.asc()

    return query.order_by(order_expr, Task.created_at.desc())


def create_task(db: Session, data: TaskCreate, user: User) -> Task:
    validate_category_owner(db, data.category_id, user.id)

    prediction = predict_task_duration(
        db=db,
        user_id=user.id,
        title=data.title,
        category_id=data.category_id,
        priority=data.priority.value if hasattr(data.priority, "value") else str(data.priority),
        planned_weekday=data.planned_start_local.weekday() if data.planned_start_local else None,
        planned_hour=data.planned_start_local.hour if data.planned_start_local else None,
    )

    estimated_minutes = prediction.duration_minutes

    due_date_utc = _local_to_utc(data.due_date, data.planned_start_timezone)
    planned_start_at_utc = _local_to_utc(data.planned_start_local, data.planned_start_timezone)

    task = Task(
        title=data.title,
        description=data.description,
        category_id=data.category_id,
        priority=data.priority,
        due_date=due_date_utc,
        planned_start_local=data.planned_start_local,
        planned_start_timezone=data.planned_start_timezone,
        planned_start_at_utc=planned_start_at_utc,
        estimated_minutes=estimated_minutes,
        owner_id=user.id,
        status=TaskStatus.new,
        is_completed=False,
        actual_started_at=None,
        current_started_at=None,
        completed_at=None,
        actual_minutes=None,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


def get_tasks(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 20,
    status_filter: TaskStatusFilter | None = None,
    category_id: int | None = None,
    title: str | None = None,
    date_preset: TaskDatePreset | None = None,
    planned_start_from: datetime | None = None,
    planned_start_to: datetime | None = None,
    sort_by: TaskSortBy | None = None,
    sort_order: SortOrder | None = None,
) -> dict:
    query = db.query(Task).filter(Task.owner_id == user.id)

    if status_filter is not None and status_filter != TaskStatusFilter.all:
        if status_filter == TaskStatusFilter.unfinished:
            query = query.filter(
                Task.status.in_(
                    [
                        TaskStatus.new,
                        TaskStatus.in_progress,
                        TaskStatus.paused,
                    ]
                )
            )
        else:
            query = query.filter(Task.status == TaskStatus(status_filter.value))

    if category_id is not None:
        query = query.filter(Task.category_id == category_id)

    if title:
        query = query.filter(Task.title.ilike(f"%{title.strip()}%"))

    query = _apply_date_filter(query, date_preset, planned_start_from, planned_start_to)
    query = _apply_sorting(query, sort_by, sort_order)

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


def get_task_by_id(db: Session, task_id: int, user: User) -> Task:
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.owner_id == user.id,
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return task


def update_task(
    db: Session,
    task_id: int,
    data: TaskUpdate,
    user: User,
) -> Task:
    task = get_task_by_id(db, task_id, user)

    update_data = data.model_dump(exclude_unset=True)

    timezone_name = update_data.get("planned_start_timezone", task.planned_start_timezone)

    if "due_date" in update_data:
        update_data["due_date"] = _local_to_utc(update_data["due_date"], timezone_name)

    if "planned_start_local" in update_data:
        update_data["planned_start_at_utc"] = _local_to_utc(update_data["planned_start_local"], timezone_name)

    if "category_id" in update_data:
        validate_category_owner(db, update_data["category_id"], user.id)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


def delete_task(db: Session, task_id: int, user: User) -> None:
    task = get_task_by_id(db, task_id, user)
    db.delete(task)
    db.commit()


def start_task(db: Session, task_id: int, user: User) -> Task:
    task = get_task_by_id(db, task_id, user)

    if task.status == TaskStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed task cannot be started",
        )

    now = _get_now()

    task.status = TaskStatus.in_progress
    task.is_completed = False

    if task.actual_started_at is None:
        task.actual_started_at = now

    task.current_started_at = now

    db.commit()
    db.refresh(task)

    return task


def pause_task(
    db: Session,
    task_id: int,
    user: User,
    pause_reason: str | None = None,
) -> Task:
    task = get_task_by_id(db, task_id, user)

    if task.status != TaskStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only in progress task can be paused",
        )

    now = _get_now()

    pause = TaskPause(
        task_id=task.id,
        paused_at=now,
        resumed_at=None,
        pause_reason=pause_reason,
    )

    task.status = TaskStatus.paused
    task.current_started_at = None

    db.add(pause)
    db.commit()
    db.refresh(task)

    return task


def resume_task(db: Session, task_id: int, user: User) -> Task:
    task = get_task_by_id(db, task_id, user)

    if task.status != TaskStatus.paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paused task can be resumed",
        )

    now = _get_now()

    last_pause = db.query(TaskPause).filter(
        TaskPause.task_id == task.id,
        TaskPause.resumed_at.is_(None),
    ).order_by(TaskPause.paused_at.desc()).first()

    if last_pause:
        last_pause.resumed_at = now

    task.status = TaskStatus.in_progress
    task.current_started_at = now

    db.commit()
    db.refresh(task)

    return task


def complete_task(
    db: Session,
    task_id: int,
    user: User,
) -> Task:
    task = get_task_by_id(db, task_id, user)

    if task.status in (TaskStatus.completed, TaskStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task cannot be completed in current status",
        )

    if task.actual_started_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task must be started before it can be completed",
        )

    now = _get_now()

    task.status = TaskStatus.completed
    task.is_completed = True
    task.completed_at = now
    task.current_started_at = None

    _recalculate_actual_minutes(task)

    db.commit()
    db.refresh(task)

    return task


def cancel_task(db: Session, task_id: int, user: User) -> Task:
    task = get_task_by_id(db, task_id, user)

    if task.status == TaskStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed task cannot be cancelled",
        )

    task.status = TaskStatus.cancelled
    task.is_completed = False
    task.current_started_at = None

    db.commit()
    db.refresh(task)

    return task


def update_task_status(
    db: Session,
    task_id: int,
    data: TaskStatusUpdate,
    user: User,
) -> Task:
    if data.status == TaskStatus.new:
        task = get_task_by_id(db, task_id, user)
        task.status = TaskStatus.new
        task.is_completed = False
        task.current_started_at = None
        db.commit()
        db.refresh(task)
        return task

    if data.status == TaskStatus.in_progress:
        return start_task(db, task_id, user)

    if data.status == TaskStatus.paused:
        return pause_task(db, task_id, user)

    if data.status == TaskStatus.completed:
        return complete_task(db, task_id, user)

    if data.status == TaskStatus.cancelled:
        return cancel_task(db, task_id, user)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported task status",
    )
