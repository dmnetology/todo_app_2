# app/services/sync_service.py

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any
from pydantic import ValidationError

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.sync import SyncJsonExport, SyncImportResult, SyncJsonImport
from app.services.task_service import create_task_from_import


def _dt(value: Any) -> datetime | None:
    """
    Преобразует входное значение в объект datetime.
    Поддерживает ISO-формат строки (с 'Z' для UTC).

    Args:
        value: Входное значение, которое может быть None, пустой строкой,
               объектом datetime или строкой в ISO-формате.

    Returns:
        Объект `datetime` в UTC или `None`, если входное значение пустое.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    # Заменяем 'Z' на '+00:00' для корректного парсинга ISO-формата с ZoneInfo
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _priority(value: Any) -> TaskPriority:
    """
    Преобразует входное значение в перечисление `TaskPriority`.

    Args:
        value: Входное значение, которое может быть объектом `TaskPriority`
               или строковым представлением приоритета.

    Returns:
        Объект `TaskPriority`.
    """
    if isinstance(value, TaskPriority):
        return value
    return TaskPriority(str(value))


def _status(value: Any) -> TaskStatus:
    """
    Преобразует входное значение в перечисление `TaskStatus`.

    Args:
        value: Входное значение, которое может быть объектом `TaskStatus`
               или строковым представлением статуса.

    Returns:
        Объект `TaskStatus`.
    """
    if isinstance(value, TaskStatus):
        return value
    return TaskStatus(str(value))


def _validate_task_row(
    *,
    title: str,
    category_id: int | None,
    priority: TaskPriority | None,
    status: TaskStatus | None,
    planned_start_local: datetime | None,
    planned_start_timezone: str | None,
    actual_started_at: datetime | None,
    completed_at: datetime | None,
) -> None:
    """
    Выполняет валидацию данных одной строки задачи перед импортом.

    Args:
        title: Название задачи.
        category_id: ID категории задачи.
        priority: Приоритет задачи.
        status: Статус задачи.
        planned_start_local: Планируемое локальное время начала задачи.
        planned_start_timezone: Часовой пояс для `planned_start_local`.
        actual_started_at: Фактическое время начала задачи.
        completed_at: Время завершения задачи.

    Raises:
        ValueError: Если данные задачи не соответствуют правилам валидации
                    (например, отсутствуют обязательные поля, некорректный статус,
                    противоречия во временах для разных статусов).
    """
    if not title:
        raise ValueError("title is required")

    if status is None:
        raise ValueError("status is required")
    # Проверка на поддерживаемые статусы для импорта
    if status not in {
        TaskStatus.new,
        TaskStatus.in_progress,
        TaskStatus.completed,
    }:
        raise ValueError(f"unsupported status: {status}")

    if priority is None:
        raise ValueError("priority is required")

    if planned_start_local is None:
        raise ValueError("planned_start_local is required")

    if not planned_start_timezone:
        raise ValueError("planned_start_timezone is required")

    if status == TaskStatus.new:
        if actual_started_at is not None:
            raise ValueError("actual_started_at must be empty for new task")
        if completed_at is not None:
            raise ValueError("completed_at must be empty for new task")

    elif status == TaskStatus.in_progress:
        if actual_started_at is None:
            raise ValueError("actual_started_at is required for in_progress task")
        if completed_at is not None:
            raise ValueError("completed_at must be empty for in_progress task")

    elif status == TaskStatus.completed:
        if actual_started_at is None:
            raise ValueError("actual_started_at is required for completed task")
        if completed_at is None:
            raise ValueError("completed_at is required for completed task")
        if completed_at < actual_started_at:
            raise ValueError("completed_at cannot be earlier than actual_started_at")


def export_json(db: Session, user) -> dict:
    """
    Экспортирует все категории и задачи пользователя в JSON-формате.

    Args:
        db: Сессия базы данных.
        user: Объект текущего пользователя.

    Returns:
        Словарь, представляющий экспортированные данные в формате
        `SyncJsonExport`, готовый для сериализации в JSON.
    """

    # Получаем все категории, принадлежащие пользователю
    categories = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .order_by(Category.id.asc())
        .all()
    )
    # Получаем все задачи, принадлежащие пользователю
    tasks = (
        db.query(Task)
        .filter(Task.owner_id == user.id)
        .order_by(Task.id.asc())
        .all()
    )

    # Формируем объект SyncJsonExport
    payload = SyncJsonExport(
        categories=[
            {
                "id": c.id,
                "name": c.name,
            }
            for c in categories
        ],
        tasks=[
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "category_id": t.category_id,
                "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "due_date": t.due_date,
                "created_at": t.created_at,
                "planned_start_local": t.planned_start_local,
                "planned_start_timezone": t.planned_start_timezone,
                "planned_start_at_utc": t.planned_start_at_utc,
                "actual_started_at": t.actual_started_at,
                "current_started_at": t.current_started_at,
                "completed_at": t.completed_at,
                "estimated_minutes": t.estimated_minutes,
                "actual_minutes": t.actual_minutes,
                "is_completed": t.is_completed,
            }
            for t in tasks
        ],
    )

    # Возвращаем данные, преобразованные в словарь, соответствующий JSON
    return payload.model_dump(mode="json")


def import_json(db: Session, user, data: dict) -> SyncImportResult:
    """
    Импортирует задачи из JSON-данных в базу данных пользователя.

    Валидирует входные данные JSON с помощью Pydantic и затем создает
    задачи, используя `create_task_from_import`. Обрабатывает пропущенные
    задачи и собирает информацию о проблемах.

    Args:
        db: Сессия базы данных.
        user: Объект текущего пользователя.
        data: Входные JSON-данные в виде словаря.

    Returns:
        Объект `SyncImportResult`, содержащий статистику и проблемы импорта.

    Raises:
        ValueError: Если JSON-данные не соответствуют схеме `SyncJsonImport`
                    или возникают другие ошибки в процессе импорта.
    """
    try:
        payload = SyncJsonImport.model_validate(data)
    except ValidationError as exc:
        safe_errors = []
        for err in exc.errors():
            safe_err = {
                "type": err.get("type"),
                "loc": list(err.get("loc", [])),
                "msg": err.get("msg"),
                "input": err.get("input"),
            }
            # ctx часто содержит ValueError / Exception — это не JSON serializable
            if "ctx" in err and isinstance(err["ctx"], dict):
                safe_ctx = {}
                for k, v in err["ctx"].items():
                    safe_ctx[k] = str(v)
                safe_err["ctx"] = safe_ctx

            if "url" in err:
                safe_err["url"] = err["url"]

            safe_errors.append(safe_err)

        raise ValueError(
            {
                "message": "JSON содержит ошибки валидации",
                "errors": safe_errors,
            }
        ) from exc

    result = SyncImportResult()

    try:
        for item in payload.tasks:
            try:
                title = item.title
                category_id = item.category_id
                priority = _priority(item.priority)
                status = _status(item.status)
                planned_start_local = item.planned_start_local
                planned_start_timezone = item.planned_start_timezone

                description = item.description
                due_date = item.due_date
                actual_started_at = item.actual_started_at
                completed_at = item.completed_at

                _validate_task_row(
                    title=title,
                    category_id=category_id,
                    priority=priority,
                    status=status,
                    planned_start_local=planned_start_local,
                    planned_start_timezone=planned_start_timezone,
                    actual_started_at=actual_started_at,
                    completed_at=completed_at,
                )

                existing_category = (
                    db.query(Category)
                    .filter(
                        Category.user_id == user.id,
                        Category.id == category_id,
                    )
                    .first()
                )
                if not existing_category:
                    result.tasks_skipped += 1
                    result.problems.append(
                        f"Task '{title}': category_id={category_id} not found"
                    )
                    continue

                task = create_task_from_import(
                    db=db,
                    user=user,
                    title=title,
                    description=description,
                    category_id=category_id,
                    priority=priority,
                    due_date=due_date,
                    planned_start_local=planned_start_local,
                    planned_start_timezone=planned_start_timezone,
                    status=status,
                    actual_started_at=actual_started_at,
                    completed_at=completed_at,
                )

                result.tasks_created += 1
                # если хочешь вернуть id созданных задач:
                result.created_task_ids.append(task.id)

            except Exception as e:
                result.tasks_skipped += 1
                result.problems.append(f"Task '{getattr(item, 'title', None)}': {str(e)}")

        db.commit()
        return result

    except Exception:
        db.rollback()
        raise



def export_csv(db: Session, user) -> tuple[str, str]:
    """
    Экспортирует все категории и задачи пользователя в CSV-формате.

    Возвращает две строки: одна для категорий, другая для задач.

    Args:
        db: Сессия базы данных.
        user: Объект текущего пользователя.

    Returns:
        Кортеж из двух строк: (CSV-данные категорий, CSV-данные задач).
    """
    categories = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .order_by(Category.id.asc())
        .all()
    )

    tasks = (
        db.query(Task)
        .filter(Task.owner_id == user.id)
        .order_by(Task.id.asc())
        .all()
    )

    categories_buffer = io.StringIO()
    tasks_buffer = io.StringIO()

    cat_writer = csv.DictWriter(categories_buffer, fieldnames=["id", "name"])
    cat_writer.writeheader()
    for c in categories:
        cat_writer.writerow(
            {
                "id": c.id,
                "name": c.name,
            }
        )

    task_fields = [
        "id",
        "title",
        "description",
        "category_id",
        "priority",
        "status",
        "due_date",
        "created_at",
        "planned_start_local",
        "planned_start_timezone",
        "planned_start_at_utc",
        "actual_started_at",
        "current_started_at",
        "completed_at",
        "estimated_minutes",
        "actual_minutes",
        "is_completed",
    ]

    task_writer = csv.DictWriter(tasks_buffer, fieldnames=task_fields)
    task_writer.writeheader()

    for t in tasks:
        task_writer.writerow(
            {
                "id": t.id,
                "title": t.title,
                "description": t.description or "",
                "category_id": t.category_id or "",
                "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "due_date": t.due_date.isoformat() if t.due_date else "",
                "created_at": t.created_at.isoformat() if t.created_at else "",
                "planned_start_local": t.planned_start_local.isoformat() if t.planned_start_local else "",
                "planned_start_timezone": t.planned_start_timezone or "",
                "planned_start_at_utc": t.planned_start_at_utc.isoformat() if t.planned_start_at_utc else "",
                "actual_started_at": t.actual_started_at.isoformat() if t.actual_started_at else "",
                "current_started_at": t.current_started_at.isoformat() if t.current_started_at else "",
                "completed_at": t.completed_at.isoformat() if t.completed_at else "",
                "estimated_minutes": t.estimated_minutes if t.estimated_minutes is not None else "",
                "actual_minutes": t.actual_minutes if t.actual_minutes is not None else "",
                "is_completed": str(bool(t.is_completed)).lower(),
            }
        )

    return categories_buffer.getvalue(), tasks_buffer.getvalue()


def import_csv(db: Session, user, tasks_csv: str) -> SyncImportResult:
    """
    Импортирует задачи из CSV-строки в базу данных пользователя.

    Парсит CSV-данные, валидирует каждую строку и создает задачи,
    используя `create_task_from_import`.

    Args:
        db: Сессия базы данных.
        user: Объект текущего пользователя.
        tasks_csv: Строка, содержащая CSV-данные задач.

    Returns:
        Объект `SyncImportResult`, содержащий статистику и проблемы импорта.

    Raises:
        Exception: В случае любой непредвиденной ошибки в процессе импорта,
                   изменения будут откачены.
    """
    result = SyncImportResult()

    try:
        tasks_reader = csv.DictReader(io.StringIO(tasks_csv))

        for row in tasks_reader:
            try:
                title = (row.get("title") or "").strip()
                if not title:
                    raise ValueError("title is required")

                category_id = None
                raw_category_id = (row.get("category_id") or "").strip()
                if raw_category_id:
                    category_id = int(raw_category_id)
                else:
                    raw_category_name = (row.get("category") or row.get("category_name") or "").strip()
                    if raw_category_name:
                        existing_category = (
                            db.query(Category)
                            .filter(
                                Category.user_id == user.id,
                                Category.name == raw_category_name,
                            )
                            .first()
                        )
                        if existing_category:
                            category_id = existing_category.id
                        else:
                            result.tasks_skipped += 1
                            result.problems.append(
                                f"Task '{title}': category '{raw_category_name}' not found"
                            )
                            continue

                priority = _priority(row.get("priority"))
                status = _status(row.get("status"))

                due_date = _dt(row.get("due_date"))
                planned_start_local = _dt(row.get("planned_start_local"))
                planned_start_timezone = row.get("planned_start_timezone") or None
                actual_started_at = _dt(row.get("actual_started_at"))
                completed_at = _dt(row.get("completed_at"))

                _validate_task_row(
                    title=title,
                    category_id=category_id,
                    priority=priority,
                    status=status,
                    planned_start_local=planned_start_local,
                    planned_start_timezone=planned_start_timezone,
                    actual_started_at=actual_started_at,
                    completed_at=completed_at,
                )

                if category_id is not None:
                    existing_category = (
                        db.query(Category)
                        .filter(
                            Category.user_id == user.id,
                            Category.id == category_id,
                        )
                        .first()
                    )
                    if not existing_category:
                        result.tasks_skipped += 1
                        result.problems.append(
                            f"Task '{title}': category_id={category_id} not found"
                        )
                        continue

                task = create_task_from_import(
                    db=db,
                    user=user,
                    title=title,
                    description=row.get("description") or None,
                    category_id=category_id,
                    priority=priority,
                    due_date=due_date,
                    planned_start_local=planned_start_local,
                    planned_start_timezone=planned_start_timezone,
                    status=status,
                    actual_started_at=actual_started_at,
                    completed_at=completed_at,
                )

                result.tasks_created += 1
                result.created_task_ids.append(task.id)

            except Exception as e:
                result.tasks_skipped += 1
                result.problems.append(f"Task '{row.get('title')}': {str(e)}")

        db.commit()
        return result

    except Exception:
        db.rollback()
        raise