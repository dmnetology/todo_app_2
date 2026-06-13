# app/models/ml_model.py

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    ForeignKey,
    func,
)

from sqlalchemy import JSON

from app.db.database import Base


class MLModel(Base):
    """
    Модель SQLAlchemy для хранения метаданных обученных ML-моделей.

    Каждая запись в этой таблице соответствует одной версии обученной ML-модели
    для конкретного пользователя. Здесь хранятся не сами модели, а информация
    о них (путь к файлу, метрики, статус активности и т.д.).
    """
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, index=True)
    # ID пользователя, которому принадлежит модель. CASCADE удалит модели пользователя при удалении самого пользователя
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    model_type = Column(String(100), nullable=False) # Тип модели
    model_path = Column(Text, nullable=False) # Путь к файлу на диске, где хранится сериализованная модель

    trained_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    trained_on_count = Column(Integer, nullable=False)  # Количество задач, на которых была обучена модель

    mae = Column(Float, nullable=True)
    fallback_mae = Column(Float, nullable=True)

    accepted = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=False)

    extra_metadata = Column("metadata", JSON, nullable=True)
