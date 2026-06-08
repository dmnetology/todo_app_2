// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import './Home.scss';

function Home() {
  return (
    <main className="home-page">
      <section className="home-page__hero">
        <div className="home-page__hero-content">
          <span className="home-page__eyebrow">To-Do App · Управление задачами</span>
          <h1 className="home-page__title">Планируй день, контролируй задачи, работай продуктивнее</h1>
          <p className="home-page__subtitle">
            Удобное приложение для создания, фильтрации, приоритизации и отслеживания задач.
            Всё важное — в одном месте, в понятном и аккуратном интерфейсе.
          </p>

          <div className="home-page__actions">
            <Link to="/tasks" className="home-page__button home-page__button--primary">
              Перейти к задачам
            </Link>
            <Link to="/about" className="home-page__button home-page__button--secondary">
              Узнать о проекте
            </Link>
          </div>
        </div>

        <div className="home-page__hero-card">
          <div className="home-page__stat">
            <span className="home-page__stat-value">FastAPI</span>
            <span className="home-page__stat-label">Надёжный backend</span>
          </div>
          <div className="home-page__stat">
            <span className="home-page__stat-value">React</span>
            <span className="home-page__stat-label">Современный frontend</span>
          </div>
          <div className="home-page__stat">
            <span className="home-page__stat-value">JWT</span>
            <span className="home-page__stat-label">Авторизация и сессии</span>
          </div>
          <div className="home-page__stat">
            <span className="home-page__stat-value">Offline</span>
            <span className="home-page__stat-label">Работа через Service Worker</span>
          </div>
        </div>
      </section>

      <section className="home-page__section">
        <div className="home-page__section-header">
          <h2 className="home-page__section-title">Что умеет приложение</h2>
          <p className="home-page__section-text">
            Всё, что нужно для удобного управления личными и рабочими задачами.
          </p>
        </div>

        <div className="home-page__grid">
          <article className="home-page__card">
            <h3 className="home-page__card-title">Управление задачами</h3>
            <p className="home-page__card-text">
              Создавайте задачи, редактируйте их, меняйте статус выполнения и быстро находите нужное.
            </p>
          </article>

          <article className="home-page__card">
            <h3 className="home-page__card-title">Категории и фильтры</h3>
            <p className="home-page__card-text">
              Группируйте задачи по категориям, сортируйте по важности и контролируйте приоритеты.
            </p>
          </article>

          <article className="home-page__card">
            <h3 className="home-page__card-title">Избранное</h3>
            <p className="home-page__card-text">
              Отмечайте важные задачи, чтобы не терять их из виду в ежедневной рутине.
            </p>
          </article>

          <article className="home-page__card">
            <h3 className="home-page__card-title">Авторизация</h3>
            <p className="home-page__card-text">
              JWT-авторизация обеспечивает персональный доступ к данным и защищает аккаунт.
            </p>
          </article>
        </div>
      </section>

      <section className="home-page__section home-page__section--highlight">
        <div className="home-page__section-header">
          <h2 className="home-page__section-title">Почему это удобно</h2>
        </div>

        <div className="home-page__timeline">
          <div className="home-page__timeline-item">
            <div className="home-page__timeline-dot" />
            <div>
              <h3 className="home-page__timeline-title">Быстрый старт</h3>
              <p className="home-page__timeline-text">
                Вход в приложение занимает несколько секунд, а интерфейс понятен с первого экрана.
              </p>
            </div>
          </div>

          <div className="home-page__timeline-item">
            <div className="home-page__timeline-dot" />
            <div>
              <h3 className="home-page__timeline-title">Единый стиль</h3>
              <p className="home-page__timeline-text">
                Все страницы оформлены в одной дизайн-системе, без визуального шума и перегрузки.
              </p>
            </div>
          </div>

          <div className="home-page__timeline-item">
            <div className="home-page__timeline-dot" />
            <div>
              <h3 className="home-page__timeline-title">Готово для расширения</h3>
              <p className="home-page__timeline-text">
                Архитектура проекта позволяет добавлять новые сущности, сценарии и статусы задач.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;