# app/ml/fallback.py

from statistics import median
from sqlalchemy.orm import Session
from rapidfuzz import fuzz

from app.models.task import Task

# Значение по умолчанию, если в истории пользователя недостаточно данных
DEFAULT_DURATION_MINUTES = 60

# Порог схожести названия задачи для поиска "похожих" завершённых задач.
TITLE_SIMILARITY_THRESHOLD = 85


def normalize_title(title: str) -> str:
    """
    Нормализует название задачи для более стабильного сравнения.

    Приводит строку к нижнему регистру, убирает лишние пробелы
    и схлопывает последовательности пробельных символов в один пробел.

    Args:
        title: Исходное название задачи.

    Returns:
        Нормализованное название.
    """
    return " ".join((title or "").strip().lower().split())


def median_minutes(tasks: list[Task]) -> int:
    """
    Вычисляет медианное значение фактической длительности задач.

    Используются только задачи, у которых `actual_minutes` задано
    и больше нуля.

    Args:
        tasks: Список задач.

    Returns:
        Медианная длительность в минутах или значение по умолчанию,
        если подходящих данных нет.
    """
    values = [task.actual_minutes for task in tasks if task.actual_minutes and task.actual_minutes > 0]

    if not values:
        return DEFAULT_DURATION_MINUTES

    return int(round(median(values)))


def fallback_predict_task_duration(
    db: Session,
    user_id: int,
    title: str,
    category_id: int | None,
) -> int:
    """
    Возвращает fallback-оценку длительности задачи без использования ML-модели.

    Логика подбора значения построена по приоритету:
    1. завершённые задачи с точно таким же названием и категорией;
    2. завершённые задачи с похожим названием и той же категорией;
    3. все завершённые задачи той же категории;
    4. вообще все завершённые задачи пользователя;
    5. значение по умолчанию, если данных нет.

    Args:
        db: Активная сессия базы данных.
        user_id: Идентификатор пользователя.
        title: Название прогнозируемой задачи.
        category_id: Идентификатор категории задачи.

    Returns:
        Оценка длительности задачи в минутах.
    """
    normalized_title = normalize_title(title)

    tasks = (
        db.query(Task)
        .filter(
            Task.owner_id == user_id,
            Task.is_completed.is_(True),
            Task.actual_minutes > 0,
        )
        .all()
    )

    if not tasks:
        return DEFAULT_DURATION_MINUTES

    # Сначала ищем строго совпадающие задачи:
    # это самый надёжный источник для fallback-оценки.
    exact_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and normalize_title(task.title) == normalized_title
    ]

    if exact_tasks:
        return median_minutes(exact_tasks)

    # Если точных совпадений нет, используем fuzzy-сравнение названий.
    similar_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and fuzz.ratio(normalize_title(task.title), normalized_title) >= TITLE_SIMILARITY_THRESHOLD
    ]

    if similar_tasks:
        return median_minutes(similar_tasks)

    # Если совпадений по названию нет, но есть задачи той же категории,
    # берём медиану по этой категории.
    category_tasks = [
        task for task in tasks
        if task.category_id == category_id
    ]

    if category_tasks:
        return median_minutes(category_tasks)

    # Последний вариант — медиана по всем завершённым задачам пользователя.
    return median_minutes(tasks)