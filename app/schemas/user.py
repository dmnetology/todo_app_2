from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """
    Pydantic-схема для регистрации пользователя.

    Эта схема описывает данные, которые клиент должен отправить
    при создании нового пользователя.

    Эта схема нужна для:
    - валидации входящих данных;
    - ограничения длины строк;
    - автоматической генерации OpenAPI-документации;
    - удобной передачи данных внутри приложения.
    """

    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    login: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=100)


class UserRead(BaseModel):
    """
    Pydantic-схема ответа с данными пользователя.

    Эта схема используется, когда приложение возвращает данные пользователя
    клиенту.

    Здесь нет поля password или hashed_password.
    Это сделано специально, чтобы не отдавать пароль или его хэш наружу
    через API-ответ.
    """

    id: int
    first_name: str
    last_name: str
    login: str

    model_config = {
        "from_attributes": True,
    }