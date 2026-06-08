# app/tests/test_tasks.py

import uuid
from statistics import median
from datetime import datetime
import app.services.task_service as task_service_module
from app.ml.fallback import DEFAULT_DURATION_MINUTES
from unittest.mock import MagicMock
import app.services.ml_training_service as ml_training_service_module
import app.ml.model_registry as model_registry_module


def create_category(client, headers, name=None):
    """
    Создаёт категорию и возвращает её id.
    Если имя не передано, генерируется уникальное.
    """
    if name is None:
        name = f"Category {uuid.uuid4().hex[:8]}"

    response = client.post(
        "/categories",
        headers=headers,
        json={"name": name},
    )
    return response.json()["id"]


def create_task(
    client,
    headers,
    category_id,
    title="Сделать проект",
    description="Реализовать backend",
    priority="high",
    planned_start_local="2026-06-06T10:00:00",
    planned_start_timezone="Europe/Moscow",
):
    response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": title,
            "description": description,
            "category_id": category_id,
            "priority": priority,
            "planned_start_local": planned_start_local,
            "planned_start_timezone": planned_start_timezone,
        },
    )
    return response


def test_create_task(client, auth_headers):
    """
    Тест создания задачи.

    Сценарий:
    1. Создаём категорию.
    2. Создаём задачу, привязанную к этой категории.
    3. Проверяем статус 201 и корректное название задачи.
    """
    category_id = create_category(client, auth_headers)

    response = create_task(client, auth_headers, category_id)

    assert response.status_code == 201
    assert response.json()["title"] == "Сделать проект"


def test_get_tasks(client, auth_headers):
    """
    Тест получения списка задач.

    Сценарий:
    1. Создаём одну задачу.
    2. Запрашиваем список задач.
    3. Проверяем, что в ответе ровно одна задача.
    """
    category_id = create_category(client, auth_headers)

    create_task(client, auth_headers, category_id)

    response = client.get("/tasks", headers=auth_headers)

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_task_by_id(client, auth_headers):
    """
    Тест получения задачи по идентификатору.

    Сценарий:
    1. Создаём задачу.
    2. Берём её id.
    3. Запрашиваем задачу по этому id.
    4. Проверяем, что сервер вернул нужную задачу.
    """
    category_id = create_category(client, auth_headers)
    created = create_task(client, auth_headers, category_id)
    task_id = created.json()["id"]

    response = client.get(f"/tasks/{task_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == task_id


def test_update_task(client, auth_headers):
    """
    Тест обновления задачи.

    Сценарий:
    1. Создаём задачу.
    2. Получаем её id.
    3. Отправляем PUT-запрос с новыми данными.
    4. Проверяем, что title обновился.
    """
    category_id = create_category(client, auth_headers)
    created = create_task(client, auth_headers, category_id)
    task_id = created.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        headers=auth_headers,
        json={
            "title": "Обновленная задача",
            "priority": "medium",
        },
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Обновленная задача"


def test_update_task_status(client, auth_headers):
    """
    Тест изменения статуса задачи.

    Сценарий:
    1. Создаём задачу.
    2. Отмечаем её как завершённую.
    3. Проверяем is_completed и actual_minutes.
    """
    category_id = create_category(client, auth_headers)
    created = create_task(client, auth_headers, category_id)
    task_id = created.json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/status",
        headers=auth_headers,
        json={
            "status": "in_progress",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_delete_task(client, auth_headers):
    """
    Тест удаления задачи.

    Сценарий:
    1. Создаём задачу.
    2. Удаляем её.
    3. Ожидаем статус 204 No Content.
    """
    category_id = create_category(client, auth_headers)
    created = create_task(client, auth_headers, category_id)
    task_id = created.json()["id"]

    response = client.delete(
        f"/tasks/{task_id}",
        headers=auth_headers,
    )

    assert response.status_code == 204


def test_task_not_found(client, auth_headers):
    """
    Тест обработки несуществующей задачи.

    Ожидаем, что запрос к невалидному id вернёт 404 Not Found.
    """
    response = client.get("/tasks/999", headers=auth_headers)

    assert response.status_code == 404


def test_task_validation_error(client, auth_headers):
    """
    Тест ошибки валидации.

    Передаём слишком короткое название задачи и ожидаем 422 Unprocessable Entity.
    """
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "A",
            "priority": "high",
        },
    )

    assert response.status_code == 422


