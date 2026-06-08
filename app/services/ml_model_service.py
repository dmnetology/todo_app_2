from sqlalchemy.orm import Session

from app.models.ml_model import MLModel
from app.schemas.ml import MLModelInfoResponse


def get_active_ml_model(db: Session, user_id: int) -> MLModel | None:
    return (
        db.query(MLModel)
        .filter(
            MLModel.user_id == user_id,
            MLModel.is_active.is_(True),
        )
        .order_by(MLModel.trained_at.desc())
        .first()
    )

def get_active_model_info(db: Session, user_id: int) -> MLModelInfoResponse:
    model = get_active_ml_model(db, user_id)
    """
    Возвращает информацию об активной ML-модели пользователя.

    Логика:
    - ищем активную модель пользователя;
    - если модель есть, отдаём её метаданные;
    - если модели нет, возвращаем fallback-сообщение.
    """

    if not model:
        return MLModelInfoResponse(
            source="fallback",
            message="Для прогнозов используется fallback по медиане",
            summary="ML-модель не найдена",
        )

    return MLModelInfoResponse(
        source="ml",
        model_type=model.model_type,
        model_id=model.id,
        trained_at=model.trained_at,
        mae=model.mae,
        fallback_mae=model.fallback_mae,
        trained_on_count=model.trained_on_count,
        accepted=model.accepted,
        is_active=model.is_active,
        message="Активна ML-модель для прогнозов",
        summary=f"Модель {model.model_type} обучена на {model.trained_on_count} задачах",
    )