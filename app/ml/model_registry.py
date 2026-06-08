# app/ml/model_registry.py

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
from sqlalchemy.orm import Session

from app.models.ml_model import MLModel


MODELS_ROOT = Path("models/duration")


def get_user_model_dir(user_id: int) -> Path:
    return MODELS_ROOT / f"user_{user_id}"


def get_model_path(user_id: int) -> Path:
    return get_user_model_dir(user_id) / "model.joblib"


def get_metadata_path(user_id: int) -> Path:
    return get_user_model_dir(user_id) / "metadata.json"


def ensure_user_model_dir(user_id: int) -> Path:
    model_dir = get_user_model_dir(user_id)
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir


def save_model_artifacts(
    user_id: int,
    model: Any,
    metadata: dict[str, Any],
) -> tuple[str, str]:
    """
    Сохраняет модель и metadata.json на диск.

    Возвращает:
        tuple[str, str]: (model_path, metadata_path)
    """
    model_dir = ensure_user_model_dir(user_id)

    model_path = model_dir / "model.joblib"
    metadata_path = model_dir / "metadata.json"

    joblib.dump(model, model_path)

    with metadata_path.open("w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2, default=str)

    return str(model_path), str(metadata_path)


def load_model_artifacts(user_id: int) -> tuple[Any, dict[str, Any] | None]:
    """
    Загружает модель и metadata.json с диска.

    Возвращает:
        tuple[model, metadata]
    """
    model_path = get_model_path(user_id)
    metadata_path = get_metadata_path(user_id)

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    model = joblib.load(model_path)

    metadata = None
    if metadata_path.exists():
        with metadata_path.open("r", encoding="utf-8") as f:
            metadata = json.load(f)

    return model, metadata


def get_active_ml_model_record(db: Session, user_id: int) -> MLModel | None:
    """
    Возвращает активную запись ML-модели пользователя из БД.
    """
    return (
        db.query(MLModel)
        .filter(
            MLModel.user_id == user_id,
            MLModel.is_active.is_(True),
            MLModel.accepted.is_(True),
        )
        .order_by(MLModel.trained_at.desc(), MLModel.id.desc())
        .first()
    )


def deactivate_user_models(db: Session, user_id: int) -> None:
    """
    Деактивирует все модели пользователя.
    """
    db.query(MLModel).filter(MLModel.user_id == user_id).update(
        {MLModel.is_active: False},
        synchronize_session=False,
    )
    db.commit()


def get_latest_user_model_record(db: Session, user_id: int) -> MLModel | None:
    """
    Возвращает последнюю модель пользователя, даже если она не активна.
    """
    return (
        db.query(MLModel)
        .filter(MLModel.user_id == user_id)
        .order_by(MLModel.trained_at.desc(), MLModel.id.desc())
        .first()
    )