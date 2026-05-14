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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TaskPriority(str, Enum):
    """
    Перечисление возможных приоритетов задачи.

    Наследование от Enum делает класс полноценным перечислением,
    где можно заранее ограничить набор допустимых значений.

    Допустимые значения:
    - low — низкий приоритет;
    - medium — средний приоритет;
    - high — высокий приоритет.
    """

    low = "low"
    medium = "medium"
    high = "high"


class Task(Base):
    """
    ORM-модель задачи пользователя.

    Этот класс описывает таблицу tasks в базе данных.
    Каждая запись в таблице tasks — это отдельная задача.

    Задача:
    - принадлежит конкретному пользователю;
    - может иметь категорию;
    - может иметь приоритет;
    - может иметь срок выполнения;
    - может быть выполненной или невыполненной.
    """

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)     # Уникальный идентификатор задачи.

    title: Mapped[str] = mapped_column(String(200), nullable=False)     # Заголовок задачи.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)     # Подробное описание задачи.

    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)     # Флаг выполнения задачи.

    priority: Mapped[TaskPriority] = mapped_column(     # Приоритет задачи.
        SqlEnum(TaskPriority),
        default=TaskPriority.medium,
        nullable=False,
    )

    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)     # Срок выполнения задачи.

    created_at: Mapped[datetime] = mapped_column(     # Дата и время создания задачи.
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)   # Дата и время завершения задачи.

    # Оценочное время выполнения задачи в минутах.
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Фактическое время выполнения задачи в минутах.
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Идентификатор владельца задачи.
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Идентификатор категории задачи.
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    owner = relationship("User", back_populates="tasks")
    category = relationship("Category", back_populates="tasks")