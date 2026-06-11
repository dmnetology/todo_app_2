# app/db/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# Создаём объект engine — основной объект SQLAlchemy для подключения к БД.
#
# engine отвечает за:
# - установку соединений с базой данных;
# - управление пулом соединений;
# - выполнение SQL-запросов на низком уровне.
#
# settings.DATABASE_URL берётся из конфигурации приложения,
# которая загружается из файла .env.
#
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)


# Создаём фабрику сессий SQLAlchemy.

SessionLocal = sessionmaker(
    # изменения в БД не будут сохраняться автоматически после каждого запроса.
    autocommit=False,

    # отключаем автоматическую отправку изменений в БД
    # перед выполнением запросов.
    autoflush=False,

    # связываем создаваемые сессии с нашим engine,
    bind=engine,
)


class Base(DeclarativeBase):
    """
    Базовый класс для всех ORM-моделей.
    SQLAlchemy знает, какие классы являются ORM-моделями и какие таблицы
    нужно создавать или использовать в базе данных.
    """

    pass


def get_db():
    """
    Создает сессию базы данных для одного запроса.
    Эта функция создаёт отдельную сессию БД для каждого HTTP-запроса,
    передаёт её в endpoint или сервис, а после завершения запроса
    гарантированно закрывает соединение.

    Конструкция yield позволяет FastAPI выполнить код до yield
    перед обработкой запроса, а код после yield — после завершения запроса.
    """
    db = SessionLocal()
    try:
        # Передаём сессию наружу — в endpoint, сервис или другую dependency.
        yield db
    finally:
        db.close()