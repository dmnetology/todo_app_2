from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class User(Base):
    """
    ORM-модель пользователя приложения.

    Класс описывает таблицу users в базе данных.
    Каждый объект User соответствует одной записи в таблице пользователей.

    Модель используется SQLAlchemy для:
    - создания SQL-запросов;
    - чтения пользователей из базы данных;
    - сохранения новых пользователей;
    - описания связей пользователя с другими таблицами.
    """

    # Название таблицы в базе данных
    __tablename__ = "users"

    # Уникальный идентификатор пользователя.
    #
    # primary_key=True делает поле первичным ключом таблицы.
    # index=True создаёт индекс для ускорения поиска по id.
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Имя пользователя.
    #
    # String(100) ограничивает длину строки до 100 символов.
    # nullable=False означает, что поле обязательно для заполнения.
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Фамилия пользователя.
    #
    # Также обязательное поле с максимальной длиной 100 символов.
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Логин пользователя.
    #
    # Используется для авторизации в приложении.
    #
    # unique=True запрещает создавать двух пользователей
    # с одинаковым логином.
    login: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    # Хэшированный пароль пользователя.
    #
    # В базе данных нельзя хранить пароль в открытом виде.
    # Вместо этого сохраняется результат хэширования пароля.
    #
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Связь "один ко многим" между пользователем и задачами.
    #
    # Один пользователь может иметь много задач.
    #
    # relationship не создаёт колонку в таблице users напрямую.
    # Он описывает ORM-связь между моделями User и Task.
    tasks = relationship(
        # Название связанной модели.
        "Task",
        # back_populates указывает поле на другой стороне связи.
        back_populates="owner",
        # cascade="all, delete-orphan" означает:
        # операции с пользователем будут каскадно применяться
        # к его задачам;
        # если задача больше не связана с пользователем,
        # она будет удалена из базы данных.
        cascade="all, delete-orphan",
    )