# app/ml/training.py

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd
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

# Минимальное количество выполненных задач для запуска обучения модели.
MIN_TRAINING_SAMPLES = 50
# Количество деревьев в RandomForestRegressor по умолчанию.
DEFAULT_N_ESTIMATORS = 200
# Фиксированное значение для воспроизводимости результатов обучения.
RANDOM_STATE = 42


def build_training_dataset(tasks: list[Task]) -> tuple[list[dict[str, Any]], list[float]]:
    """
    Преобразует список задач пользователя в обучающий набор данных X и целевую переменную y.

    Из выборки исключаются задачи без фактической длительности или с нулевой/отрицательной
    длительностью, так как они неинформативны для обучения регрессора.

    Args:
        tasks: Список задач пользователя.

    Returns:
        Кортеж из:
        - X: Список словарей признаков для каждой задачи.
        - y: Список фактических длительностей (целевая переменная).
    """
    X: list[dict[str, Any]] = []
    y: list[float] = []

    for task in tasks:
        # Пропускаем задачи без фактической длительности.
        if task.actual_minutes is None:
            continue

        actual_minutes = float(task.actual_minutes)
        # Пропускаем задачи с невалидной длительностью (<= 0).
        if actual_minutes <= 0:
            continue

        X.append(task_to_feature_dict(task))
        y.append(actual_minutes)

    return X, y


def build_pipeline() -> Pipeline:
    """
    Создает и возвращает пайплайн Scikit-learn для предобработки данных и обучения модели.

    Пайплайн включает:
    - `ColumnTransformer` для обработки различных типов признаков:
        - `numeric_transformer`: `SimpleImputer` для заполнения пропусков медианой
          для числовых признаков (`category_id`, `planned_weekday`, `planned_hour`).
        - `categorical_transformer`: `SimpleImputer` для заполнения пропусков
          наиболее частым значением и `OneHotEncoder` для кодирования
          категориальных признаков (`title`, `priority`).
    - `RandomForestRegressor` в качестве финальной модели.

    Returns:
        Собранный пайплайн Scikit-learn.
    """

    # Признаки, которые будут обрабатываться как числовые.
    # Даже если category_id и weekday/hour категориальные по сути, для некоторых
    # алгоритмов их можно рассматривать как числовые (или OneHotEncoder далее).
    numeric_features = ["category_id", "planned_weekday", "planned_hour"]
    # Признаки, которые будут обрабатываться как категориальные.
    categorical_features = ["title", "priority"]

    # Пайплайн для числовых признаков: только заполнение пропусков медианой.
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    # Пайплайн для категориальных признаков:
    # 1. Заполнение пропусков наиболее частым значением.
    # 2. One-Hot кодирование.
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore", # Игнорировать неизвестные категории при инференсе.
                    sparse_output=False, # Возвращать плотную матрицу, не разреженную.
                ),
            ),
        ]
    )

    # Объединение трансформеров для разных типов признаков.
    # `remainder="drop"` - отбрасывать признаки, не указанные ни в одном трансформере.
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ],
        remainder="drop",
    )

    # Сама модель Random Forest Regressor.
    # `n_jobs=-1` позволяет использовать все доступные ядра CPU для обучения.
    model = RandomForestRegressor(
        n_estimators=DEFAULT_N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    # Финальный пайплайн, включающий предобработку и модель.
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def train_duration_model_for_user(db: Session, user_id: int) -> MLModel:
    """
    Обучает модель предсказания длительности задач для конкретного пользователя.

    Процесс обучения:
    1. Извлекает все завершенные задачи пользователя с фактической длительностью.
    2. Формирует обучающий набор данных (`X`, `y`).
    3. Если данных недостаточно (`MIN_TRAINING_SAMPLES`), возбуждает `ValueError`.
    4. Строит и обучает Scikit-learn `Pipeline`.
    5. Оценивает качество обученной модели (MAE).
    6. Рассчитывает MAE для fallback-стратегии для сравнения.
    7. Сравнивает новую модель с fallback и с текущей активной моделью пользователя.
    8. Если новая модель признана "лучшей" (`accepted=True`):
        - Деактивирует все предыдущие модели пользователя в БД.
        - Сохраняет артефакты новой модели (pipeline и метаданные) на диск.
        - Создает новую запись `MLModel` в БД как активную и принятую.
    9. Если новая модель не "лучшая" (`accepted=False`):
        - Сохраняет запись `MLModel` в БД как неактивную и не принятую.
        - *Не сохраняет* артефакты модели на диск, чтобы не перезаписывать
          уже существующую и, возможно, лучшую модель.

    Args:
        db: Сессия базы данных.
        user_id: Идентификатор пользователя, для которого обучается модель.

    Returns:
        Запись MLModel из базы данных, соответствующая результатам обучения.

    Raises:
        ValueError: Если количество доступных обучающих выборок меньше `MIN_TRAINING_SAMPLES`.
    """

    # Загружаем все завершенные задачи пользователя для обучения.
    tasks = (
        db.query(Task)
        .filter(
            Task.owner_id == user_id,
            Task.is_completed.is_(True),
        )
        .all()
    )

    # Формируем обучающий набор данных.
    X, y = build_training_dataset(tasks)

    # Проверяем достаточность данных для обучения.
    if len(X) < MIN_TRAINING_SAMPLES:
        raise ValueError(
            f"Not enough training data for user {user_id}: "
            f"{len(X)} samples, need at least {MIN_TRAINING_SAMPLES}"
        )

    # Преобразуем X в DataFrame для совместимости с ColumnTransformer.
    X_df = pd.DataFrame(X)
    # Строим и обучаем пайплайн.
    pipeline = build_pipeline()
    pipeline.fit(X_df, y)

    # Оцениваем MAE обученной модели на обучающей выборке.
    predictions = pipeline.predict(X_df)
    mae = float(mean_absolute_error(y, predictions))

    # Рассчитываем MAE для fallback-стратегии.
    # Важно: fallback_predict_task_duration нужно вызывать для каждой задачи отдельно,
    # так как она использует данные из базы данных.
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

    # Получаем текущую активную модель пользователя для сравнения.
    current_active_model = (
        db.query(MLModel)
        .filter(
            MLModel.user_id == user_id,
            MLModel.is_active.is_(True),
        )
        .order_by(MLModel.trained_at.desc())
        .first()
    )

    # Определяем, лучше ли новая модель fallback и текущей активной.
    better_than_fallback = mae < fallback_mae
    better_than_current = (
        current_active_model is None
        or current_active_model.mae is None
        or mae <= float(current_active_model.mae)
    )

    # Модель считается принятой, если она лучше и fallback, и текущей.
    accepted = better_than_fallback and better_than_current

    # Подготавливаем метаданные для сохранения.
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
        # Если модель принята, деактивируем старые и сохраняем новую.
        deactivate_user_models(db, user_id)

        # Сохраняем артефакты модели на диск.
        model_path_str, _ = save_model_artifacts(
            user_id=user_id,
            model=pipeline,
            metadata=model_metadata,
        )
        # Создаем новую запись в БД.
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
        # Если модель не принята, просто создаем запись в БД без сохранения артефактов
        # на диск и без изменения текущей активной модели.
        # model_path оставляем пустым, т.к. модель на диске не сохраняется как новая.
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