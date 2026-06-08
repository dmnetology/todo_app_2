import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Link } from 'react-router-dom';
import { getCategories } from '../api/categories';
import './Favourites.scss';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
};

const getMinutes = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'new':
      return 'Новая';
    case 'in_progress':
      return 'В работе';
    case 'paused':
      return 'Пауза';
    case 'completed':
      return 'Выполнена';
    case 'cancelled':
      return 'Отменена';
    default:
      return status || '—';
  }
};

const getStatusClassName = (status, isActive = false) => {
  const base = 'status-badge';
  const activeClass = isActive ? ' status-badge--active' : '';

  switch (status) {
    case 'new':
      return `${base} status-badge--new${activeClass}`;
    case 'in_progress':
      return `${base} status-badge--in-progress${activeClass}`;
    case 'paused':
      return `${base} status-badge--paused${activeClass}`;
    case 'completed':
      return `${base} status-badge--completed${activeClass}`;
    case 'cancelled':
      return `${base} status-badge--cancelled${activeClass}`;
    default:
      return `${base}${activeClass}`;
  }
};

const STATUS_ORDER = ['new', 'in_progress', 'paused', 'completed', 'cancelled'];

const Favourites = () => {
  const { tasks, favorites, removeTaskFromFavorites, loading, error } = useTasks();
  const [categories, setCategories] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data || []);
      } catch (err) {
        console.error('Ошибка загрузки категорий:', err);
      }
    };

    fetchCategories();
  }, []);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      map.set(String(category.id), category.name);
    });
    return map;
  }, [categories]);

  const favoriteTasks = useMemo(
    () => tasks.filter((task) => favorites.includes(task.id)),
    [tasks, favorites]
  );

  const filteredTasks = useMemo(() => {
    if (activeStatuses.length === 0) return favoriteTasks;
    return favoriteTasks.filter((task) => activeStatuses.includes(task.status));
  }, [favoriteTasks, activeStatuses]);

  const stats = useMemo(() => {
    const total = favoriteTasks.length;
    const completed = favoriteTasks.filter((task) => task.status === 'completed').length;
    const inProgress = favoriteTasks.filter((task) => task.status === 'in_progress').length;
    const paused = favoriteTasks.filter((task) => task.status === 'paused').length;
    const newCount = favoriteTasks.filter((task) => task.status === 'new').length;
    const cancelled = favoriteTasks.filter((task) => task.status === 'cancelled').length;

    return {
      total,
      completed,
      inProgress,
      paused,
      newCount,
      cancelled,
    };
  }, [favoriteTasks]);

  const handleStatusToggle = (status) => {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    );
  };

  const clearStatusFilter = () => {
    setActiveStatuses([]);
  };

  if (loading && tasks.length === 0) {
    return (
      <main className="favourites-page">
        <p className="favourites-page__message" role="status">
          Загрузка избранных задач...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="favourites-page">
        <p className="favourites-page__message favourites-page__message--error" role="alert">
          Ошибка при загрузке задач: {error}
        </p>
      </main>
    );
  }

  return (
    <main className="favourites-page">
      <header className="favourites-page__header">
        <div>
          <h1 className="favourites-page__title">Избранные задачи</h1>
          <p className="favourites-page__subtitle">
            Сохранённые задачи для быстрого доступа и контроля прогресса.
          </p>
        </div>

        <div className="favourites-page__actions">
          <Link to="/tasks" className="favourites-page__back-button">
            ← К списку задач
          </Link>

          <div className="favourites-page__counter">
            {stats.total} {stats.total === 1 ? 'задача' : 'задачи'}
          </div>
        </div>
      </header>

      <section className="favourites-stats" aria-label="Сводка по избранным задачам">
        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.length === 0 ? 'stat-card--active' : ''
          }`}
          onClick={clearStatusFilter}
        >
          <span className="stat-card__label">Все</span>
          <strong className="stat-card__value">{stats.total}</strong>
        </button>

        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.includes('new') ? 'stat-card--active' : ''
          }`}
          onClick={() => handleStatusToggle('new')}
        >
          <span className="stat-card__label">Новые</span>
          <strong className="stat-card__value">{stats.newCount}</strong>
        </button>

        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.includes('in_progress') ? 'stat-card--active' : ''
          }`}
          onClick={() => handleStatusToggle('in_progress')}
        >
          <span className="stat-card__label">В работе</span>
          <strong className="stat-card__value stat-card__value--warning">
            {stats.inProgress}
          </strong>
        </button>

        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.includes('paused') ? 'stat-card--active' : ''
          }`}
          onClick={() => handleStatusToggle('paused')}
        >
          <span className="stat-card__label">Пауза</span>
          <strong className="stat-card__value">{stats.paused}</strong>
        </button>

        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.includes('completed') ? 'stat-card--active' : ''
          }`}
          onClick={() => handleStatusToggle('completed')}
        >
          <span className="stat-card__label">Выполнено</span>
          <strong className="stat-card__value stat-card__value--success">
            {stats.completed}
          </strong>
        </button>

        <button
          type="button"
          className={`stat-card stat-card--filter ${
            activeStatuses.includes('cancelled') ? 'stat-card--active' : ''
          }`}
          onClick={() => handleStatusToggle('cancelled')}
        >
          <span className="stat-card__label">Отменено</span>
          <strong className="stat-card__value">{stats.cancelled}</strong>
        </button>
      </section>

      {filteredTasks.length === 0 ? (
        <section className="empty-state">
          <h2 className="empty-state__title">Задачи не найдены</h2>
          <p className="empty-state__text">
            Для выбранного фильтра по статусу нет задач. Попробуйте снять фильтр или выбрать
            другой статус.
          </p>
          <button type="button" onClick={clearStatusFilter} className="empty-state__button">
            Сбросить фильтр
          </button>
        </section>
      ) : (
        <section className="task-grid" aria-label="Список избранных задач">
          {filteredTasks.map((task) => {
            const completed = task.status === 'completed';
            const categoryName = categoryMap.get(String(task.category_id)) || 'Без категории';

            const estimatedMinutes = getMinutes(task.estimated_minutes);
            const actualMinutes = getMinutes(task.actual_minutes);

            const isOverdue =
              !completed && task.due_date && new Date(task.due_date).getTime() < Date.now();

            const hasActualMinutes = actualMinutes !== null && actualMinutes !== 0;

            const diff =
              estimatedMinutes !== null && hasActualMinutes
                ? actualMinutes - estimatedMinutes
                : null;

            return (
              <article
                key={task.id}
                className={`task-card ${
                  completed ? 'task-card--completed' : 'task-card--pending'
                } ${isOverdue ? 'task-card--alert' : ''}`}
              >
                <div className="task-card__top">
                  <div>
                    <h2 className="task-card__title">
                      <Link to={`/tasks/${task.id}`} className="task-card__link">
                        {task.title || `Задача ${task.id}`}
                      </Link>
                    </h2>
                    <p className="task-card__description">
                      {task.description || 'Нет описания'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeTaskFromFavorites(task.id)}
                    className="task-card__remove"
                    aria-label={`Удалить задачу "${task.title}" из избранного`}
                  >
                    Удалить из избранного
                  </button>
                </div>

                <div className="task-badges">
                  <span className="badge badge--category">{categoryName}</span>
                  <span className={getStatusClassName(task.status)}>{getStatusLabel(task.status)}</span>
                  <span className="badge badge--priority">
                    {task.priority || 'Без приоритета'}
                  </span>
                </div>

                {isOverdue && !completed && (
                  <div className="task-card__alert-line">
                    Просрочена относительно крайнего срока выполнения
                  </div>
                )}

                <dl className="task-meta">
                  <div className="task-meta__item">
                    <dt>План</dt>
                    <dd>{formatDateTime(task.planned_start_local)}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Крайний срок выполнения</dt>
                    <dd>{formatDateTime(task.due_date)}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Создана</dt>
                    <dd>{formatDateTime(task.created_at)}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Старт</dt>
                    <dd>{formatDateTime(task.actual_started_at)}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Финиш</dt>
                    <dd>{formatDateTime(task.completed_at)}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Прогноз</dt>
                    <dd>{estimatedMinutes !== null ? `${estimatedMinutes} мин.` : '—'}</dd>
                  </div>

                  <div className="task-meta__item">
                    <dt>Факт</dt>
                    <dd>{hasActualMinutes ? `${actualMinutes} мин.` : '—'}</dd>
                  </div>
                </dl>

                <div
                  className={`task-comparison ${
                    diff === null
                      ? 'task-comparison--empty'
                      : diff > 0
                        ? 'task-comparison--late'
                        : diff < 0
                          ? 'task-comparison--early'
                          : 'task-comparison--equal'
                  }`}
                >
                  {diff === null
                    ? actualMinutes === 0
                      ? 'Задача ещё не начата'
                      : 'Сравнение недоступно'
                    : diff > 0
                      ? `+${diff} мин. к прогнозу`
                      : diff < 0
                        ? `${Math.abs(diff)} мин. быстрее прогноза`
                        : 'Совпадает с прогнозом'}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
};

export default Favourites;
