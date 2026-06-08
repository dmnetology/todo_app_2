# app/tests/test_auth.py

def test_register_user(client):
    """
    Тест регистрации пользователя.

    Ожидаем, что:
    - запрос завершится успешно;
    - сервер вернёт статус 201 Created;
    - в ответе будет логин созданного пользователя.
    """
    response = client.post(
        "/auth/register",
        json={
            "first_name": "Petr",
            "last_name": "Petrov",
            "login": "petr@mail.ru",
            "password": "password123",
        },
    )

    assert response.status_code == 201
    assert response.json()["login"] == "petr@mail.ru"


def test_register_duplicate_login(client):
    """
    Тест на уникальность логина.

    Сценарий:
    1. Регистрируем первого пользователя.
    2. Пытаемся зарегистрировать второго с тем же login.
    3. Ожидаем ошибку 409 Conflict.
    """
    payload = {
        "first_name": "Petr",
        "last_name": "Petrov",
        "login": "petr@mail.ru",
        "password": "password123",
    }

    client.post("/auth/register", json=payload)
    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409


def test_login_success(client):
    """
    Тест успешной авторизации.

    Сценарий:
    1. Регистрируем пользователя.
    2. Отправляем корректные данные для входа.
    3. Проверяем, что сервер возвращает access_token.
    """
    client.post(
        "/auth/register",
        json={
            "first_name": "Anna",
            "last_name": "Smirnova",
            "login": "anna@mail.ru",
            "password": "password123",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "login": "anna@mail.ru",
            "password": "password123",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    """
    Тест неуспешной авторизации.

    Сценарий:
    1. Регистрируем пользователя.
    2. Пытаемся войти с неправильным паролем.
    3. Ожидаем статус 401 Unauthorized.
    """
    client.post(
        "/auth/register",
        json={
            "first_name": "Anna",
            "last_name": "Smirnova",
            "login": "anna@mail.ru",
            "password": "password123",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "login": "anna@mail.ru",
            "password": "wrong_password",
        },
    )

    assert response.status_code == 401


def test_change_password(client, auth_headers):
    """
    Тест смены пароля.

    Используется готовый заголовок авторизации из фикстуры auth_headers.
    Ожидаем, что:
    - запрос выполнится успешно;
    - сервер вернёт статус 204 No Content;
    - пароль пользователя будет обновлён.
    """
    response = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={
            "old_password": "password123",
            "new_password": "newpassword123",
        },
    )

    assert response.status_code == 204


def test_refresh_token(client):
    """
    Тест обновления токена.

    Сценарий:
    1. Регистрируем пользователя.
    2. Логинимся и получаем refresh_token.
    3. Отправляем refresh_token на endpoint /auth/refresh.
    4. Проверяем, что сервер возвращает новый access_token.
    """
    client.post(
        "/auth/register",
        json={
            "first_name": "Olga",
            "last_name": "Sokolova",
            "login": "olga@mail.ru",
            "password": "password123",
        },
    )

    login_response = client.post(
        "/auth/login",
        json={
            "login": "olga@mail.ru",
            "password": "password123",
        },
    )

    refresh_token = login_response.json()["refresh_token"]

    response = client.post(
        "/auth/refresh",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_get_me(client, auth_headers):
    """
    Тест получения данных текущего пользователя.

    Используется авторизованный запрос, чтобы проверить:
    - что access-токен распознаётся корректно;
    - что endpoint возвращает данные текущего пользователя;
    - что сервер отвечает статусом 200 OK.
    """
    response = client.get(
        "/auth/me",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert "login" in response.json()


def test_get_me_invalid_token(client):
    """
    Тест проверки невалидного access-токена.

    Сценарий:
    1. Отправляем запрос с повреждённым токеном.
    2. Ожидаем статус 401 Unauthorized.
    """
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token"},
    )

    assert response.status_code == 401


def test_get_me_with_refresh_token(client):
    """
    Тест проверки токена неправильного типа.

    Сценарий:
    1. Регистрируем пользователя.
    2. Логинимся и получаем refresh_token.
    3. Используем refresh_token вместо access_token.
    4. Ожидаем статус 401 Unauthorized.
    """
    client.post(
        "/auth/register",
        json={
            "first_name": "Anna",
            "last_name": "Smirnova",
            "login": "anna@mail.ru",
            "password": "password123",
        },
    )

    login_response = client.post(
        "/auth/login",
        json={
            "login": "anna@mail.ru",
            "password": "password123",
        },
    )

    refresh_token = login_response.json()["refresh_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )

    assert response.status_code == 401


def test_get_me_user_not_found(client, auth_headers, db_session):
    """
    Тест случая, когда токен валиден, но пользователь отсутствует в базе.

    Сценарий:
    1. Получаем валидные headers авторизации.
    2. Удаляем пользователя из базы.
    3. Пытаемся обратиться к защищённому endpoint.
    4. Ожидаем статус 401 Unauthorized.
    """
    from app.models.user import User

    user = db_session.query(User).first()
    db_session.delete(user)
    db_session.commit()

    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 401
    assert response.json()["detail"] == "User not found"