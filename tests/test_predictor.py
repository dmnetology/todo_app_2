from types import SimpleNamespace

from app.ml.predictor import predict_task_duration
import pandas as pd


def test_predict_task_duration_fallback_without_active_model(monkeypatch):
    """
    Тест fallback-ветки, когда активной ML-модели нет.
    """
    called = {}

    def fake_get_active_ml_model_record(db, user_id):
        return None

    def fake_fallback_predict_task_duration(**kwargs):
        called["fallback"] = kwargs
        return 42

    monkeypatch.setattr("app.ml.predictor.get_active_ml_model_record", fake_get_active_ml_model_record)
    monkeypatch.setattr("app.ml.predictor.fallback_predict_task_duration", fake_fallback_predict_task_duration)

    result = predict_task_duration(
        db=object(),
        user_id=1,
        title="  My   Task  ",
        category_id=5,
        priority="high",
        planned_weekday=1,
        planned_hour=10,
    )

    assert result.duration_minutes == 42
    assert result.source == "fallback"
    assert result.model_type is None
    assert result.model_id is None
    assert "fallback" in called


def test_predict_task_duration_ml_success(monkeypatch):
    """
    Тест успешного предсказания через ML-модель.
    """
    class FakeMLRecord:
        id = 10
        model_type = "random_forest_regressor"

    class FakeModel:
        def __init__(self):
            self.received_features = None

        def predict(self, X):
            self.received_features = X
            return [12.7]

    fake_model = FakeModel()

    def fake_get_active_ml_model_record(db, user_id):
        return FakeMLRecord()

    def fake_load_model_artifacts(user_id):
        return fake_model, {"mae": 18}

    monkeypatch.setattr("app.ml.predictor.get_active_ml_model_record", fake_get_active_ml_model_record)
    monkeypatch.setattr("app.ml.predictor.load_model_artifacts", fake_load_model_artifacts)

    result = predict_task_duration(
        db=object(),
        user_id=1,
        title="  My   Task  ",
        category_id=5,
        priority="high",
        planned_weekday=2,
        planned_hour=14,
    )

    assert result.source == "ml"
    assert result.duration_minutes == 13
    assert result.model_type == "random_forest_regressor"
    assert result.model_id == 10
    assert result.metadata == {"mae": 18}
    assert result.confidence == 0.9

    expected_df = pd.DataFrame(
        [{
            "title": "my task",
            "category_id": 5,
            "priority": "high",
            "planned_weekday": 2,
            "planned_hour": 14,
        }]
    )

    pd.testing.assert_frame_equal(fake_model.received_features, expected_df)


def test_predict_task_duration_ml_duration_minimum(monkeypatch):
    """
    Тест защиты от слишком маленького предсказания.
    Если модель вернула меньше 1, должно стать 1.
    """
    class FakeMLRecord:
        id = 11
        model_type = "random_forest_regressor"

    class FakeModel:
        def predict(self, X):
            return [0.2]

    monkeypatch.setattr("app.ml.predictor.get_active_ml_model_record", lambda db, user_id: FakeMLRecord())
    monkeypatch.setattr("app.ml.predictor.load_model_artifacts", lambda user_id: (FakeModel(), {"mae": 10}))

    result = predict_task_duration(
        db=object(),
        user_id=1,
        title="Task",
        category_id=None,
        priority="low",
    )

    assert result.source == "ml"
    assert result.duration_minutes == 1


def test_predict_task_duration_fallback_on_exception(monkeypatch):
    """
    Тест fallback-ветки, если при работе ML-модели произошла ошибка.
    """
    class FakeMLRecord:
        id = 99
        model_type = "random_forest_regressor"

    def fake_get_active_ml_model_record(db, user_id):
        return FakeMLRecord()

    def fake_load_model_artifacts(user_id):
        raise RuntimeError("broken model")

    def fake_fallback_predict_task_duration(**kwargs):
        return 55

    monkeypatch.setattr("app.ml.predictor.get_active_ml_model_record", fake_get_active_ml_model_record)
    monkeypatch.setattr("app.ml.predictor.load_model_artifacts", fake_load_model_artifacts)
    monkeypatch.setattr("app.ml.predictor.fallback_predict_task_duration", fake_fallback_predict_task_duration)

    result = predict_task_duration(
        db=object(),
        user_id=1,
        title="Task",
        category_id=2,
        priority="medium",
    )

    assert result.duration_minutes == 55
    assert result.source == "fallback"
    assert result.model_type == "random_forest_regressor"
    assert result.model_id == 99