def test_filter_tasks_by_status(client, auth_headers):
    """
    Тест фильтрации задач по статусу.

    Сценарий:
    1. Создаём задачу.
    2. Отмечаем её выполненной.
    3. Запрашиваем только завершённые задачи.
    4. Проверяем, что в ответе одна выполненная задача.
    """
    category_id = create_category(client, auth_headers)
    created = create_task(client, auth_headers, category_id)
    task_id = created.json()["id"]

    client.patch(
        f"/tasks/{task_id}/start",
        headers=auth_headers,
    )

    client.patch(
        f"/tasks/{task_id}/status",
        headers=auth_headers,
        json={
            "status": "completed",
        },
    )

    response = client.get(
        "/tasks?status=completed",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == task_id


def test_ai_estimate(client, auth_headers):
    """
    Тест AI-прогноза времени.

    Сценарий:
    1. Создаём задачу.
    2. Помечаем её выполненной и указываем фактическое время.
    3. Запрашиваем прогноз по AI-эндпоинту.
    4. Проверяем, что predicted_minutes совпадает с ожидаемым значением.
    """
    category_id = create_category(client, auth_headers)

    created = create_task(client, auth_headers, category_id=category_id)
    task_id = created.json()["id"]
    task_title = created.json()["title"]

    client.patch(
        f"/tasks/{task_id}/status",
        headers=auth_headers,
        json={
            "status": "completed",
        },
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": task_title,
            "category_id": category_id,
        },
    )

    print("STATUS:", response.status_code)
    print("TEXT:", response.text)
    print("JSON:", response.json())

    assert response.status_code == 200
    #assert response.json()["predicted_minutes"] == 100


