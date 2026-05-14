from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate


router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post(
    "",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Создаёт категорию задач для текущего пользователя.

    Перед созданием проверяется, нет ли уже категории
    с таким же названием у этого пользователя.
    """
    existing_category = db.query(Category).filter(
        Category.name == data.name,
        Category.user_id == current_user.id,
    ).first()

    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists",
        )

    category = Category(name=data.name, user_id=current_user.id)

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.get("", response_model=list[CategoryRead])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Возвращает список категорий текущего пользователя.
    """
    return db.query(Category).filter(
        Category.user_id == current_user.id,
    ).all()


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновляет категорию текущего пользователя.

    Категория ищется только среди записей владельца.
    Если категория не найдена, возвращается 404.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    category.name = data.name

    db.commit()
    db.refresh(category)

    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Удаляет категорию текущего пользователя.

    Если категория не найдена, возвращает 404.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id,
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    db.delete(category)
    db.commit()