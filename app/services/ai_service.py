from sqlalchemy.orm import Session

from rapidfuzz import fuzz

from app.models.task import Task


def normalize_title(title: str) -> str:
    return " ".join(title.strip().lower().split())


def predict_task_duration(
    db: Session,
    user_id: int,
    title: str,
    category_id: int,
) -> int:
    """
    Прогнозирует время выполнения задачи.

    Логика:
    1. Сначала ищем задачи с точным совпадением названия и категории.
    2. Если точных совпадений нет — ищем похожие названия в той же категории.
    3. Если совпадений по названию нет — используем статистику по категории.
    4. Если данных по категории нет — используем общую статистику пользователя.
    5. Если данных нет вообще — возвращаем 60.
    """

    normalized_title = normalize_title(title)

    base_query = db.query(Task).filter(
        Task.owner_id == user_id,
        Task.is_completed.is_(True),
        Task.actual_minutes.isnot(None),
    )

    tasks = base_query.all()

    if not tasks:
        return 60

    # 1. Точное совпадение по названию и категории
    exact_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and normalize_title(task.title) == normalized_title
    ]

    if exact_tasks:
        total = sum(task.actual_minutes for task in exact_tasks)
        return round(total / len(exact_tasks))

    # 2. Похожие названия в той же категории
    similar_tasks = [
        task for task in tasks
        if task.category_id == category_id
        and fuzz.ratio(normalize_title(task.title), normalized_title) >= 85
    ]

    if similar_tasks:
        total = sum(task.actual_minutes for task in similar_tasks)
        return round(total / len(similar_tasks))

    # 3. Статистика по категории
    category_tasks = [
        task for task in tasks
        if task.category_id == category_id
    ]

    if category_tasks:
        total = sum(task.actual_minutes for task in category_tasks)
        return round(total / len(category_tasks))

    # 4. Общая статистика пользователя
    total = sum(task.actual_minutes for task in tasks)
    return round(total / len(tasks))