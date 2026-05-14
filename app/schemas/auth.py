from pydantic import BaseModel, Field


class Token(BaseModel):
    """
    Pydantic-схема JWT-токенов.

    Эта схема описывает ответ API после успешной авторизации
    или обновления токенов.

    Клиент получает:
    - access_token — короткоживущий токен для доступа к защищённым endpoint;
    - refresh_token — долгоживущий токен для получения нового access_token;
    - token_type — тип токена (bearer).
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    """
    Pydantic-схема входа пользователя.

    Эта схема описывает данные, которые клиент отправляет
    при попытке авторизации.
    """

    login: str
    password: str


class ChangePasswordRequest(BaseModel):
    """
    Pydantic-схема смены пароля.

    Эта схема описывает тело запроса для изменения пароля
    авторизованного пользователя.

    Для смены пароля пользователь должен передать:
    - старый пароль;
    - новый пароль.
    """

    old_password: str
    new_password: str = Field(min_length=6, max_length=100)


class RefreshTokenRequest(BaseModel):
    """
    Pydantic-схема обновления access-токена.

    Эта схема описывает тело запроса, в котором клиент отправляет refresh_token,
    чтобы получить новый access_token.
    """

    refresh_token: str