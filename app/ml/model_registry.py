# app/ml/model_registry.py

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
from sqlalchemy.orm import Session

from app.models.ml_model import MLModel

# Базовая директория для хранения артефактов ML-моделей по пользователям.
MODELS_ROOT = Path(__file__).resolve().parent / "models" / "duration"


def get_user_model_dir(user_id: int) -> Path:
    """
    Возвращает директорию, в которой хранятся артефакты модели конкретного пользователя.

    Args:
        user_id: Идентификатор пользователя.

    Returns:
        Путь к директории модели пользователя.
    """
    return MODELS_ROOT / f"user_{user_id}"


def get_model_path(user_id: int) -> Path:
    """
    Возвращает путь к файлу модели `model.joblib`.

    Args:
        user_id: Идентификатор пользователя.

    Returns:
        Путь к файлу модели.
    """
    return get_user_model_dir(user_id) / "model.joblib"


def get_metadata_path(user_id: int) -> Path:
    """
    Возвращает путь к файлу метаданных `metadata.json`.

    Args:
        user_id: Идентификатор пользователя.

    Returns:
        Путь к файлу метаданных.
    """
    return get_user_model_dir(user_id) / "metadata.json"


def ensure_user_model_dir(user_id: int) -> Path:
    """
    Создаёт директорию модели пользователя, если она ещё не существует.

    Args:
        user_id: Идентификатор пользователя.

    Returns:
        Путь к созданной или уже существующей директории.
    """
    model_dir = get_user_model_dir(user_id)
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir


def save_model_artifacts(
    user_id: int,
    model: Any,
    metadata: dict[str, Any],
) -> tuple[str, str]:
    """
    Сохраняет модель и метаданные на диск.

    В результате сохраняются два файла:
    - `model.joblib` — сериализованная ML-модель;
    - `metadata.json` — дополнительные данные об обучении модели.

    Args:
        user_id: Идентификатор пользователя.
        model: Объект модели, который можно сериализовать через joblib.
        metadata: Словарь с метаданными обучения.

    Returns:
        Кортеж строковых путей: `(model_path, metadata_path)`.
    """
    model_dir = ensure_user_model_dir(user_id)

    model_path = model_dir / "model.joblib"
    metadata_path = model_dir / "metadata.json"

    joblib.dump(model, model_path)

    # default=str нужен для безопасной сериализации datetime и других
    # не-JSON-совместимых объектов, которые могут попасть в metadata.
    with metadata_path.open("w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2, default=str)

    return str(model_path), str(metadata_path)


def load_model_artifacts(user_id: int) -> tuple[Any, dict[str, Any] | None]:
    """
    Загружает модель и метаданные с диска.

    Если файл `metadata.json` отсутствует, метаданные возвращаются как `None`.
    Если файл модели отсутствует - `FileNotFoundError`.

    Args:
        user_id: Идентификатор пользователя.

    Returns:
        Кортеж `(model, metadata)`.

    Raises:
        FileNotFoundError: Если файл модели не найден.
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
    Возвращает активную и принятую запись ML-модели пользователя из базы данных.

    Используется, когда нужно получить именно ту модель, которая сейчас
    считается актуальной для прогнозов.

    Args:
        db: Сессия базы данных.
        user_id: Идентификатор пользователя.

    Returns:
        Активная запись модели или `None`, если она не найдена.
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

    Обычно используется перед активацией новой модели, чтобы гарантировать,
    что у пользователя останется только одна активная запись.

    Args:
        db: Сессия базы данных.
        user_id: Идентификатор пользователя.
    """
    db.query(MLModel).filter(MLModel.user_id == user_id).update(
        {MLModel.is_active: False},
        synchronize_session=False,
    )
    db.commit()


def get_latest_user_model_record(db: Session, user_id: int) -> MLModel | None:
    """
    Возвращает последнюю модель пользователя, независимо от её активности.

    Это полезно для просмотра истории обучения или для принятия решения
    о повторном обучении.

    Args:
        db: Сессия базы данных.
        user_id: Идентификатор пользователя.

    Returns:
        Последняя запись модели или `None`, если записей нет.
    """
    return (
        db.query(MLModel)
        .filter(MLModel.user_id == user_id)
        .order_by(MLModel.trained_at.desc(), MLModel.id.desc())
        .first()
    )