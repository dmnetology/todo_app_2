# app/ml/training.py

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from sqlalchemy.orm import Session

from app.ml.features import task_to_feature_dict
from app.ml.fallback import fallback_predict_task_duration
from app.ml.model_registry import (
    deactivate_user_models,
    save_model_artifacts,
)
from app.models.ml_model import MLModel
from app.models.task import Task


MIN_TRAINING_SAMPLES = 50
DEFAULT_N_ESTIMATORS = 200
RANDOM_STATE = 42


def build_training_dataset(tasks: list[Task]) -> tuple[list[dict[str, Any]], list[float]]:
    """
    Преобразует задачи в X/y для обучения.
    """
    X: list[dict[str, Any]] = []
    y: list[float] = []

    for task in tasks:
        if task.actual_minutes is None:
            continue

        actual_minutes = float(task.actual_minutes)
        if actual_minutes <= 0:
            continue

        X.append(task_to_feature_dict(task))
        y.append(actual_minutes)

    return X, y


def build_pipeline() -> Pipeline:
    """
    Pipeline для обучения регрессора.
    """
    numeric_features = ["category_id", "planned_weekday", "planned_hour"]
    categorical_features = ["title", "priority"]

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ],
        remainder="drop",
    )

    model = RandomForestRegressor(
        n_estimators=DEFAULT_N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def train_duration_model_for_user(db: Session, user_id: int) -> MLModel:
    """
    Обучает модель предсказания длительности задач для конкретного пользователя.

    Логика:
    1) собирает обучающую выборку;
    2) обучает pipeline;
    3) считает mae и fallback_mae;
    4) сравнивает новую модель:
       - с fallback;
       - с текущей активной моделью пользователя;
    5) если новая модель лучше — сохраняет артефакты, деактивирует старые модели,
       создаёт активную запись MLModel;
    6) если хуже — сохраняет запись MLModel как неактивную, но НЕ перезаписывает
       текущую активную модель на диске.
    """
    tasks = (
        db.query(Task)
        .filter(
            Task.owner_id == user_id,
            Task.is_completed.is_(True),
        )
        .all()
    )

    X: list[dict[str, Any]] = []
    y: list[float] = []

    for task in tasks:
        if task.actual_minutes is None:
            continue

        actual_minutes = float(task.actual_minutes)
        if actual_minutes <= 0:
            continue

        X.append(task_to_feature_dict(task))
        y.append(actual_minutes)

    if len(X) < MIN_TRAINING_SAMPLES:
        raise ValueError(
            f"Not enough training data for user {user_id}: "
            f"{len(X)} samples, need at least {MIN_TRAINING_SAMPLES}"
        )

    pipeline = build_pipeline()
    pipeline.fit(X, y)

    predictions = pipeline.predict(X)
    mae = float(mean_absolute_error(y, predictions))

    fallback_predictions = [
        float(
            fallback_predict_task_duration(
                db=db,
                user_id=user_id,
                title=task.title,
                category_id=task.category_id,
            )
        )
        for task in tasks
        if task.actual_minutes is not None and task.actual_minutes > 0
    ]

    fallback_mae = float(mean_absolute_error(y, fallback_predictions))

    current_active_model = (
        db.query(MLModel)
        .filter(
            MLModel.user_id == user_id,
            MLModel.is_active.is_(True),
        )
        .order_by(MLModel.trained_at.desc())
        .first()
    )

    better_than_fallback = mae < fallback_mae
    better_than_current = (
        current_active_model is None
        or current_active_model.mae is None
        or mae <= float(current_active_model.mae)
    )

    accepted = better_than_fallback and better_than_current

    model_metadata = {
        "user_id": user_id,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples_count": len(X),
        "mae": mae,
        "fallback_mae": fallback_mae,
        "accepted": accepted,
        "model_type": "random_forest_regressor",
        "features": [
            "title",
            "category_id",
            "priority",
            "planned_weekday",
            "planned_hour",
        ],
        "comparison": {
            "better_than_fallback": better_than_fallback,
            "better_than_current": better_than_current,
            "current_active_model_id": current_active_model.id if current_active_model else None,
            "current_active_model_mae": float(current_active_model.mae) if current_active_model and current_active_model.mae is not None else None,
        },
    }

    if accepted:
        # Сначала деактивируем все старые модели пользователя
        deactivate_user_models(db, user_id)

        # Потом сохраняем артефакты новой модели
        model_path_str, _ = save_model_artifacts(
            user_id=user_id,
            model=pipeline,
            metadata=model_metadata,
        )

        ml_model = MLModel(
            user_id=user_id,
            model_type="random_forest_regressor",
            model_path=model_path_str,
            trained_on_count=len(X),
            mae=mae,
            fallback_mae=fallback_mae,
            accepted=True,
            is_active=True,
            extra_metadata=model_metadata,
        )
    else:
        # Модель хуже — сохраняем запись в БД как неактивную.
        # ВАЖНО: артефакты на диск не перезаписываем, чтобы не сломать текущую активную модель.
        #
        # Если тебе обязательно нужно хранить все неактивные модели на диске,
        # тогда нужна версионированная схема путей, а не один model.joblib на пользователя.
        ml_model = MLModel(
            user_id=user_id,
            model_type="random_forest_regressor",
            model_path="",
            trained_on_count=len(X),
            mae=mae,
            fallback_mae=fallback_mae,
            accepted=False,
            is_active=False,
            extra_metadata=model_metadata,
        )

    db.add(ml_model)
    db.commit()
    db.refresh(ml_model)

    return ml_model