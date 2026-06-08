# app/models/__init__.py

"""
Пакет ORM-моделей приложения.

Здесь собраны импорты всех моделей, чтобы SQLAlchemy и Alembic
могли корректно видеть всю структуру метаданных при запуске проекта.
"""

from app.models.user import User
from app.models.category import Category
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.task_pause import TaskPause
from app.models.ml_model import MLModel

__all__ = [
    "User",
    "Category",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "TaskPause",
    "MLModel",
]