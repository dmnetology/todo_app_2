import uuid

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
    category_id=None,
    title="Сделать проект",
    description="Реализовать backend",
    priority="high",
    estimated_minutes=120,
):
    """
    Создаёт задачу и возвращает полный response.

    Параметр category_id необязательный:
    - если передан, задача будет привязана к категории;
    - если нет, задача создастся без категории.
    """
    response = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": title,
            "description": description,
            "category_id": category_id,
            "priority": priority,
            "estimated_minutes": estimated_minutes,
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
    create_task(client, auth_headers)

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
    created = create_task(client, auth_headers)
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
    created = create_task(client, auth_headers)
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
    created = create_task(client, auth_headers)
    task_id = created.json()["id"]

    response = client.patch(
        f"/tasks/{task_id}/status",
        headers=auth_headers,
        json={
            "is_completed": True,
            "actual_minutes": 90,
        },
    )

    assert response.status_code == 200
    assert response.json()["is_completed"] is True
    assert response.json()["actual_minutes"] == 90


def test_delete_task(client, auth_headers):
    """
    Тест удаления задачи.

    Сценарий:
    1. Создаём задачу.
    2. Удаляем её.
    3. Ожидаем статус 204 No Content.
    """
    created = create_task(client, auth_headers)
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
    created = create_task(client, auth_headers)
    task_id = created.json()["id"]

    client.patch(
        f"/tasks/{task_id}/status",
        headers=auth_headers,
        json={
            "is_completed": True,
            "actual_minutes": 80,
        },
    )

    response = client.get(
        "/tasks?is_completed=true",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["is_completed"] is True


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
            "is_completed": True,
            "actual_minutes": 100,
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

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 100


def test_ai_estimate_by_exact_title(client, auth_headers):
    """
    Если есть завершённые задачи с точным совпадением title,
    прогноз должен считаться по ним.
    """
    category_id = create_category(client, auth_headers)
    task_1 = create_task(client, auth_headers, category_id=category_id, title="Сделать отчет").json()
    task_2 = create_task(client, auth_headers, category_id=category_id, title="Сделать отчет").json()
    task_3 = create_task(client, auth_headers, category_id=category_id, title="Другая задача").json()

    client.patch(
        f"/tasks/{task_1['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 80},
    )
    client.patch(
        f"/tasks/{task_2['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 100},
    )
    client.patch(
        f"/tasks/{task_3['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 300},
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": "Сделать отчет",
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 90


def test_ai_estimate_by_similar_title(client, auth_headers):
    """
    Если точного совпадения нет, но есть похожие названия,
    прогноз должен считаться по похожим задачам.
    """
    category_id = create_category(client, auth_headers)
    task_1 = create_task(client, auth_headers, category_id=category_id, title="Тренировка на ноги").json()
    task_2 = create_task(client, auth_headers, category_id=category_id, title="Тренировка на ноги").json()
    task_3 = create_task(client, auth_headers, category_id=category_id, title="Тренировка на руки").json()

    client.patch(
        f"/tasks/{task_1['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 50},
    )
    client.patch(
        f"/tasks/{task_2['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 70},
    )
    client.patch(
        f"/tasks/{task_3['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 300},
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": "Тренировка на    ногу",
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 60


def test_ai_estimate_by_category(client, auth_headers):
    """
    Если совпадений по title нет, но передан category_id,
    прогноз должен считаться по задачам этой категории.
    """
    category_id = create_category(client, auth_headers, name="Category A")
    other_category_id = create_category(client, auth_headers, name="Category B")

    task_1 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Task one",
    ).json()
    task_2 = create_task(
        client,
        auth_headers,
        category_id=category_id,
        title="Task two",
    ).json()
    task_3 = create_task(
        client,
        auth_headers,
        category_id=other_category_id,
        title="Another task",
    ).json()

    client.patch(
        f"/tasks/{task_1['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 100},
    )
    client.patch(
        f"/tasks/{task_2['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 140},
    )
    client.patch(
        f"/tasks/{task_3['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 500},
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": "completely different title",
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 120


def test_ai_estimate_by_user_average(client, auth_headers):
    """
    Если нет совпадений по title и category_id не помогает,
    прогноз должен считаться по всем завершённым задачам пользователя.
    """
    category_id = create_category(client, auth_headers)
    task_1 = create_task(client, auth_headers, title="Task one").json()
    task_2 = create_task(client, auth_headers, title="Task two").json()

    client.patch(
        f"/tasks/{task_1['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 30},
    )
    client.patch(
        f"/tasks/{task_2['id']}/status",
        headers=auth_headers,
        json={"is_completed": True, "actual_minutes": 90},
    )

    response = client.get(
        "/tasks/ai/estimate",
        headers=auth_headers,
        params={
            "title": "unknown title",
            "category_id": category_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["predicted_minutes"] == 60