# app/db/base.py

# Централизованная загрузка моделей SQLAlchemy

from app.db.database import Base
from app.models.user import User
from app.models.category import Category
from app.models.task import Task
from app.models.task_pause import TaskPause