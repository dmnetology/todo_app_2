import pytest
from types import SimpleNamespace

from app.ml.training import (
    build_training_dataset,
    build_pipeline,
    train_duration_model_for_user,
)

from app.services import ml_training_service as service


def make_task(
    *,
    actual_minutes=30,
    title="Task",
    category_id=1,
    priority="medium",
    planned_start_local=None,
    owner_id=1,
    is_completed=True,
):
    return SimpleNamespace(
        actual_minutes=actual_minutes,
        title=title,
        category_id=category_id,
        priority=priority,
        planned_start_local=planned_start_local,
        owner_id=owner_id,
        is_completed=is_completed,
    )


def test_build_training_dataset():
    """
    Тест формирования обучающего датасета.
    """
    tasks = [
        make_task(actual_minutes=30, title="Task 1", category_id=1, priority="medium"),
        make_task(actual_minutes=None, title="Task 2", category_id=1, priority="medium"),
        make_task(actual_minutes=0, title="Task 3", category_id=1, priority="medium"),
        make_task(actual_minutes=15, title="Task 4", category_id=2, priority="high"),
    ]

    X, y = build_training_dataset(tasks)

    assert len(X) == 2
    assert len(y) == 2
    assert y == [30.0, 15.0]


def test_train_duration_model_not_enough_samples(monkeypatch):
    from app.ml.training import train_duration_model_for_user

    user_id = 1

    tasks = [
        make_task(
            actual_minutes=10,
            title=f"Task {i}",
            category_id=1,
            priority="medium",
            owner_id=user_id,
            is_completed=True,
        )
        for i in range(3)
    ]

    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return tasks

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return None

    class FakeDB:
        def query(self, model):
            return FakeQuery()

    with pytest.raises(ValueError):
        train_duration_model_for_user(FakeDB(), user_id)


def test_train_duration_model_accepted(monkeypatch):
    """
    Тест успешного обучения и принятия модели.
    """
    user_id = 1

    tasks = [
        make_task(
            actual_minutes=10,
            title=f"Task {i}",
            category_id=1,
            owner_id=user_id,
            is_completed=True,
            planned_start_local=None,
        )
        for i in range(50)
    ]

    class FakeQuery:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return tasks

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return None

    class FakeDB:
        def query(self, model):
            return FakeQuery(model)

        def add(self, obj):
            self.added = obj

        def commit(self):
            pass

        def refresh(self, obj):
            pass

    class FakePipeline:
        def fit(self, X, y):
            return self

        def predict(self, X):
            return [10 for _ in X]

    monkeypatch.setattr("app.ml.training.build_pipeline", lambda: FakePipeline())
    monkeypatch.setattr("app.ml.training.fallback_predict_task_duration", lambda **kwargs: 100)
    monkeypatch.setattr("app.ml.training.save_model_artifacts", lambda **kwargs: ("path/to/model.joblib", {}))
    monkeypatch.setattr("app.ml.training.deactivate_user_models", lambda db, user_id: None)

    db = FakeDB()
    result = train_duration_model_for_user(db, user_id)

    assert result.accepted is True
    assert result.is_active is True
    assert result.model_path == "path/to/model.joblib"


def test_train_duration_model_rejected(monkeypatch):
    """
    Тест случая, когда модель хуже fallback и не принимается.
    """
    user_id = 1

    tasks = [
        make_task(
            actual_minutes=10,
            title=f"Task {i}",
            category_id=1,
            owner_id=user_id,
            is_completed=True,
            planned_start_local=None,
        )
        for i in range(50)
    ]

    class FakeQuery:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def all(self):
            return tasks

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return None

    class FakeDB:
        def query(self, model):
            return FakeQuery(model)

        def add(self, obj):
            self.added = obj

        def commit(self):
            pass

        def refresh(self, obj):
            pass

    class FakePipeline:
        def fit(self, X, y):
            return self

        def predict(self, X):
            return [200 for _ in X]

    monkeypatch.setattr("app.ml.training.build_pipeline", lambda: FakePipeline())
    monkeypatch.setattr("app.ml.training.fallback_predict_task_duration", lambda **kwargs: 20)
    monkeypatch.setattr("app.ml.training.save_model_artifacts", lambda **kwargs: ("path/to/model.joblib", {}))
    monkeypatch.setattr("app.ml.training.deactivate_user_models", lambda db, user_id: None)

    db = FakeDB()
    result = train_duration_model_for_user(db, user_id)

    assert result.accepted is False
    assert result.is_active is False
    assert result.model_path == ""


def test_build_pipeline():
    """
    Тест создания pipeline для обучения модели.
    """
    pipeline = build_pipeline()

    assert "preprocessor" in pipeline.named_steps
    assert "model" in pipeline.named_steps


def make_task_count_query(count: int):
    class FakeQuery:
        def filter(self, *args, **kwargs):
            return self

        def count(self):
            return count

    return FakeQuery()


