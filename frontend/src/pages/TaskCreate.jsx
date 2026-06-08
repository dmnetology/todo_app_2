import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TaskForm from '../components/Tasks/TaskForm';
import { useTasks } from '../context/TaskContext';
import './TaskDetails.scss';

const TASKS_API_URL = 'http://localhost:8000/tasks';
const CATEGORIES_API_URL = 'http://localhost:8000/categories';

const getClientTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const emptyTask = {
  title: '',
  description: '',
  category_id: '',
  priority: 'medium',
  due_date: '',
  planned_start_local: '',
  planned_start_timezone: getClientTimezone(),
};

const normalizeTaskPayload = (payload) => ({
  ...payload,
  category_id: payload.category_id ? Number(payload.category_id) : null,
  due_date: payload.due_date || null,
  planned_start_local: payload.planned_start_local || null,
  planned_start_timezone: payload.planned_start_timezone || getClientTimezone(),
});

const splitDateTimeLocal = (value) => {
  if (!value || typeof value !== 'string') {
    return { date: '', time: '' };
  }

  const [date = '', time = ''] = value.split('T');
  return { date, time };
};

const combineDateAndTime = (date, time) => {
  if (!date || !time) return null;
  return `${date}T${time}`;
};

const buildDatesRange = (from, to) => {
  if (!from || !to) return [];

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  if (start > end) {
    return [];
  }

  const result = [];
  const current = new Date(start);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    result.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return result;
};

const getCopyInitialValues = (task) => ({
  title: task?.title ?? '',
  description: task?.description ?? '',
  category_id: task?.category_id ?? '',
  priority: task?.priority ?? 'medium',
  due_date: task?.due_date ?? '',
  planned_start_local: '',
  planned_start_timezone: task?.planned_start_timezone ?? getClientTimezone(),
});

