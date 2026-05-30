# ToDo App

Backend API и Frontend для приложения управления задачами.

## Описание

**ToDo App** — это полноценное веб-приложение для управления задачами, состоящее из:

- **REST API** (Backend) для:
    - регистрации и авторизации пользователей;
    - управления категориями;
    - создания, редактирования, удаления и просмотра задач;
    - изменения статуса задач;
    - получения прогноза времени выполнения задачи;
    - проверки состояния приложения через health-check.
- **Интерактивного пользовательского интерфейса** (Frontend), который позволяет:
    - регистрироваться и авторизоваться;
    - просматривать список задач;
    - добавлять и удалять задачи из избранного;
    - выходить из системы;
    - работать с приложением в офлайн-режиме (Service Worker).

## Технологии

### Backend
- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- JWT
- Docker
- Docker Compose

### Frontend
- React
- React Router
- Context API (для управления состоянием задач и авторизации)
- React.memo 
- useMemo 
- useCallback 
- React.lazy 
- Suspense 
- Service Worker 
- Jest 
- React Testing Library 
- Lighthouse

## Структура проекта

    todo_app/
    ├── app/                     # Backend часть
    │   ├── __init__.py
    │   ├── main.py
    │   ├── api/
    │   ├── core/
    │   ├── db/
    │   ├── models/
    │   ├── schemas/
    │   └── services/
    ├── alembic/
    ├── tests/
    ├── alembic.ini
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    ├── frontend/                # Frontend часть
    │   ├── public/
    │   ├── src/
    │   │   ├── assets/
    │   │   ├── context/
    │   │   ├── pages/
    │   │   ├── App.jsx
    │   │   ├── App.css
    │   │   ├── main.jsx
    │   │   └── index.css
    │   ├── eslint.config.js
    │   ├── package.json
    │   ├── index.html
    │   └── vite.config.js
    ├── docker-compose.yml       # Общий Docker Compose файл для обеих частей
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

Проект состоит из двух частей:

- **Backend** — FastAPI + PostgreSQL
- **Frontend** — React (запускается отдельно через Vite)

### 1. Запуск Backend

### Через Docker

    docker compose up --build

### Применение миграций

    docker compose exec api alembic upgrade head

### 2. Запуск Frontend (из директории frontend)

    npm install
    npm run dev

После запуска приложение будет доступно по адресу:
http://localhost:5173

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

### Особенности авторизации во frontend
    - JWT-токен сохраняется в localStorage;
    - реализована проверка наличия и валидности токена;
    - при отсутствии, истечении или невалидности токена пользователь перенаправляется на страницу входа;
    - при выходе из системы токены и пользовательские данные очищаются;
    - в шапке приложения отображается имя пользователя после успешного входа.

### Возврат данных текущего пользователя.

    GET /auth/me


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

## Избранное
    - создан маршрут /favourites;
    - отображается список задач, добавленных в избранное;
    - реализовано удаление задачи из избранного;
    - состояние избранного сохраняется в localStorage.


## Оптимизация frontend (для повышения производительности)
    - React.memo;
    - useMemo;
    - useCallback;
    - React.lazy;
    - Suspense.

## Progressive Web App и Service Worker
    - кешируются основные ресурсы приложения;
    - реализованы события install, fetch и activate;
    - очищаются устаревшие версии кеша;
    - приложение может работать в офлайн-режиме;
    - при отсутствии сети выводится уведомление о переходе в офлайн-режим;
    - используется кеш для повторной загрузки доступных ресурсов.

## Индикаторы состояния
    - отображение имени пользователя после успешной авторизации;
    - отображение кнопки «Войти» при отсутствии авторизации;
    - динамический индикатор статуса сети;
    - уведомление о потере соединения;
    - уведомление о восстановлении соединения.

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

backend: `pytest или pytest --cov=app --cov-report=term-missing`

frontend:
- Jest;
- React Testing Library;
- Lighthouse для проверки производительности и доступности.
    
для запуска:
- из корня проекта: `cd frontend`
- далее: `npm test`

## Развертывание
    - Создан production build с помощью npm run build;
    - приложение развернуто на Vercel через GitHub;
    - приложение доступно по публичной ссылке.