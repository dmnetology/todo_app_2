from datetime import datetime

from sqlalchemy import ForeignKey, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TaskPause(Base):
    __tablename__ = "task_pauses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )

    paused_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pause_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    task = relationship("Task", back_populates="pauses")