def make_model_query(model):
    class FakeQuery:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

        def first(self):
            return self.model

    return FakeQuery(model)


def test_get_completed_tasks_count():
    """
    Тест подсчёта завершённых задач, подходящих для ML.
    """
    class FakeDB:
        def query(self, model):
            return make_task_count_query(7)

    db = FakeDB()
    result = service.get_completed_tasks_count(db, user_id=1)

    assert result == 7


def test_get_active_ml_model():
    """
    Тест получения активной ML-модели пользователя.
    """
    fake_model = SimpleNamespace(id=10, trained_on_count=100, is_active=True)

    class FakeDB:
        def query(self, model):
            return make_model_query(fake_model)

    db = FakeDB()
    result = service.get_active_ml_model(db, user_id=1)

    assert result is fake_model


def test_should_train_or_retrain_model_without_active_model_not_enough_samples(monkeypatch):
    """
    Если активной модели нет и данных мало — обучение не нужно.
    """
    monkeypatch.setattr(service, "get_completed_tasks_count", lambda db, user_id: 49)
    monkeypatch.setattr(service, "get_active_ml_model", lambda db, user_id: None)

    result = service.should_train_or_retrain_model(db=object(), user_id=1)

    assert result is False


def test_should_train_or_retrain_model_without_active_model_enough_samples(monkeypatch):
    """
    Если активной модели нет и данных достаточно — обучение нужно.
    """
    monkeypatch.setattr(service, "get_completed_tasks_count", lambda db, user_id: 50)
    monkeypatch.setattr(service, "get_active_ml_model", lambda db, user_id: None)

    result = service.should_train_or_retrain_model(db=object(), user_id=1)

    assert result is True


def test_should_train_or_retrain_model_with_active_model_not_enough_new_data(monkeypatch):
    """
    Если активная модель есть, но новых задач мало — переобучение не нужно.
    """
    active_model = SimpleNamespace(trained_on_count=100)

    monkeypatch.setattr(service, "get_completed_tasks_count", lambda db, user_id: 180)
    monkeypatch.setattr(service, "get_active_ml_model", lambda db, user_id: active_model)

    result = service.should_train_or_retrain_model(db=object(), user_id=1)

    assert result is False


def test_should_train_or_retrain_model_with_active_model_enough_new_data(monkeypatch):
    """
    Если активная модель есть и новых задач достаточно — переобучение нужно.
    """
    active_model = SimpleNamespace(trained_on_count=100)

    monkeypatch.setattr(service, "get_completed_tasks_count", lambda db, user_id: 200)
    monkeypatch.setattr(service, "get_active_ml_model", lambda db, user_id: active_model)

    result = service.should_train_or_retrain_model(db=object(), user_id=1)

    assert result is True


def test_schedule_model_training_if_needed_false(monkeypatch):
    """
    Если обучение не нужно — background task не добавляется.
    """
    class FakeBackgroundTasks:
        def __init__(self):
            self.tasks = []

        def add_task(self, func, *args, **kwargs):
            self.tasks.append((func, args, kwargs))

    monkeypatch.setattr(service, "should_train_or_retrain_model", lambda db, user_id: False)

    background_tasks = FakeBackgroundTasks()
    result = service.schedule_model_training_if_needed(
        db=object(),
        user_id=1,
        background_tasks=background_tasks,
    )

    assert result is False
    assert background_tasks.tasks == []


def test_schedule_model_training_if_needed_true(monkeypatch):
    """
    Если обучение нужно — background task добавляется.
    """
    class FakeBackgroundTasks:
        def __init__(self):
            self.tasks = []

        def add_task(self, func, *args, **kwargs):
            self.tasks.append((func, args, kwargs))

    monkeypatch.setattr(service, "should_train_or_retrain_model", lambda db, user_id: True)

    background_tasks = FakeBackgroundTasks()
    result = service.schedule_model_training_if_needed(
        db=object(),
        user_id=1,
        background_tasks=background_tasks,
    )

    assert result is True
    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0][0] == service._run_training_job
    assert background_tasks.tasks[0][1] == (1,)


def test_run_training_job(monkeypatch):
    """
    Тест фоновой training-задачи.
    Проверяем, что:
    - создаётся сессия;
    - вызывается обучение;
    - сессия закрывается.
    """
    calls = {}

    class FakeDB:
        def close(self):
            calls["closed"] = True

    def fake_session_local():
        calls["session_created"] = True
        return FakeDB()

    def fake_train_duration_model_for_user(db, user_id):
        calls["trained"] = (db, user_id)

    monkeypatch.setattr(service, "SessionLocal", fake_session_local)
    monkeypatch.setattr(service, "train_duration_model_for_user", fake_train_duration_model_for_user)

    service._run_training_job(user_id=123)

    assert calls["session_created"] is True
    assert calls["trained"][1] == 123
    assert calls["closed"] is True