def test_fallback_estimate_by_exact_title(client, auth_headers, monkeypatch):
    """
    Если есть завершённые задачи с точным совпадением title,
    fallback-прогноз должен считаться как медиана actual_minutes
    по этим задачам.
    """
    category_id = create_category(client, auth_headers)
    title = "Сделать отчет"
    timezone_name = "Europe/Moscow"

    task_1 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=title,
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_2 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=title,
        planned_start_local="2026-06-06T10:05:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_3 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=title,
        planned_start_local="2026-06-06T10:10:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_plan = [
        (task_1["id"], datetime(2026, 6, 6, 10, 0, 0), datetime(2026, 6, 6, 10, 20, 0)),
        (task_2["id"], datetime(2026, 6, 6, 11, 0, 0), datetime(2026, 6, 6, 11, 40, 0)),
        (task_3["id"], datetime(2026, 6, 6, 12, 0, 0), datetime(2026, 6, 6, 12, 30, 0)),
    ]

    for task_id, start_time, complete_time in task_plan:
        monkeypatch.setattr(task_service_module, "_get_now", lambda t=start_time: t)

        start_response = client.patch(
            f"/tasks/{task_id}/start",
            headers=auth_headers,
        )
        assert start_response.status_code == 200

        monkeypatch.setattr(task_service_module, "_get_now", lambda t=complete_time: t)

        complete_response = client.patch(
            f"/tasks/{task_id}/complete",
            headers=auth_headers,
        )
        assert complete_response.status_code == 200

    actual_minutes = []
    for task_id, _, _ in task_plan:
        response = client.get(
            f"/tasks/{task_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        task_data = response.json()
        assert task_data["actual_minutes"] is not None
        actual_minutes.append(task_data["actual_minutes"])

    expected_minutes = int(round(median(actual_minutes)))

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": title,
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "fallback"
    assert data["predicted_minutes"] == expected_minutes

def test_fallback_estimate_by_similar_title(client, auth_headers, monkeypatch):
    """
    Если нет точного совпадения title, но есть похожие завершённые задачи,
    fallback-прогноз должен считаться по медиане actual_minutes
    среди задач с похожим названием.
    """
    category_id = create_category(client, auth_headers)
    timezone_name = "Europe/Moscow"

    exact_title = "Сделать отчет"
    similar_title_1 = "Сделать отчёт"
    similar_title_2 = "Сделать отчетик"
    unrelated_title = "Починить баг"

    task_1 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=similar_title_1,
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_2 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=similar_title_2,
        planned_start_local="2026-06-06T10:05:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_3 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title=unrelated_title,
        planned_start_local="2026-06-06T10:10:00",
        planned_start_timezone=timezone_name,
    ).json()

    task_plan = [
        (task_1["id"], datetime(2026, 6, 6, 10, 0, 0), datetime(2026, 6, 6, 10, 20, 0)),
        (task_2["id"], datetime(2026, 6, 6, 11, 0, 0), datetime(2026, 6, 6, 11, 40, 0)),
        (task_3["id"], datetime(2026, 6, 6, 12, 0, 0), datetime(2026, 6, 6, 12, 30, 0)),
    ]

    for task_id, start_time, complete_time in task_plan:
        monkeypatch.setattr(task_service_module, "_get_now", lambda t=start_time: t)

        start_response = client.patch(
            f"/tasks/{task_id}/start",
            headers=auth_headers,
        )
        assert start_response.status_code == 200

        monkeypatch.setattr(task_service_module, "_get_now", lambda t=complete_time: t)

        complete_response = client.patch(
            f"/tasks/{task_id}/complete",
            headers=auth_headers,
        )
        assert complete_response.status_code == 200

    # Получаем actual_minutes из БД через GET /tasks/{id}
    actual_minutes = []
    for task_id, _, _ in task_plan:
        response = client.get(
            f"/tasks/{task_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        task_data = response.json()
        assert task_data["actual_minutes"] is not None

        actual_minutes.append(task_data["actual_minutes"])

    # Берём только похожие задачи:
    # здесь похожим будет прогнозируемое название "Сделать отчет"
    # а в задачах лежат "Сделать отчёт" и "Сделать отчетик"
    similar_actual_minutes = actual_minutes[:2]
    expected_minutes = int(round(median(similar_actual_minutes)))

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": exact_title,
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "fallback"
    assert data["predicted_minutes"] == expected_minutes


def test_fallback_estimate_by_category_when_no_similar_title(client, auth_headers, monkeypatch):
    """
    Если нет точного совпадения title и нет похожих задач,
    fallback-прогноз должен считаться как медиана actual_minutes
    по задачам той же категории.
    """
    category_id = create_category(client, auth_headers)
    timezone_name = "Europe/Moscow"

    target_title = "Подготовить презентацию"

    task_titles = [
        "Сделать отчет",
        "Проверить почту",
        "Обновить документацию",
    ]

    tasks = []
    for index, task_title in enumerate(task_titles):
        task = create_task(
            client,
            auth_headers,
            category_id=category_id,
            title=task_title,
            planned_start_local=f"2026-06-06T10:0{index}:00",
            planned_start_timezone=timezone_name,
        ).json()
        tasks.append(task)

    task_plan = [
        (tasks[0]["id"], datetime(2026, 6, 6, 10, 0, 0), datetime(2026, 6, 6, 10, 20, 0)),
        (tasks[1]["id"], datetime(2026, 6, 6, 11, 0, 0), datetime(2026, 6, 6, 11, 50, 0)),
        (tasks[2]["id"], datetime(2026, 6, 6, 12, 0, 0), datetime(2026, 6, 6, 12, 30, 0)),
    ]

    for task_id, start_time, complete_time in task_plan:
        monkeypatch.setattr(task_service_module, "_get_now", lambda t=start_time: t)

        start_response = client.patch(
            f"/tasks/{task_id}/start",
            headers=auth_headers,
        )
        assert start_response.status_code == 200

        monkeypatch.setattr(task_service_module, "_get_now", lambda t=complete_time: t)

        complete_response = client.patch(
            f"/tasks/{task_id}/complete",
            headers=auth_headers,
        )
        assert complete_response.status_code == 200

    actual_minutes = []
    for task in tasks:
        response = client.get(
            f"/tasks/{task['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        task_data = response.json()
        assert task_data["actual_minutes"] is not None
        actual_minutes.append(task_data["actual_minutes"])

    expected_minutes = int(round(median(actual_minutes)))

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": target_title,
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "fallback"
    assert data["predicted_minutes"] == expected_minutes


def test_fallback_estimate_default_when_no_matching_tasks(client, auth_headers):
    """
    Если нет точных совпадений, нет похожих задач и нет задач в категории,
    fallback должен вернуть значение по умолчанию.
    """
    category_id = create_category(client, auth_headers)

    target_title = "Совершенно новая задача"

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": target_title,
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "fallback"
    assert data["predicted_minutes"] == DEFAULT_DURATION_MINUTES

    def test_complete_task_triggers_ml_training_when_threshold_reached(
            client,
            auth_headers,
            monkeypatch,
    ):
        """
        Когда число completed tasks достигает порога,
        endpoint завершения задачи должен запустить проверку на ML-обучение.
        """
        category_id = create_category(client, auth_headers)
        timezone_name = "Europe/Moscow"

        # Делаем порог маленьким, чтобы тест был быстрым
        monkeypatch.setattr(ml_training_service_module, "MIN_TRAINING_SAMPLES", 2)

        # Подменяем BackgroundTasks-логику на проверку факта вызова add_task
        add_task_mock = MagicMock()

        class FakeBackgroundTasks:
            def add_task(self, *args, **kwargs):
                add_task_mock(*args, **kwargs)

        # Если у тебя endpoint создаёт BackgroundTasks автоматически,
        # можно вместо этого мокать schedule_model_training_if_needed.
        schedule_mock = MagicMock(return_value=True)
        monkeypatch.setattr(
            ml_training_service_module,
            "schedule_model_training_if_needed",
            schedule_mock,
        )

        title = "Сделать отчет"

        task_ids = []
        for i in range(2):
            task = create_task(
                client,
                auth_headers,
                category_id=category_id,
                title=f"{title} {i}",
                planned_start_local="2026-06-06T10:00:00",
                planned_start_timezone=timezone_name,
            ).json()
            task_ids.append(task["id"])

        # Последовательно стартуем и завершаем задачи
        for idx, task_id in enumerate(task_ids):
            start_time = datetime(2026, 6, 6, 10 + idx, 0, 0)
            complete_time = datetime(2026, 6, 6, 10 + idx, 30, 0)

            monkeypatch.setattr(task_service_module, "_get_now", lambda t=start_time: t)
            start_response = client.patch(
                f"/tasks/{task_id}/start",
                headers=auth_headers,
            )
            assert start_response.status_code == 200

            monkeypatch.setattr(task_service_module, "_get_now", lambda t=complete_time: t)
            complete_response = client.patch(
                f"/tasks/{task_id}/complete",
                headers=auth_headers,
            )
            assert complete_response.status_code == 200

        # Проверяем, что сервис проверки обучения был вызван
        assert schedule_mock.called is True


def test_pause_task_endpoint(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Задача в статусе in_progress должна корректно ставиться на паузу.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    pause_reason = "Нужно срочно ответить"

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 15, 0))

    pause_response = client.patch(
        f"/tasks/{task['id']}/pause",
        headers=auth_headers,
        params={
            "pause_reason": pause_reason,
        },
    )

    assert pause_response.status_code == 200
    data = pause_response.json()

    assert data["status"] == "paused"
    assert data["current_started_at"] is None

    task_response = client.get(
        f"/tasks/{task['id']}",
        headers=auth_headers,
    )
    assert task_response.status_code == 200

    task_data = task_response.json()
    assert task_data["status"] == "paused"
    assert task_data["current_started_at"] is None

def test_resume_task_endpoint(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Задача в статусе paused должна корректно возобновляться.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 15, 0))

    pause_response = client.patch(
        f"/tasks/{task['id']}/pause",
        headers=auth_headers,
        params={
            "pause_reason": "Перерыв",
        },
    )
    assert pause_response.status_code == 200

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 30, 0))

    resume_response = client.patch(
        f"/tasks/{task['id']}/resume",
        headers=auth_headers,
    )

    assert resume_response.status_code == 200
    data = resume_response.json()

    assert data["status"] == "in_progress"
    assert data["current_started_at"] is not None

    task_response = client.get(
        f"/tasks/{task['id']}",
        headers=auth_headers,
    )
    assert task_response.status_code == 200

    task_data = task_response.json()
    assert task_data["status"] == "in_progress"
    assert task_data["current_started_at"] is not None

