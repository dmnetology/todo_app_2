# app/ml/features.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models.task import Task


@dataclass
class TaskFeatures:
    """
    Набор признаков, используемых моделью для оценки длительности задачи.

    Эти признаки формируются из полей задачи и передаются в ML-пайплайн
    в виде компактной структуры.
    """
    title: str
    category_id: int | None
    priority: str
    planned_weekday: int | None
    planned_hour: int | None


def normalize_title(title: str | None) -> str:
    """
    Нормализует название задачи для устойчивого сравнения и обработки моделью.

    Приводит строку к нижнему регистру, убирает лишние пробелы
    и схлопывает последовательности пробельных символов в один пробел.

    Args:
        title: Исходное название задачи.

    Returns:
        Нормализованное название задачи.
    """
    return " ".join((title or "").strip().lower().split())


def get_planned_datetime(task: Task) -> datetime | None:
    """
    Возвращает локальное запланированное время старта задачи.

    В модели используется именно `planned_start_local`, так как это
    представление времени в локальном часовом поясе пользователя.
    Если дата не задана, временные признаки будут `None`.

    Args:
        task: Задача из базы данных.

    Returns:
        Локальная дата/время планового старта или `None`.
    """
    return task.planned_start_local


def extract_task_features(task: Task) -> TaskFeatures:
    """
    Извлекает признаки из задачи для дальнейшего использования в ML-пайплайне.

    Args:
        task: Задача из базы данных.

    Returns:
        Структура с подготовленными признаками.
    """
    planned_dt = get_planned_datetime(task)

    return TaskFeatures(
        title=normalize_title(task.title),
        category_id=task.category_id,
        # priority может быть enum-объектом или строкой в зависимости от модели,
        # поэтому приводим его к строке безопасным способом (задел на случай изменений).
        priority=task.priority.value if hasattr(task.priority, "value") else str(task.priority),
        planned_weekday=planned_dt.weekday() if planned_dt else None,
        planned_hour=planned_dt.hour if planned_dt else None,
    )


def task_to_feature_dict(task: Task) -> dict[str, Any]:
    """
    Преобразует задачу в словарь признаков для sklearn Pipeline.

    Такой формат удобен для передачи в `DictVectorizer`, `ColumnTransformer`
    или другой пайплайн предобработки.

    Args:
        task: Задача из базы данных.

    Returns:
        Словарь признаков.
    """
    features = extract_task_features(task)

    return {
        "title": features.title,
        "category_id": features.category_id,
        "priority": features.priority,
        "planned_weekday": features.planned_weekday,
        "planned_hour": features.planned_hour,
    }