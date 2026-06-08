import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';
import Dropdown from '../components/Dropdown/Dropdown';
import './Tasks.scss';
import { formatDateTimeShort, parseDate } from '../utils/datetime';

const TASKS_API_URL = 'http://localhost:8000/tasks';
const FALLBACK_CITY = 'Набережные Челны';

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

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const currentDateLabel = capitalize(
  new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
);

const getStatusClassName = (status) => {
  switch (status) {
    case 'new':
      return 'status-badge status-badge--new';
    case 'in_progress':
      return 'status-badge status-badge--in-progress';
    case 'paused':
      return 'status-badge status-badge--paused';
    case 'completed':
      return 'status-badge status-badge--completed';
    case 'cancelled':
      return 'status-badge status-badge--cancelled';
    default:
      return 'status-badge';
  }
};

const getStatusSortValue = (status) => {
  switch (status) {
    case 'new':
      return 1;
    case 'in_progress':
      return 2;
    case 'paused':
      return 3;
    case 'completed':
      return 4;
    case 'cancelled':
      return 5;
    default:
      return 99;
  }
};

const getStartTimeMinutesDiff = (planValue, actualStartedAt, status) => {
  const planDate = parseDate(planValue);
  if (!planDate) return null;

  const baseDate = actualStartedAt
    ? parseDate(actualStartedAt)
    : status === 'new'
      ? new Date()
      : null;

  if (!baseDate) return null;

  return Math.round((planDate.getTime() - baseDate.getTime()) / 60000);
};

