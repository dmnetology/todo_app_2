# app/api/routes/tasks.py

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
    TaskListResponse,
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
    """
    Создаёт новую задачу для текущего пользователя.

    Шаги:
    1. Получаем данные задачи из тела запроса.
    2. Определяем текущего пользователя через access-token.
    3. Используем сервисный слой для создания задачи.
    4. Возвращаем созданную задачу в формате TaskRead.
    """
    return create_task(db, data, current_user)


@router.get("", response_model=TaskListResponse)
def read_tasks(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status: TaskStatus | None = None,
    category_id: int | None = None,
    sort_by: str | None = Query(default=None, pattern="^(priority|due_date)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает список задач текущего пользователя.

    Поддерживаются:
    - пагинация через skip и limit;
    - фильтрация по статусу;
    - фильтрация по категории;
    - сортировка по priority или due_date.

    Параметры Query используются для валидации входных значений:
    - skip не может быть отрицательным;
    - limit ограничен диапазоном от 1 до 100;
    - sort_by может быть только priority или due_date.
    """
    return get_tasks(
        db=db,
        user=current_user,
        skip=skip,
        limit=limit,
        status_filter=status,
        category_id=category_id,
        sort_by=sort_by,
    )


@router.get("/ai/estimate", response_model=TaskEstimateResponse)
def estimate_task_time(
    title: str = Query(..., min_length=1),
    category_id: int = Query(..., ge=1),
    priority: str = Query("medium"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает прогноз времени выполнения задачи и источник прогноза.

    Используется для фронта:
    - показывает, применяется ML или эвристика;
    - если ML активен, возвращает метаданные модели;
    - помогает пользователю понять, насколько прогноз основан на модели.
    """
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
    """
    Возвращает одну задачу по её идентификатору.

    Важно:
    - ищется только задача текущего пользователя;
    - если задача не найдена, сервисный слой вернёт 404.
    """
    return get_task_by_id(db, task_id, current_user)


@router.put("/{task_id}", response_model=TaskRead)
def edit_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Полностью или частично обновляет задачу.

    На уровне API:
    - принимаются новые данные задачи;
    - передаются в сервисный слой;
    - возвращается обновлённая запись.

    Проверка прав доступа выполняется внутри сервисов.
    """
    return update_task(db, task_id, data, current_user)


@router.patch("/{task_id}/status", response_model=TaskRead)
def change_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Изменяет статус задачи через универсальный endpoint.

    Этот endpoint сохранён как переходный и маршрутизирует
    действие на соответствующую бизнес-логику.
    """
    return update_task_status(db, task_id, data, current_user)


@router.patch("/{task_id}/start", response_model=TaskRead)
def start_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Запускает задачу в работу.

    Используется, когда пользователь начинает выполнение задачи.
    """
    return start_task(db, task_id, current_user)


@router.patch("/{task_id}/pause", response_model=TaskRead)
def pause_task_endpoint(
    task_id: int,
    pause_reason: str | None = Query(default=None, max_length=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ставит задачу на паузу.

    Причина паузы может передаваться как необязательный параметр Query.
    """
    return pause_task(db, task_id, current_user, pause_reason=pause_reason)


@router.patch("/{task_id}/resume", response_model=TaskRead)
def resume_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возобновляет задачу после паузы.

    Используется, когда пользователь снова возвращается к работе над задачей.
    """
    return resume_task(db, task_id, current_user)


@router.patch("/{task_id}/complete", response_model=TaskRead)
def complete_task_endpoint(
    task_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Завершает задачу.

    Если клиент передаёт actual_minutes, оно сохраняется явно.
    Если значение не передано, сервис пересчитывает его автоматически.

    После завершения задачи проверяем, не пора ли запускать обучение ML-модели.
    """
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
    """
    Отменяет задачу.

    Этот endpoint используется, когда задача больше не актуальна.
    """
    return cancel_task(db, task_id, current_user)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Удаляет задачу текущего пользователя.

    Возвращает статус 204 No Content, если удаление прошло успешно.
    """
    delete_task(db, task_id, current_user)


@router.get("/ml/model-info", response_model=MLModelInfoResponse)
def read_model_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает информацию об активной ML-модели текущего пользователя.

    Если активной модели нет, сообщает, что используется fallback по медиане.
    """
    return get_active_model_info(db=db, user_id=current_user.id)