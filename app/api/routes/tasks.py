# app/api/routes/task.py

from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TaskStatusUpdate,
    TaskEstimateMetadataResponse,
    TaskEstimateResponse,
    TaskStatus,
    TaskStatusFilter,
    TaskListResponse,
    TaskDatePreset,
    TaskSortBy,
    SortOrder,
)
from app.ml.predictor import predict_task_duration

from app.services.task_service import (
    create_task,
    get_tasks,
    get_task_by_id,
    update_task,
    delete_task,
    update_task_status,
    start_task,
    pause_task,
    resume_task,
    complete_task,
    cancel_task,
)

from app.services.ml_training_service import schedule_model_training_if_needed
from fastapi import BackgroundTasks
from app.schemas.ml import MLModelInfoResponse
from app.services.ml_model_service import get_active_model_info

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_new_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_task(db, data, current_user)


@router.get("", response_model=TaskListResponse)
def read_tasks(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status: TaskStatusFilter | None = Query(default=None),
    category_id: int | None = None,
    title: str | None = Query(default=None, min_length=1, max_length=200),
    date_preset: TaskDatePreset | None = Query(default=None),
    planned_start_from: datetime | None = None,
    planned_start_to: datetime | None = None,
    sort_by: TaskSortBy | None = Query(default=None),
    sort_order: SortOrder | None = Query(default=SortOrder.desc),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_tasks(
        db=db,
        user=current_user,
        skip=skip,
        limit=limit,
        status_filter=status,
        category_id=category_id,
        title=title,
        date_preset=date_preset,
        planned_start_from=planned_start_from,
        planned_start_to=planned_start_to,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/ai/estimate", response_model=TaskEstimateResponse)
def estimate_task_time(
    title: str = Query(..., min_length=1),
    category_id: int = Query(..., ge=1),
    priority: str = Query("medium"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = predict_task_duration(
        db=db,
        user_id=current_user.id,
        title=title,
        category_id=category_id,
        priority=priority,
    )

    metadata = None
    if result.metadata is not None:
        metadata = TaskEstimateMetadataResponse(
            trained_at=result.metadata.get("trained_at"),
            mae=result.metadata.get("mae"),
            trained_on_count=result.metadata.get("trained_on_count"),
        )

    return TaskEstimateResponse(
        predicted_minutes=result.duration_minutes,
        source=result.source,
        model_type=result.model_type,
        model_id=result.model_id,
        confidence=result.confidence,
        metadata=metadata,
    )


@router.get("/{task_id}", response_model=TaskRead)
def read_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_task_by_id(db, task_id, current_user)


@router.put("/{task_id}", response_model=TaskRead)
def edit_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_task(db, task_id, data, current_user)


@router.patch("/{task_id}/status", response_model=TaskRead)
def change_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_task_status(db, task_id, data, current_user)


@router.patch("/{task_id}/start", response_model=TaskRead)
def start_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return start_task(db, task_id, current_user)


@router.patch("/{task_id}/pause", response_model=TaskRead)
def pause_task_endpoint(
    task_id: int,
    pause_reason: str | None = Query(default=None, max_length=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return pause_task(db, task_id, current_user, pause_reason=pause_reason)


@router.patch("/{task_id}/resume", response_model=TaskRead)
def resume_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return resume_task(db, task_id, current_user)


@router.patch("/{task_id}/complete", response_model=TaskRead)
def complete_task_endpoint(
    task_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = complete_task(db, task_id, current_user)

    training_scheduled = schedule_model_training_if_needed(
        db=db,
        user_id=current_user.id,
        background_tasks=background_tasks,
    )

    print(f"ML training scheduled: {training_scheduled} for user_id={current_user.id}")

    return task


@router.patch("/{task_id}/cancel", response_model=TaskRead)
def cancel_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cancel_task(db, task_id, current_user)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_task(db, task_id, current_user)


@router.get("/ml/model-info", response_model=MLModelInfoResponse)
def read_model_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_active_model_info(db=db, user_id=current_user.id)