const formatTimeToStart = (planValue, actualStartedAt, status) => {
  const diff = getStartTimeMinutesDiff(planValue, actualStartedAt, status);
  if (diff === null) return '—';

  if (diff < 0) {
    return <span className="time-overdue">-{Math.abs(diff)} мин.</span>;
  }

  return `${diff} мин.`;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const getWeatherDescription = (code) => {
  const map = {
    0: 'Ясно',
    1: 'Преимущественно ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Иней',
    51: 'Лёгкая морось',
    53: 'Морось',
    55: 'Сильная морось',
    61: 'Небольшой дождь',
    63: 'Дождь',
    65: 'Сильный дождь',
    71: 'Небольшой снег',
    73: 'Снег',
    75: 'Сильный снег',
    80: 'Ливень',
    81: 'Сильный ливень',
    82: 'Очень сильный ливень',
    95: 'Гроза',
  };

  return map[code] || '—';
};

const Tasks = () => {
  const navigate = useNavigate();

    const {
      tasks,
      total,
      limit,
      loading,
      error,
      addTaskToFavorites,
      removeTaskFromFavorites,
      isFavorite,
      fetchTasks,
    } = useTasks();

  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const [sortBy, setSortBy] = useState('plan');
  const [sortOrder, setSortOrder] = useState('asc');

  const [datePreset, setDatePreset] = useState('all_from_today');

  const [weather, setWeather] = useState(null);
  const [weatherPlace, setWeatherPlace] = useState(FALLBACK_CITY);
  const [currencyRates, setCurrencyRates] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const AUTH_TOKEN = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        if (!AUTH_TOKEN) return;

        const response = await fetch('http://localhost:8000/categories', {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки категорий: ${response.status}`);
        }

        const data = await response.json();
        setCategories(data || []);
      } catch (err) {
        console.error('Ошибка загрузки категорий:', err);
      }
    };

    fetchCategories();
  }, [AUTH_TOKEN]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        if (!response.ok) throw new Error('Не удалось загрузить курсы валют');
        const data = await response.json();

        setCurrencyRates({
          usd: data?.Valute?.USD?.Value ?? null,
          eur: data?.Valute?.EUR?.Value ?? null,
          cny: data?.Valute?.CNY?.Value ?? null,
        });
      } catch (err) {
        console.error(err);
        setCurrencyRates(null);
      }
    };

    fetchRates();
  }, []);

  useEffect(() => {
    fetchTasks({
      skip: (currentPage - 1) * (limit || 20),
      limit: limit || 20,
    });
  }, [currentPage, limit, fetchTasks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, statusFilter, datePreset, sortBy, sortOrder]);

  useEffect(() => {
    const fetchWeatherByCoords = async (lat, lon, placeLabel) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Не удалось загрузить погоду');
      const data = await response.json();

      setWeather({
        temperature: data?.current?.temperature_2m ?? null,
        code: data?.current?.weather_code ?? null,
      });
      setWeatherPlace(placeLabel);
    };

    const fetchFallbackWeather = async () => {
      try {
        const city = FALLBACK_CITY;
        const lat = 55.7439;
        const lon = 52.3959;

        await fetchWeatherByCoords(lat, lon, city);
      } catch (err) {
        console.error(err);
        setWeather(null);
        setWeatherPlace(FALLBACK_CITY);
      }
    };

    const fetchWeather = async () => {
      try {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                await fetchWeatherByCoords(latitude, longitude, 'По вашей локации');
              } catch (err) {
                console.error(err);
                await fetchFallbackWeather();
              }
            },
            async () => {
              await fetchFallbackWeather();
            },
            { enableHighAccuracy: false, timeout: 5000 }
          );
        } else {
          await fetchFallbackWeather();
        }
      } catch (err) {
        console.error(err);
        await fetchFallbackWeather();
      }
    };

    fetchWeather();
  }, []);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      map.set(String(category.id), category.name);
    });
    return map;
  }, [categories]);

  const filteredAndSortedTasks = useMemo(() => {
    const today = startOfDay(new Date());

    let result = [...(tasks || [])].filter((task) => {
      const planDate = parseDate(task.planned_start_local);
      if (!planDate) return false;

      if (datePreset === 'all') {
        return true;
      }

      if (datePreset === 'all_from_today') {
        return planDate >= startOfDay(today);
      }

      if (datePreset === 'today') {
        return planDate >= startOfDay(today) && planDate <= endOfDay(today);
      }

      if (datePreset === 'tomorrow') {
        const tomorrow = addDays(today, 1);
        return planDate >= startOfDay(tomorrow) && planDate <= endOfDay(tomorrow);
      }

      if (datePreset === 'week') {
        const currentDay = today.getDay();
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = addDays(today, mondayOffset);
        const sunday = addDays(monday, 6);
        return planDate >= startOfDay(monday) && planDate <= endOfDay(sunday);
      }

      return planDate >= startOfDay(today);
    });

    if (categoryFilter !== 'all') {
      result = result.filter((task) => String(task.category_id) === String(categoryFilter));
    }

    if (statusFilter !== 'all') {
      result = result.filter((task) => String(task.status) === String(statusFilter));
    }

    const getSortValue = (task, key) => {
      switch (key) {
        case 'number':
          return Number(task.id ?? 0);
        case 'title':
          return String(task.title || '').toLowerCase();
        case 'status':
          return getStatusSortValue(task.status);
        case 'priority':
          return String(task.priority || '').toLowerCase();
        case 'plan':
          return parseDate(task.planned_start_local)?.getTime() ?? 0;
        case 'timer':
          return Number(
            getStartTimeMinutesDiff(task.planned_start_local, task.actual_started_at, task.status) ??
              0
          );
        case 'start':
          return parseDate(task.actual_started_at)?.getTime() ?? 0;
        case 'finish':
          return parseDate(task.completed_at)?.getTime() ?? 0;
        case 'forecast':
          return Number(task.estimated_minutes ?? 0);
        case 'fact':
          return Number(task.actual_minutes ?? 0);
        case 'category':
          return String(categoryMap.get(String(task.category_id)) || '').toLowerCase();
        case 'favorite':
          return isFavorite(task.id) ? 1 : 0;
        default:
          return '';
      }
    };

    result.sort((a, b) => {
      const valueA = getSortValue(a, sortBy);
      const valueB = getSortValue(b, sortBy);

      if (typeof valueA === 'string' || typeof valueB === 'string') {
        return sortOrder === 'asc'
          ? valueA.localeCompare(valueB, 'ru')
          : valueB.localeCompare(valueA, 'ru');
      }

      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });

    return result;
  }, [tasks, categoryFilter, statusFilter, sortBy, sortOrder, categoryMap, datePreset, isFavorite]);

  const requestTaskAction = async (taskId, action) => {
    setActionLoading((prev) => ({ ...prev, [taskId]: action }));

    try {
      const response = await fetch(`${TASKS_API_URL}/${taskId}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка выполнения действия "${action}": ${response.status}`);
      }

      await fetchTasks?.();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Ошибка выполнения действия');
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: '' }));
    }
  };

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIndicator = (column) => {
    if (sortBy !== column) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getTaskActionButtons = (task) => {
    const loadingAction = actionLoading[task.id] || '';

    if (task.status === 'new') {
      return (
        <button
          type="button"
          className="task-action task-action--start"
          onClick={() => requestTaskAction(task.id, 'start')}
          disabled={loadingAction === 'start'}
          aria-label="Начать выполнение"
          title="Начать выполнение"
        >
          {loadingAction === 'start' ? '...' : '▶'}
        </button>
      );
    }

    if (task.status === 'in_progress') {
      return (
        <>
          <button
            type="button"
            className="task-action task-action--pause"
            onClick={() => requestTaskAction(task.id, 'pause')}
            disabled={loadingAction === 'pause'}
            aria-label="Поставить на паузу"
            title="Пауза"
          >
            {loadingAction === 'pause' ? '...' : '⏸'}
          </button>

          <button
            type="button"
            className="task-action task-action--complete"
            onClick={() => requestTaskAction(task.id, 'complete')}
            disabled={loadingAction === 'complete'}
            aria-label="Завершить задачу"
            title="Задача выполнена"
          >
            {loadingAction === 'complete' ? '...' : '✓'}
          </button>
        </>
      );
    }

    if (task.status === 'paused') {
      return (
        <>
          <button
            type="button"
            className="task-action task-action--start"
            onClick={() => requestTaskAction(task.id, 'resume')}
            disabled={loadingAction === 'resume'}
            aria-label="Возобновить выполнение"
            title="Возобновить"
          >
            {loadingAction === 'resume' ? '...' : '▶'}
          </button>

          <button
            type="button"
            className="task-action task-action--complete"
            onClick={() => requestTaskAction(task.id, 'complete')}
            disabled={loadingAction === 'complete'}
            aria-label="Завершить задачу"
            title="Задача выполнена"
          >
            {loadingAction === 'complete' ? '...' : '✓'}
          </button>
        </>
      );
    }

    return null;
  };

  const weatherText = weather
    ? `${weather.temperature !== null ? `${Math.round(weather.temperature)}°C` : '—'} · ${getWeatherDescription(weather.code)}`
    : '—';

  const ratesText = `USD ${currencyRates?.usd ? currencyRates.usd.toFixed(2) : '—'} · EUR ${
    currencyRates?.eur ? currencyRates.eur.toFixed(2) : '—'
  } · CNY ${currencyRates?.cny ? currencyRates.cny.toFixed(2) : '—'}`;

  const headerInfoText = `${currentDateLabel}   ·   ${weatherText}   ·   ${ratesText}`;

  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 20)));

  const pagination = totalPages > 1 ? (
  <div className="tasks-pagination" aria-label="Пагинация задач">
    <button
      type="button"
      className="tasks-pagination__button"
      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
      disabled={currentPage === 1}
    >
      Назад
    </button>

    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
      <button
        key={page}
        type="button"
        className={`tasks-pagination__button ${currentPage === page ? 'is-active' : ''}`}
        onClick={() => setCurrentPage(page)}
      >
        {page}
      </button>
    ))}

    <button
      type="button"
      className="tasks-pagination__button"
      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
      disabled={currentPage === totalPages}
    >
      Вперёд
    </button>
  </div>
) : null;

  if (loading) {
    return (
      <main className="tasks-page">
        <div className="tasks-page__message">Загрузка задач...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="tasks-page">
        <div className="tasks-page__message tasks-page__message--error" role="alert">
          Ошибка при загрузке задач: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="tasks-page">
      <header className="tasks-page__header">
        <div className="tasks-page__title-wrap">
          <h1 className="tasks-page__title">Список задач</h1>
          <p className="tasks-page__subtitle">Управление задачами, их статусами и параметрами.</p>
        </div>

        <div className="tasks-page__header-info" aria-label="Дополнительная информация">
          {headerInfoText}
        </div>

        <button
          type="button"
          className="tasks-page__create-button"
          onClick={() => navigate('/tasks/new')}
        >
          + Новая задача
        </button>
      </header>

      <section className="tasks-page__controls" aria-label="Фильтры задач">
        <Dropdown
          id="category-filter"
          label="Категория"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Все' },
            ...categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            })),
          ]}
        />

        <Dropdown
          id="status-filter"
          label="Статус"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'new', label: 'Новые' },
            { value: 'in_progress', label: 'В работе' },
            { value: 'paused', label: 'Пауза' },
            { value: 'completed', label: 'Выполненные' },
            { value: 'cancelled', label: 'Отменённые' },
          ]}
        />
      </section>

      <section className="tasks-table-section">
        <div className="tasks-table-section__head">
          <div className="tasks-table-section__title-row">
            <h2 className="tasks-table-section__title">Таблица задач</h2>

            <div className="tasks-table-section__date-pills" aria-label="Фильтр по датам">
              <button
                type="button"
                className={`date-pill ${datePreset === 'all' ? 'is-active' : ''}`}
                onClick={() => setDatePreset('all')}
                >
                Все
              </button>

                <button
                  type="button"
                  className={`date-pill ${datePreset === 'all_from_today' ? 'is-active' : ''}`}
                  onClick={() => setDatePreset('all_from_today')}
                >
                  От сегодня+
                </button>

              <button
                type="button"
                className={`date-pill ${datePreset === 'today' ? 'is-active' : ''}`}
                onClick={() => setDatePreset('today')}
              >
                Сегодня
              </button>

              <button
                type="button"
                className={`date-pill ${datePreset === 'tomorrow' ? 'is-active' : ''}`}
                onClick={() => setDatePreset('tomorrow')}
              >
                Завтра
              </button>

              <button
                type="button"
                className={`date-pill ${datePreset === 'week' ? 'is-active' : ''}`}
                onClick={() => setDatePreset('week')}
              >
                Неделя
              </button>
            </div>
          </div>
        </div>

        {pagination}

        {filteredAndSortedTasks.length === 0 ? (
          <div className="tasks-page__message">Задач не найдено.</div>
        ) : (
          <div className="table-wrapper">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('number')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('number');
                      }
                    }}
                    aria-sort={sortBy === 'number' ? sortOrder : 'none'}
                  >
                    <span>№ <i>{getSortIndicator('number')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('title')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('title');
                      }
                    }}
                    aria-sort={sortBy === 'title' ? sortOrder : 'none'}
                  >
                    <span>Название <i>{getSortIndicator('title')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('status')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('status');
                      }
                    }}
                    aria-sort={sortBy === 'status' ? sortOrder : 'none'}
                  >
                    <span>Статус <i>{getSortIndicator('status')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('priority')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('priority');
                      }
                    }}
                    aria-sort={sortBy === 'priority' ? sortOrder : 'none'}
                  >
                    <span>Приоритет <i>{getSortIndicator('priority')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('plan')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('plan');
                      }
                    }}
                    aria-sort={sortBy === 'plan' ? sortOrder : 'none'}
                  >
                    <span>План <i>{getSortIndicator('plan')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('timer')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('timer');
                      }
                    }}
                    aria-sort={sortBy === 'timer' ? sortOrder : 'none'}
                  >
                    <span>Таймер <i>{getSortIndicator('timer')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('start')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('start');
                      }
                    }}
                    aria-sort={sortBy === 'start' ? sortOrder : 'none'}
                  >
                    <span>Старт <i>{getSortIndicator('start')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('finish')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('finish');
                      }
                    }}
                    aria-sort={sortBy === 'finish' ? sortOrder : 'none'}
                  >
                    <span>Финиш <i>{getSortIndicator('finish')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('forecast')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('forecast');
                      }
                    }}
                    aria-sort={sortBy === 'forecast' ? sortOrder : 'none'}
                  >
                    <span>Прогноз <i>{getSortIndicator('forecast')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('fact')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('fact');
                      }
                    }}
                    aria-sort={sortBy === 'fact' ? sortOrder : 'none'}
                  >
                    <span>Факт <i>{getSortIndicator('fact')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('category')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('category');
                      }
                    }}
                    aria-sort={sortBy === 'category' ? sortOrder : 'none'}
                  >
                    <span>Категория <i>{getSortIndicator('category')}</i></span>
                  </th>

                  <th
                    scope="col"
                    className="tasks-table__sortable"
                    onClick={() => toggleSort('favorite')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('favorite');
                      }
                    }}
                    aria-sort={sortBy === 'favorite' ? sortOrder : 'none'}
                  >
                    <span>Избранное <i>{getSortIndicator('favorite')}</i></span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAndSortedTasks.map((task, index) => {
                  const favorite = isFavorite(task.id);
                  const favoriteLabel = favorite
                    ? `Убрать задачу "${task.title}" из избранного`
                    : `Добавить задачу "${task.title}" в избранное`;

                  const rowNumber = (currentPage - 1) * (limit || 20) + index + 1;

                  return (
                    <tr
                      key={task.id}
                      className={task.status === 'completed' ? 'row-completed' : 'row-pending'}
                    >
                      <td>{rowNumber}</td>

                      <td className="task-title-cell">
                        <div className="task-title-row">
                          <Link to={`/tasks/${task.id}`} className="task-link">
                            {task.title || `Задача ${index + 1}`}
                          </Link>

                          <div className="task-row-actions">{getTaskActionButtons(task)}</div>
                        </div>
                      </td>

                      <td>
                        <span className={getStatusClassName(task.status)}>
                          {getStatusLabel(task.status)}
                        </span>
                      </td>

                      <td>{task.priority || '—'}</td>

                      <td>{formatDateTimeShort(task.planned_start_local)}</td>

                      <td>
                        {formatTimeToStart(
                          task.planned_start_local,
                          task.actual_started_at,
                          task.status
                        )}
                      </td>

                      <td>{formatDateTimeShort(task.actual_started_at)}</td>

                      <td>{formatDateTimeShort(task.completed_at)}</td>

                      <td>{task.estimated_minutes ?? '—'} мин.</td>

                      <td>{task.actual_minutes ?? '—'} мин.</td>

                      <td>{categoryMap.get(String(task.category_id)) || '—'}</td>

                      <td>
                        <label htmlFor={`favorite-${task.id}`} className="toggle-switch">
                          <input
                            id={`favorite-${task.id}`}
                            type="checkbox"
                            checked={favorite}
                            onChange={() =>
                              favorite
                                ? removeTaskFromFavorites(task.id)
                                : addTaskToFavorites(task.id)
                            }
                            aria-label={favoriteLabel}
                          />
                          <span className="toggle-slider" aria-hidden="true" />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pagination}
      </section>
    </main>
  );
};

export default Tasks;