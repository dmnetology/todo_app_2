# app/models/task.py

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    String,
    Text,
    Boolean,
    ForeignKey,
    DateTime,
    Integer,
    Enum as SqlEnum,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TaskPriority(str, Enum):
    """
    Перечисление для определения приоритета задачи.
    Используется для стандартизации возможных значений приоритета.
    """
    low = "low"
    medium = "medium"
    high = "high"


class TaskStatus(str, Enum):
    """
    Перечисление для определения статуса задачи.
    Отслеживает текущее состояние задачи в её жизненном цикле.
    """
    new = "new"
    in_progress = "in_progress"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class Task(Base):
    """
    Модель SQLAlchemy для представления задач в базе данных.

    Содержит информацию о названии, описании, статусе, приоритете,
    планируемом и фактическом времени выполнения, а также связи с
    пользователем-владельцем и категорией.
    """
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        SqlEnum(TaskStatus, name="taskstatus"),
        default=TaskStatus.new,
        nullable=False,
    )

    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    priority: Mapped[TaskPriority] = mapped_column(
        SqlEnum(TaskPriority, name="taskpriority"),
        default=TaskPriority.medium,
        nullable=False,
    )

    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # --- Поля для планируемого времени начала задачи ---
    # `planned_start_local` и `planned_start_timezone` позволяют хранить локальное время
    # и часовой пояс пользователя, в котором он планировал начать задачу.
    # `planned_start_at_utc` - это та же дата и время, но преобразованная в UTC,
    # для удобства сравнений и работы с ML-моделью.
    planned_start_local: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
    )
    planned_start_timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    planned_start_at_utc: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # --- Поля для фактического времени выполнения задачи ---
    actual_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Оценочная длительность задачи в минутах.
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, default=0, nullable=False)
    # Фактическая длительность задачи в минутах.
    actual_minutes: Mapped[int | None] = mapped_column(Integer, default=0, nullable=False)

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Определения связей (Relationships) ---
    owner = relationship("User", back_populates="tasks")
    category = relationship("Category", back_populates="tasks")
    pauses = relationship(
        "TaskPause",
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )