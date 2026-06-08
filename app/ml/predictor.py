# app/ml/predictor.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.ml.fallback import fallback_predict_task_duration
from app.ml.features import task_to_feature_dict
from app.ml.model_registry import (
    get_active_ml_model_record,
    load_model_artifacts,
)


@dataclass
class PredictionResult:
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
    Возвращает предсказанную длительность задачи.

    Логика:
    1) Пытаемся взять активную ML-модель пользователя
    2) Если она есть и успешно предсказывает — используем её
    3) Если модели нет или произошла ошибка — fallback
    """
    ml_record = get_active_ml_model_record(db, user_id)

    if not ml_record:
        duration = fallback_predict_task_duration(
            db=db,
            user_id=user_id,
            title=title,
            category_id=category_id,
        )
        return PredictionResult(
            duration_minutes=duration,
            source="fallback",
        )

    try:
        model, metadata = load_model_artifacts(user_id)

        features = {
            "title": " ".join((title or "").strip().lower().split()),
            "category_id": category_id,
            "priority": priority,
            "planned_weekday": planned_weekday,
            "planned_hour": planned_hour,
        }

        prediction = model.predict([features])[0]
        duration = int(round(float(prediction)))

        if duration < 1:
            duration = 1

        confidence = None
        if metadata and "mae" in metadata:
            mae = metadata["mae"]
            if isinstance(mae, (int, float)) and mae >= 0:
                confidence = max(0.0, 1.0 - (float(mae) / 180.0))

        return PredictionResult(
            duration_minutes=duration,
            source="ml",
            model_type=ml_record.model_type,
            model_id=ml_record.id,
            confidence=confidence,
            metadata=metadata,
        )

    except Exception:
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