from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    Token,
    LoginRequest,
    ChangePasswordRequest,
    RefreshTokenRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import (
    register_user,
    authenticate_user,
    create_auth_tokens,
    change_password,
    refresh_access_token,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """
    Регистрирует нового пользователя.

    Принимает данные пользователя, создаёт запись в базе
    и возвращает информацию о созданном пользователе
    в формате UserRead.
    """
    return register_user(db, data)


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Аутентифицирует пользователя и возвращает JWT-токены.

    Проверяет логин и пароль, а затем создаёт:
    - access_token;
    - refresh_token;
    - token_type.
    """
    user = authenticate_user(db, data.login, data.password)
    return create_auth_tokens(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_user_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Меняет пароль текущего пользователя.

    Эндпоинт защищён, поэтому доступен только
    авторизованному пользователю с валидным access-токеном.
    """
    change_password(
        db=db,
        user=current_user,
        old_password=data.old_password,
        new_password=data.new_password,
    )


@router.post("/refresh", response_model=Token)
def refresh_token(data: RefreshTokenRequest):
    """
    Обновляет access-токен по refresh-токену.

    Принимает refresh_token и возвращает новую пару токенов
    или, в данной реализации, новый access_token и тот же refresh_token.
    """
    return refresh_access_token(data.refresh_token)