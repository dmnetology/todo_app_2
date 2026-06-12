import './About.scss';

function About() {
  return (
    <main className="about-page">
      <section className="about-page__intro">
        <div className="about-page__intro-content">
          <span className="about-page__eyebrow">О проекте</span>
          <h1 className="about-page__title">To-Do App — учебный проект-практика</h1>
          <p className="about-page__text">
            Приложение создано для освоения современного full-stack подхода: backend на FastAPI,
            frontend на React, работа с JWT, Docker, миграциями и сервис-воркером для offline-сценариев.
          </p>
        </div>

        <div className="about-page__facts">
          <div className="about-page__fact">
            <span className="about-page__fact-value">FastAPI</span>
            <span className="about-page__fact-label">Быстрый backend API</span>
          </div>
          <div className="about-page__fact">
            <span className="about-page__fact-value">React</span>
            <span className="about-page__fact-label">Интерактивный frontend</span>
          </div>
          <div className="about-page__fact">
            <span className="about-page__fact-value">Docker</span>
            <span className="about-page__fact-label">Единый способ запуска</span>
          </div>
        </div>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__section-title">Что есть в системе</h2>

        <div className="about-page__grid">
          <article className="about-page__card">
            <h3 className="about-page__card-title">Авторизация и пользователи</h3>
            <p className="about-page__card-text">
              Регистрация, вход, refresh-токены, получение данных текущего пользователя и защита маршрутов.
            </p>
          </article>

          <article className="about-page__card">
            <h3 className="about-page__card-title">Задачи и статусы</h3>
            <p className="about-page__card-text">
              Создание, редактирование, удаление, фильтрация, смена статуса и управление приоритетом задач.
            </p>
          </article>

          <article className="about-page__card">
            <h3 className="about-page__card-title">Категории</h3>
            <p className="about-page__card-text">
              Удобная группировка задач по категориям помогает организовать личную и рабочую нагрузку.
            </p>
          </article>

          <article className="about-page__card">
            <h3 className="about-page__card-title">Избранное</h3>
            <p className="about-page__card-text">
              Важные задачи можно выделять отдельно, чтобы они всегда оставались под рукой.
            </p>
          </article>

          <article className="about-page__card">
            <h3 className="about-page__card-title">Импорт/экспорт</h3>
            <p className="about-page__card-text">
              Удобный сервис импорта/экспорта задач с возможностью внешнего подключения по API.
            </p>
          </article>

          <article className="about-page__card">
            <h3 className="about-page__card-title">ML-прогноз</h3>
            <p className="about-page__card-text">
              Встроенный ML-сервис поможет спрогнозировать длительность задачи, чтобы учесть ее при планировании.
            </p>
          </article>
        </div>
      </section>

      <section className="about-page__section about-page__section--split">
        <div className="about-page__panel">
          <h2 className="about-page__section-title">Технологический стек</h2>
          <ul className="about-page__list">
            <li>Python, FastAPI, SQLAlchemy, Alembic</li>
            <li>JWT-авторизация и REST API</li>
            <li>React, React Router, Context API</li>
            <li>Vite, JavaScript, Sass</li>
            <li>Docker, Docker Compose</li>
            <li>Service Worker для offline-режима</li>
            <li>ML для предсказания</li>
          </ul>
        </div>

        <div className="about-page__panel about-page__panel--accent">
          <h2 className="about-page__section-title">Цель проекта</h2>
          <p className="about-page__text">
            Создать учебный проект, который уже будет достаточно интересным и позволит развивать его дальше:
            роли, уведомления, календарь, повторяющиеся задачи, аналитику, мобильную версию и др.
          </p>
        </div>
      </section>
    </main>
  );
}

export default About;