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
    - использование ML-модели для прогноза (обучение, оценка, использование, дообучение);
    - импорт/экспорт JSON/CSV; 
    - проверки состояния приложения через health-check.
- **Интерактивного пользовательского интерфейса** (Frontend), который позволяет:
    - регистрироваться и авторизоваться;
    - просматривать список задач (фильтры, сортировка);
    - добавлять и удалять задачи из избранного;
    - выходить из системы;
    - загружать и выгружать задачи через JSON/CSV;
    - реализовано переключение между светлой и темной темами;
    - реализовано отображение для пользователя информации о прогнозной модели;
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
    │   ├── ml/
    │   ├── models/
    │   ├── schemas/
    │   └── services/
    ├── alembic/
    ├── tests/
    ├── alembic.ini
    ├── Dockerfile
    ├── .dockerignore
    ├── .gitignore
    ├── pytest.ini
    ├── requirements.txt
    ├── .env.example
    ├── frontend/                # Frontend часть
    │   ├── public/
    │   │   └── service-worker.js
    │   ├── src/
    │   │   ├── __tests__/
    │   │   ├── api/
    │   │   ├── assets/
    │   │   ├── components/
    │   │   ├── context/
    │   │   ├── pages/
    │   │   ├── styles/
    │   │   ├── tests/
    │   │   ├── utils/
    │   │   ├── App.jsx
    │   │   ├── App.css
    │   │   ├── main.jsx
    │   │   ├── setupTests.js
    │   │   └── index.css
    │   ├── eslint.config.js
    │   ├── babel.config.cjs
    │   ├── jest.config.cjs
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

### Получение информации об активной ML-модели текущего пользователя

    GET /tasks/ml/model-info

### Изменение статуса задачи на in_progress (старт выполнения)

    PATCH /tasks/{task_id}/start

### Изменение статуса задачи на paused (пауза выполнения)

    PATCH /tasks/{task_id}/pause

### Изменение статуса задачи на in_progress после паузы (продолжение выполнения)

    PATCH /tasks/{task_id}/resume

### Изменение статуса задачи на completed (завершение выполнения)

    PATCH /tasks/{task_id}/complete

### Изменение статуса задачи на cancelled (отмена задачи)

    PATCH /tasks/{task_id}/cancel


## Синхронизация

Все эндпоинты задач требуют авторизации.

### Экспорт JSON

    GET /sync/export/json

### Импорт JSON

    POST /sync/import/json

### Экспорт CSV

    GET /sync/export/csv

### Импорт CSV

    POST /sync/import/csv


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
    - приложение (только фронтенд) развернуто на Vercel через GitHub;
    - приложение доступно по публичной ссылке - https://todo-app-2-wine-gamma.vercel.app/

## Для локальной проверки production (кэширование в dev режиме отключено) 

    npm run build
    npm run preview

Поднимется прод-сборка на http://localhost:4173

Если preview не настроен, то используйте простой сервер - serve (один из вариантов):

    npm i -g serve
    npm run build
    serve -s dist

Поднимется прод-сборка на http://localhost:3000