const TaskCreate = () => {
  const { fetchTasks } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();

  const copyMode = location.state?.mode === 'copy';
  const copiedTask = location.state?.task || null;

  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copyModeType, setCopyModeType] = useState('single');
  const [singleDateTime, setSingleDateTime] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeTime, setRangeTime] = useState('');

  const AUTH_TOKEN = localStorage.getItem('access_token');

  const initialValues = useMemo(() => {
    if (copyMode && copiedTask) {
      return getCopyInitialValues(copiedTask);
    }

    return emptyTask;
  }, [copyMode, copiedTask]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(CATEGORIES_API_URL, {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка загрузки категорий: ${response.status}`);
        }

        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Ошибка загрузки категорий');
      }
    };

    loadCategories();
  }, [AUTH_TOKEN]);

  useEffect(() => {
    if (!copyMode) return;

    const sourceStart = copiedTask?.planned_start_local || '';
    const { date, time } = splitDateTimeLocal(sourceStart);

    setSingleDateTime(sourceStart || '');
    setRangeFrom(date || '');
    setRangeTo(date || '');
    setRangeTime(time || '');
  }, [copyMode, copiedTask]);

  const createTaskRequest = async (payload) => {
    const response = await fetch(TASKS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(normalizeTaskPayload(payload)),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.log('CREATE error response:', errorData);
      throw new Error(
        errorData?.detail ||
          errorData?.message ||
          `Ошибка создания задачи: ${response.status}`
      );
    }

    return response.json().catch(() => null);
  };

  const handleCreate = async (payload) => {
    setSaving(true);
    setError('');
    setCopyError('');

    try {
      if (copyMode) {
        if (!copiedTask) {
          throw new Error('Не удалось получить задачу для копирования');
        }

        if (copyModeType === 'single') {
          if (!singleDateTime) {
            setCopyError('Укажите дату и время');
            return;
          }

          const copyPayload = {
            ...payload,
            planned_start_local: singleDateTime,
          };

          const createdTask = await createTaskRequest(copyPayload);
          await fetchTasks();

          if (createdTask?.id) {
            navigate(`/tasks/${createdTask.id}`);
          } else {
            navigate('/tasks');
          }

          return;
        }

        const dates = buildDatesRange(rangeFrom, rangeTo);

        if (!dates.length) {
          setCopyError('Укажите корректный диапазон дат');
          return;
        }

        if (!rangeTime) {
          setCopyError('Укажите время');
          return;
        }

        const createdTasks = [];

        for (const date of dates) {
          const copyPayload = {
            ...payload,
            planned_start_local: combineDateAndTime(date, rangeTime),
          };

          const createdTask = await createTaskRequest(copyPayload);
          createdTasks.push(createdTask);
        }

        await fetchTasks();

        const firstCreatedId = createdTasks.find((item) => item?.id)?.id;
        if (firstCreatedId) {
          navigate(`/tasks/${firstCreatedId}`);
        } else {
          navigate('/tasks');
        }

        return;
      }

      const createdTask = await createTaskRequest(payload);
      await fetchTasks();

      if (createdTask?.id) {
        navigate(`/tasks/${createdTask.id}`);
      } else {
        navigate('/tasks');
      }
    } catch (err) {
      setError(err.message || 'Ошибка создания задачи');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="task-details">
      <header className="task-details__header">
        <div>
          <h1 className="task-details__title">
            {copyMode ? 'Копирование задачи' : 'Новая задача'}
          </h1>
          <p className="task-details__subtitle">
            {copyMode
              ? 'Заполните параметры копирования'
              : 'Заполните форму создания задачи'}
          </p>
        </div>
      </header>

      {error && (
        <div className="task-details__error" role="alert">
          {error}
        </div>
      )}

      {copyMode && (
        <section className="task-details__panel">
          <h2 className="task-details__panel-title">Параметры копирования</h2>

          <div className="task-form__field" style={{ marginBottom: '16px' }}>
            <label className="task-form__label" htmlFor="copyModeType">
              Режим
            </label>
            <select
              id="copyModeType"
              className="task-form__input"
              value={copyModeType}
              onChange={(e) => setCopyModeType(e.target.value)}
              disabled={saving}
            >
              <option value="single">Одна дата</option>
              <option value="range">Диапазон дат</option>
            </select>
          </div>

          {copyModeType === 'single' ? (
            <div className="task-form__field">
              <label className="task-form__label" htmlFor="singleDateTime">
                Дата и время
              </label>
              <input
                id="singleDateTime"
                type="datetime-local"
                className="task-form__input"
                value={singleDateTime}
                onChange={(e) => setSingleDateTime(e.target.value)}
                disabled={saving}
              />
            </div>
          ) : (
            <div className="task-form__row">
              <div className="task-form__field">
                <label className="task-form__label" htmlFor="rangeFrom">
                  Дата начала
                </label>
                <input
                  id="rangeFrom"
                  type="date"
                  className="task-form__input"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="task-form__field">
                <label className="task-form__label" htmlFor="rangeTo">
                  Дата окончания
                </label>
                <input
                  id="rangeTo"
                  type="date"
                  className="task-form__input"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="task-form__field">
                <label className="task-form__label" htmlFor="rangeTime">
                  Время
                </label>
                <input
                  id="rangeTime"
                  type="time"
                  className="task-form__input"
                  value={rangeTime}
                  onChange={(e) => setRangeTime(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {copyError && (
            <div className="task-details__error" role="alert">
              {copyError}
            </div>
          )}
        </section>
      )}

      <section className="task-details__panel">
        <h2 className="task-details__panel-title">
          {copyMode ? 'Данные задачи для копирования' : 'Создание задачи'}
        </h2>

        <TaskForm
          initialValues={initialValues}
          categories={categories}
          onSubmit={handleCreate}
          onCancel={() => navigate('/tasks')}
          submitText={copyMode ? 'Создать копии' : 'Создать'}
          loading={saving}
          readOnlyFields={copyMode ? ['planned_start_local', 'due_date'] : []}
          hideFields={copyMode ? ['planned_start_local', 'due_date'] : []}
        />
      </section>

      <button
        type="button"
        onClick={() => navigate('/tasks')}
        className="task-details__back-link"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        ← Назад к списку задач
      </button>
    </main>
  );
};

export default TaskCreate;