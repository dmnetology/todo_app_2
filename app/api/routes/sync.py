# app/api/routes/sync.py

import json

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.services.sync_service import export_json, import_json, export_csv, import_csv

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.get("/export/json")
def export_json_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Экспортирует данные пользователя в JSON-формате.

    Включает в себя задачи и категории.

    Args:
        db: Активная сессия базы данных.
        user: Текущий авторизованный пользователь.

    Returns:
        JSON-структура с данными для экспорта.
    """
    return export_json(db, user)


@router.post("/import/json")
async def import_json_route(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Импортирует данные пользователя из JSON-файла.

    Файл сначала читается и парсится как JSON, затем передаётся
    в сервисный слой для валидации и записи в базу данных.

    Обработка ошибок разделена на два этапа:
    - ошибка чтения/парсинга файла -> 400 Bad Request;
    - ошибка валидации данных -> 422 Unprocessable Entity.

    Args:
        file: Загружаемый JSON-файл.
        db: Активная сессия базы данных.
        user: Текущий авторизованный пользователь.

    Returns:
        Результат импорта.
    """
    try:
        content = await file.read()
        payload = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file",
        )

    try:
        result = import_json(db, user, payload)
        return result
    except ValueError as exc:
        detail = exc.args[0] if exc.args else str(exc)

        if isinstance(detail, dict):
            # Приводим ошибки в JSON-safe вид,
            # чтобы FastAPI/JSONResponse не упали на tuple, datetime и т.п.
            errors = detail.get("errors", [])
            safe_errors = []

            for err in errors:
                if isinstance(err, dict):
                    safe_err = dict(err)

                    if "loc" in safe_err and isinstance(safe_err["loc"], tuple):
                        safe_err["loc"] = list(safe_err["loc"])

                    if "ctx" in safe_err and isinstance(safe_err["ctx"], dict):
                        safe_err["ctx"] = {k: str(v) for k, v in safe_err["ctx"].items()}

                    safe_errors.append(safe_err)
                else:
                    safe_errors.append({"msg": str(err)})

            raise HTTPException(
                status_code=422,
                detail={
                    "message": detail.get("message", "JSON содержит ошибки валидации"),
                    "errors": safe_errors,
                },
            ) from exc

        raise HTTPException(
            status_code=422,
            detail={
                "message": str(detail),
                "errors": [],
            },
        ) from exc


@router.get("/export/csv")
def export_csv_route(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Экспортирует данные пользователя в CSV-формате.

    Возвращаются две отдельные CSV-строки:
    - categories_csv для категорий;
    - tasks_csv для задач.

    Args:
        db: Активная сессия базы данных.
        user: Текущий авторизованный пользователь.

    Returns:
        Словарь с CSV-строками для категорий и задач.
    """
    categories_csv, tasks_csv = export_csv(db, user)
    return {
        "categories_csv": categories_csv,
        "tasks_csv": tasks_csv,
    }


@router.post("/import/csv")
async def import_csv_route(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Импортирует данные пользователя из CSV-файла.

    Ожидается строковое содержимое CSV.

    Args:
        file: Загружаемый CSV-файл.
        db: Активная сессия базы данных.
        user: Текущий авторизованный пользователь.

    Returns:
        Результат импорта.
    """
    try:
        tasks_csv = (await file.read()).decode("utf-8")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid CSV files",
        )

    result = import_csv(db, user, tasks_csv)
    return result