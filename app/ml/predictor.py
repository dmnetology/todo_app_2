# app/ml/predictor.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.ml.fallback import fallback_predict_task_duration
from app.ml.model_registry import (
    get_active_ml_model_record,
    load_model_artifacts,
)

import traceback
import pandas as pd


@dataclass
class PredictionResult:
    """
    Класс для хранения результата предсказания длительности задачи.

    Содержит предсказанную длительность, источник предсказания (ML-модель или fallback),
    а также дополнительную информацию о модели и уверенности.
    """
    duration_minutes: int
    source: str  # "ml" or "fallback"
    model_type: str | None = None
    model_id: int | None = None
    confidence: float | None = None
    metadata: dict[str, Any] | None = None


def predict_task_duration(
    db: Session,
    user_id: int,
    title: str,
    category_id: int | None,
    priority: str,
    planned_weekday: int | None = None,
    planned_hour: int | None = None,
) -> PredictionResult:
    """
    Предсказывает длительность задачи, используя ML-модель или fallback-логику.

    Процесс предсказания:
    1.  Пытается найти активную ML-модель для данного пользователя.
    2.  Если активная модель найдена, загружает её артефакты и делает предсказание.
        -   В случае успеха возвращает результат ML-модели.
        -   В случае любой ошибки (проблемы с загрузкой, предсказанием)
            переключается на fallback-логику.
    3.  Если активной модели нет или произошла ошибка при её использовании,
        использует fallback-логику для получения предсказания.

    Args:
        db: Сессия базы данных.
        user_id: Идентификатор пользователя.
        title: Название задачи.
        category_id: Идентификатор категории задачи.
        priority: Приоритет задачи.
        planned_weekday: День недели планируемого выполнения (0=понедельник, 6=воскресенье).
        planned_hour: Час дня планируемого выполнения (0-23).

    Returns:
        Объект `PredictionResult`, содержащий предсказанную длительность
        и информацию об источнике предсказания.
    """

    # Пытаемся получить запись об активной ML-модели для пользователя.
    ml_record = get_active_ml_model_record(db, user_id)

    print(f"[PREDICT] user_id={user_id} ml_record={bool(ml_record)}")

    # Если активной ML-модели нет, используем fallback.
    if not ml_record:
        duration = fallback_predict_task_duration(
            db=db,
            user_id=user_id,
            title=title,
            category_id=category_id,
        )
        print(f"[PREDICT] source=fallback reason=no_active_model duration={duration}")
        return PredictionResult(
            duration_minutes=duration,
            source="fallback",
        )

    # Если активная ML-модель есть, пытаемся использовать её.
    try:
        # Загружаем модель и её метаданные с диска.
        model, metadata = load_model_artifacts(user_id)

        # Подготавливаем признаки для предсказания.
        # Нормализация title должна быть такой же, как при обучении модели.
        features = {
            "title": " ".join((title or "").strip().lower().split()),
            "category_id": category_id,
            "priority": priority,
            "planned_weekday": planned_weekday,
            "planned_hour": planned_hour,
        }

        # Преобразуем признаки в DataFrame, как это ожидается пайплайном Scikit-learn.
        features_df = pd.DataFrame([features])
        prediction = model.predict(features_df)[0]
        duration = int(round(float(prediction)))
        print(duration)

        # Длительность не может быть меньше 1 минуты.
        if duration < 1:
            duration = 1

        # Расчет "уверенности" предсказания на основе MAE модели.
        # MAE 180 (3 часа) считается низким уровнем уверенности,
        # чем ниже MAE, тем выше уверенность.
        confidence = None
        if metadata and "mae" in metadata:
            mae = metadata["mae"]
            if isinstance(mae, (int, float)) and mae >= 0:
                confidence = max(0.0, 1.0 - (float(mae) / 180.0))

        print(f"[PREDICT] source=ml model_id={ml_record.id} model_type={ml_record.model_type} duration={duration}")

        return PredictionResult(
            duration_minutes=duration,
            source="ml",
            model_type=ml_record.model_type,
            model_id=ml_record.id,
            confidence=confidence,
            metadata=metadata,
        )

    except Exception as exc:
        # В случае любой ошибки при работе с ML-моделью, логируем ошибку
        # и переключаемся на fallback-логику.
        print(f"[PREDICT] exception_type={type(exc).__name__}")
        print(f"[PREDICT] exception_repr={repr(exc)}")
        print("[PREDICT] traceback:")
        print(traceback.format_exc())
        duration = fallback_predict_task_duration(
            db=db,
            user_id=user_id,
            title=title,
            category_id=category_id,
        )
        return PredictionResult(
            duration_minutes=duration,
            source="fallback",
            model_type=ml_record.model_type,
            model_id=ml_record.id,
        )