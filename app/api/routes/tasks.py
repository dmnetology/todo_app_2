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
    """
        Создаёт новую задачу для текущего авторизованного пользователя.

        Args:
            data: Данные для создания задачи.
            current_user: Пользователь, полученный из JWT-токена.
            db: Активная сессия базы данных.

        Returns:
            Созданная задача.
    """
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
    """
    Возвращает список задач текущего пользователя с фильтрацией, поиском,
    пагинацией и сортировкой.

    Поддерживаемые возможности:
    - пагинация через `skip` и `limit`;
    - фильтрация по статусу;
    - фильтрация по категории;
    - поиск по названию;
    - фильтрация по готовому временному пресету;
    - фильтрация по диапазону планового старта;
    - сортировка по выбранному полю и направлению.

    Args:
        skip: Количество задач, которые нужно пропустить.
        limit: Максимальное количество задач в ответе.
        status: Фильтр по статусу задачи.
        category_id: Идентификатор категории.
        title: Поисковая строка по названию задачи.
        date_preset: Готовый пресет периода дат.
        planned_start_from: Начало диапазона плановой даты старта.
        planned_start_to: Конец диапазона плановой даты старта.
        sort_by: Поле, по которому выполняется сортировка.
        sort_order: Направление сортировки.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Объект со списком задач и метаданными пагинации.
    """
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
    """
    Возвращает AI/ML-оценку предполагаемой длительности задачи.

    Прогноз строится на основе:
    - названия задачи;
    - категории;
    - приоритета;
    - истории задач текущего пользователя;
    - активной ML-модели, если она доступна.

    Если персональная модель пользователя ещё не обучена или данных
    недостаточно, сервис прогнозирования может вернуть fallback-оценку.

    Args:
        title: Название задачи.
        category_id: Идентификатор категории задачи.
        priority: Приоритет задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Прогноз длительности задачи и метаданные используемой модели.
    """
    result = predict_task_duration(
        db=db,
        user_id=current_user.id,
        title=title,
        category_id=category_id,
        priority=priority,
    )

    # Метаданные модели являются опциональными:
    # fallback-прогноз может не содержать информацию об обучении модели.
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

@router.get("/ml/model-info", response_model=MLModelInfoResponse)
def read_model_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает информацию об активной ML-модели текущего пользователя.

    Args:
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Информация об активной ML-модели пользователя.
    """
    return get_active_model_info(db=db, user_id=current_user.id)


@router.get("/{task_id}", response_model=TaskRead)
def read_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает одну задачу по её идентификатору.

    Доступ разрешён только владельцу задачи.

    Args:
        task_id: Идентификатор задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Найденная задача.
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
    Полностью или частично обновляет данные задачи.

    Args:
        task_id: Идентификатор задачи.
        data: Новые данные задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Обновлённая задача.
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
    Обновляет статус задачи напрямую.

    Используется для изменения статуса без вызова специализированных
    действий вроде старта, паузы, возобновления или завершения.

    Args:
        task_id: Идентификатор задачи.
        data: Данные для изменения статуса.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Задача с обновлённым статусом.
    """
    return update_task_status(db, task_id, data, current_user)


@router.patch("/{task_id}/start", response_model=TaskRead)
def start_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Переводит задачу в состояние выполнения - in_progress.

    Обычно используется, когда пользователь фактически начинает работу
    над задачей. В сервисном слое фиксируется время старта.

    Args:
        task_id: Идентификатор задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Задача после старта выполнения.
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
    Ставит выполняемую задачу на паузу.

    При необходимости можно передать причину паузы. Причина ограничена
    по длине, чтобы избежать чрезмерно больших значений в query-параметре.

    Args:
        task_id: Идентификатор задачи.
        pause_reason: Причина постановки задачи на паузу.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Задача после постановки на паузу.
    """
    return pause_task(db, task_id, current_user, pause_reason=pause_reason)


@router.patch("/{task_id}/resume", response_model=TaskRead)
def resume_task_endpoint(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возобновляет выполнение задачи после паузы.

    Args:
        task_id: Идентификатор задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Задача после возобновления выполнения.
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
    Завершает задачу и при необходимости запускает фоновое обучение ML-модели.

    После завершения задачи появляется новая фактическая информация
    о длительности выполнения. Эти данные могут быть полезны для
    последующего обучения персональной модели оценки времени задач.

    Обучение запускается через `BackgroundTasks`, чтобы не блокировать
    HTTP-ответ пользователю.

    Args:
        task_id: Идентификатор задачи.
        background_tasks: Менеджер фоновых задач FastAPI.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Завершённая задача.
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

    Отмена отличается от завершения: задача считается не выполненной,
    поэтому такие данные не должны использоваться как успешный
    пример для обучения модели оценки длительности.

    Args:
        task_id: Идентификатор задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        Отменённая задача.
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

    При успешном удалении возвращается ответ со статусом 204 No Content.

    Args:
        task_id: Идентификатор задачи.
        current_user: Текущий авторизованный пользователь.
        db: Активная сессия базы данных.

    Returns:
        None.
    """
    delete_task(db, task_id, current_user)