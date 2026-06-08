# app/schemas/category.py

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    """
    Pydantic-схема для создания категории.

    Эта схема описывает данные, которые клиент отправляет
    при создании новой категории задач.

    Используется для валидации входящего JSON и генерации документации API.
    """

    name: str = Field(min_length=2, max_length=100)


class CategoryUpdate(BaseModel):
    """
    Pydantic-схема для обновления категории.

    Эта схема используется, когда клиент изменяет название категории.
    Обычно она применяется в endpoint редактирования категории.
    """

    name: str = Field(min_length=2, max_length=100)


class CategoryRead(BaseModel):
    """
    Pydantic-схема ответа с категорией.

    Эта схема используется для возврата данных категории клиенту.
    В ней содержатся только те поля, которые безопасно и нужно отдавать через API.
    """

    id: int
    name: str

    model_config = {
        "from_attributes": True,
    }