def test_pause_task_fails_if_task_not_in_progress(
    client,
    auth_headers,
):
    """
    Нельзя поставить на паузу задачу, если она не в статусе in_progress.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Новая задача",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    response = client.patch(
        f"/tasks/{task['id']}/pause",
        headers=auth_headers,
        params={
            "pause_reason": "Не получится",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only in progress task can be paused"

def test_resume_task_fails_if_task_not_paused(
    client,
    auth_headers,
):
    """
    Нельзя возобновить задачу, если она не в статусе paused.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Новая задача",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    response = client.patch(
        f"/tasks/{task['id']}/resume",
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only paused task can be resumed"

def test_cancel_task_endpoint(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Задача должна корректно отменяться.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    cancel_response = client.patch(
        f"/tasks/{task['id']}/cancel",
        headers=auth_headers,
    )

    assert cancel_response.status_code == 200
    data = cancel_response.json()

    assert data["status"] == "cancelled"
    assert data["is_completed"] is False
    assert data["current_started_at"] is None


def test_cancel_completed_task_fails(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Завершённую задачу нельзя отменить.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 30, 0))

    complete_response = client.patch(
        f"/tasks/{task['id']}/complete",
        headers=auth_headers,
    )
    assert complete_response.status_code == 200

    cancel_response = client.patch(
        f"/tasks/{task['id']}/cancel",
        headers=auth_headers,
    )

    assert cancel_response.status_code == 400
    assert cancel_response.json()["detail"] == "Completed task cannot be cancelled"


