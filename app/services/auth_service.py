# app/services/auth_service.py

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, data: UserCreate) -> User:
    """
    Регистрирует нового пользователя.

    Проверяет, существует ли уже пользователь с таким login.
    Если логин занят, возвращает ошибку 409 Conflict.

    Если пользователь новый:
    - создаёт объект User;
    - хэширует пароль;
    - сохраняет пользователя в базе данных;
    - возвращает созданную запись.
    """
    existing_user = db.query(User).filter(User.login == data.login).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this login already exists",
        )

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        login=data.login,
        hashed_password=get_password_hash(data.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, login: str, password: str) -> User:
    """
    Проверяет логин и пароль пользователя.

    Используется при входе в систему.
    Если логин или пароль неверны, выбрасывает HTTP 401 Unauthorized.
    """
    user = db.query(User).filter(User.login == login).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
        )

    return user


def create_auth_tokens(user: User) -> dict:
    """
    Создаёт пару JWT-токенов для пользователя.

    Возвращает словарь с:
    - access_token;
    - refresh_token;
    - token_type.
    """
    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
    }


def change_password(
    db: Session,
    user: User,
    old_password: str,
    new_password: str,
) -> None:
    """
    Меняет пароль текущего пользователя.

    Сначала проверяется старый пароль.
    Если он неверный, возвращается HTTP 400 Bad Request.

    После успешной проверки:
    - новый пароль хэшируется;
    - значение hashed_password обновляется в базе.
    """
    if not verify_password(old_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect",
        )

    user.hashed_password = get_password_hash(new_password)
    db.commit()


def refresh_access_token(refresh_token: str) -> dict:
    """
    Обновляет access-токен по refresh-токену.

    Проверяет:
    - валидность JWT;
    - тип токена;
    - наличие корректного subject.

    Если refresh-токен невалидный, возвращает HTTP 401 Unauthorized.
    """
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")

    return {
        "access_token": create_access_token(str(user_id)),
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }