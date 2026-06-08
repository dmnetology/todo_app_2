import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db_session, monkeypatch):
    """
    Подменяем get_db и отключаем ML-фоновые вызовы,
    чтобы тесты были быстрыми и стабильными.
    """

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Если в коде есть фоновый ML-старт, глушим его.
    try:
        import app.api.routes.tasks as tasks_routes
        monkeypatch.setattr(
            tasks_routes,
            "schedule_model_training_if_needed",
            lambda *args, **kwargs: None,
            raising=False,
        )
    except Exception:
        pass

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    client.post(
        "/auth/register",
        json={
            "first_name": "Ivan",
            "last_name": "Ivanov",
            "login": "ivan@mail.ru",
            "password": "password123",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "login": "ivan@mail.ru",
            "password": "password123",
        },
    )


    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}