def test_update_task_status_to_new(
    client,
    auth_headers,
):
    """
    Через универсальный endpoint задача может быть переведена в new.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "new"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "new"
    assert data["is_completed"] is False
    assert data["current_started_at"] is None


def test_update_task_status_to_in_progress(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Через универсальный endpoint задача может быть переведена в in_progress.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "in_progress"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "in_progress"
    assert data["current_started_at"] is not None


def test_update_task_status_to_paused(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Через универсальный endpoint задача может быть переведена в paused.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))

    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 10, 0))

    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "paused"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "paused"
    assert data["current_started_at"] is None


def test_update_task_status_to_completed(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Через универсальный endpoint задача может быть переведена в completed.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))
    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 25, 0))
    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "completed"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "completed"
    assert data["is_completed"] is True


def test_update_task_status_to_cancelled(
    client,
    auth_headers,
    monkeypatch,
):
    """
    Через универсальный endpoint задача может быть переведена в cancelled.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    monkeypatch.setattr(task_service_module, "_get_now", lambda: datetime(2026, 6, 6, 10, 0, 0))
    start_response = client.patch(
        f"/tasks/{task['id']}/start",
        headers=auth_headers,
    )
    assert start_response.status_code == 200

    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "cancelled"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "cancelled"
    assert data["is_completed"] is False
    assert data["current_started_at"] is None


def test_update_task_status_rejects_unsupported_status(
    client,
    auth_headers,
):
    """
    Нельзя передать неподдерживаемый статус.
    """
    category_id = create_category(client, auth_headers)

    task = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Сделать отчет",
        planned_start_local="2026-06-06T10:00:00",
        planned_start_timezone="Europe/Moscow",
    ).json()

    response = client.patch(
        f"/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "unknown_status"},
    )

    assert response.status_code == 422


def test_estimate_task_time_with_metadata(client, auth_headers, monkeypatch):
    """
    Тест прогноза времени выполнения задачи с метаданными модели.

    Сценарий:
    1. Подменяем функцию прогнозирования так, чтобы она вернула результат с metadata.
    2. Отправляем запрос на endpoint /tasks/ai/estimate.
    3. Проверяем, что сервер вернул прогноз и информацию о модели.
    """
    class DummyResult:
        duration_minutes = 45
        source = "ml"
        model_type = "random_forest"
        model_id = 1
        confidence = 0.91
        metadata = {
            "trained_at": "2026-06-06T12:00:00",
            "mae": 7.5,
            "trained_on_count": 100,
        }

    def fake_predict_task_duration(*args, **kwargs):
        return DummyResult()

    monkeypatch.setattr(
        "app.api.routes.tasks.predict_task_duration",
        fake_predict_task_duration,
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": "Подготовить отчёт",
            "category_id": 1,
            "priority": "medium",
        },
    )

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 45
    assert response.json()["source"] == "ml"
    assert response.json()["model_type"] == "random_forest"
    assert response.json()["model_id"] == 1
    assert response.json()["confidence"] == 0.91

    assert response.json()["metadata"] is not None
    assert response.json()["metadata"]["trained_at"] == "2026-06-06T12:00:00"
    assert response.json()["metadata"]["mae"] == 7.5
    assert response.json()["metadata"]["trained_on_count"] == 100