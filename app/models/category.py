from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Category(Base):
    """
    ORM-модель категории задач.

    Этот класс описывает таблицу categories в базе данных.
    Категории используются для группировки задач пользователя.

    Пример категорий:
    - Работа
    - Учёба
    - Дом
    - Покупки

    Каждая категория принадлежит конкретному пользователю.
    """

    __tablename__ = "categories"

    # Уникальный идентификатор категории.
    #
    # primary_key=True делает поле первичным ключом таблицы.
    # index=True создаёт индекс для ускорения поиска по id.
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    tasks = relationship("Task", back_populates="category")

    __table_args__ = (
        # Уникальное ограничение на пару полей name + user_id для каждого пользователя
        UniqueConstraint("name", "user_id", name="unique_user_category"),
    )