# ToDo App

Backend API для приложения управления задачами.

## Описание

**ToDo App** — REST API для:

- регистрации и авторизации пользователей;
- управления категориями;
- создания, редактирования, удаления и просмотра задач;
- изменения статуса задач;
- получения прогноза времени выполнения задачи;
- проверки состояния приложения через health-check.

## Технологии

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- JWT
- Docker
- Docker Compose

## Структура проекта

    todo_app/
    ├── app/
    │   ├── main.py
    │   ├── core/
    │   ├── db/
    │   ├── models/
    │   ├── schemas/
    │   ├── services/
    │   └── api/
    ├── alembic/
    ├── tests/
    ├── alembic.ini
    ├── Dockerfile
    ├── docker-compose.yml
    ├── requirements.txt
    ├── .env
    └── README.md

## Переменные окружения

Пример `.env`:

    PROJECT_NAME=ToDo App
    DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/todo_db
    SECRET_KEY=change_me
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=30
    REFRESH_TOKEN_EXPIRE_MINUTES=10080

### Назначение

- `PROJECT_NAME` — название приложения;
- `DATABASE_URL` — строка подключения к PostgreSQL;
- `SECRET_KEY` — секретный ключ для подписи JWT (создай свой);
- `ALGORITHM` — алгоритм подписи токенов;
- `ACCESS_TOKEN_EXPIRE_MINUTES` — время жизни access-токена;
- `REFRESH_TOKEN_EXPIRE_MINUTES` — время жизни refresh-токена.

## Запуск проекта

### Через Docker

    docker compose up --build

### Применение миграций

    docker compose exec api alembic upgrade head

## Health-check

    GET /health

Используется для проверки, что приложение запущено и доступно.

## Авторизация

### Регистрация

    POST /auth/register

### Логин

    POST /auth/login

### Смена пароля

    POST /auth/change-password

Требует авторизации: `Bearer token`

### Обновление токена

    POST /auth/refresh

## Категории

Все эндпоинты категорий требуют авторизации.

### Получить категории

    GET /categories

### Создать категорию

    POST /categories

### Обновить категорию

    PUT /categories/{category_id}

### Удалить категорию

    DELETE /categories/{category_id}

## Задачи

Все эндпоинты задач требуют авторизации.

### Создать задачу

    POST /tasks

### Получить список задач

    GET /tasks

Поддерживаются:

- `skip`
- `limit`
- `is_completed`
- `category_id`
- `sort_by`

### Получить задачу по ID

    GET /tasks/{task_id}

### Обновить задачу

    PUT /tasks/{task_id}

### Удалить задачу

    DELETE /tasks/{task_id}

### Изменить статус задачи

    PATCH /tasks/{task_id}/status

### Прогноз времени выполнения задачи

    GET /tasks/ai/estimate

Query-параметры:

- `title` — обязательный;
- `category_id` — обязательный.

## Swagger / OpenAPI

После запуска проекта документация доступна по адресу:

- `http://localhost:8000/docs`


Для защищённых эндпоинтов используй кнопку **Authorize** и вставляй:

    Bearer <access_token>

## Миграции

Создать миграцию:

    docker compose exec api alembic revision --autogenerate -m "message"

Применить миграции:

    docker compose exec api alembic upgrade head

Откатить миграцию:

    docker compose exec api alembic downgrade -1

## Тесты

    pytest или pytest --cov=app --cov-report=term-missing
