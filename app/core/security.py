# Безопасность проекта

from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет, совпадает ли обычный пароль с сохранённым хэшем.

    Используется при входе пользователя в систему:
    - пользователь вводит пароль;
    - сервер берёт хэш из базы данных;
    - функция сравнивает их и возвращает True или False.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Создаёт хэш пароля.

    Функция используется при регистрации пользователя
    и при смене пароля.

    В базе данных нельзя хранить пароль в открытом виде,
    поэтому сохраняется только его хэш.
    """
    return pwd_context.hash(password)

def create_token(subject: str, expires_minutes: int, token_type: str) -> str:
    """
    Создаётся JWT-токен.

    Параметры:
    - subject — идентификатор пользователя;
    - expires_minutes — срок жизни токена в минутах;
    - token_type — тип токена, например "access" или "refresh".

    В payload добавляются:
    - sub — субъект токена;
    - exp — время истечения срока действия;
    - type — тип токена (bearer).
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": subject,
        "exp": expire,
        "type": token_type,
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_access_token(subject: str) -> str:
    """
    Создаёт access-токен.

    Access-токен обычно живёт недолго и используется
    для доступа к защищённым endpoint.
    """
    return create_token(
        subject=subject,
        expires_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        token_type="access",
    )


def create_refresh_token(subject: str) -> str:
    """
    Создаёт refresh-токен.

    Refresh-токен живёт дольше, чем access-токен,
    и нужен для получения новой пары токенов
    без повторного ввода логина и пароля.
    """
    return create_token(
        subject=subject,
        expires_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES,
        token_type="refresh",
    )


def decode_token(token: str) -> dict:
    """
    Декодирует JWT-токен и возвращает его payload.

    Если токен повреждён, подписан неверно или истёк,
    библиотека python-jose выбросит JWTError.

    В таком случае мы преобразуем её в ValueError,
    чтобы верхний уровень приложения мог обрабатывать ошибку
    в более общем виде.
    """
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc