# app/services/ml_training_service.py

from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.ml.training import train_duration_model_for_user
from app.models.ml_model import MLModel
from app.models.task import Task


# Первая модель: минимальное число подходящих завершённых задач
MIN_TRAINING_SAMPLES = 50

# Переобучение: сколько новых подходящих завершённых задач нужно накопить
RETRAIN_THRESHOLD = 100


def get_completed_tasks_count(db: Session, user_id: int) -> int:
    """
    Считает только те завершённые задачи, которые реально подходят для ML-обучения:
    - задача завершена;
    - actual_minutes заполнено;
    - actual_minutes > 0.
    """
    return (
        db.query(Task)
        .filter(
            Task.owner_id == user_id,
            Task.is_completed.is_(True),
            Task.actual_minutes.is_not(None),
            Task.actual_minutes > 0,
        )
        .count()
    )


def get_active_ml_model(db: Session, user_id: int) -> MLModel | None:
    """
    Возвращает активную ML-модель пользователя.
    Если моделей несколько, берём самую свежую по trained_at, затем по id.
    """
    return (
        db.query(MLModel)
        .filter(
            MLModel.user_id == user_id,
            MLModel.is_active.is_(True),
        )
        .order_by(MLModel.trained_at.desc(), MLModel.id.desc())
        .first()
    )


def should_train_or_retrain_model(db: Session, user_id: int) -> bool:
    """
    Решает, нужно ли запускать обучение.

    Логика:
    - если активной модели нет, обучаем при достижении MIN_TRAINING_SAMPLES;
    - если активная модель есть, переобучаем при накоплении RETRAIN_THRESHOLD
      новых подходящих завершённых задач после последнего обучения.
    """
    completed_count = get_completed_tasks_count(db, user_id)
    active_model = get_active_ml_model(db, user_id)

    # Активной модели нет — обучаем первую модель
    if active_model is None:
        return completed_count >= MIN_TRAINING_SAMPLES

    # Активная модель есть — считаем, сколько новых задач появилось после обучения
    trained_on_count = active_model.trained_on_count or 0
    new_completed_count = completed_count - trained_on_count

    return new_completed_count >= RETRAIN_THRESHOLD


def _run_training_job(user_id: int) -> None:
    """
    Фоновая задача для обучения модели.

    Создаёт собственную сессию БД, чтобы не зависеть от HTTP-запроса.
    """
    db = SessionLocal()
    try:
        train_duration_model_for_user(db, user_id)
    finally:
        db.close()


def schedule_model_training_if_needed(
    db: Session,
    user_id: int,
    background_tasks: BackgroundTasks,
) -> bool:
    """
    Проверяет, нужно ли обучение, и если да — планирует его в фоне.

    Возвращает:
    - True, если обучение запланировано;
    - False, если пока не нужно.
    """
    if not should_train_or_retrain_model(db, user_id):
        return False

    background_tasks.add_task(_run_training_job, user_id)
    return True