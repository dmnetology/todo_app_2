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
# from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON

from app.db.database import Base


class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    model_type = Column(String(100), nullable=False)
    model_path = Column(Text, nullable=False)

    trained_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    trained_on_count = Column(Integer, nullable=False)

    mae = Column(Float, nullable=True)
    fallback_mae = Column(Float, nullable=True)

    accepted = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=False)

    extra_metadata = Column("metadata", JSON, nullable=True)
