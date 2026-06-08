import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TaskForm from '../components/Tasks/TaskForm';
import { useTasks } from '../context/TaskContext';
import './TaskDetails.scss';
import { formatDateTimeLocal } from '../utils/datetime';

const TASKS_API_URL = 'http://localhost:8000/tasks';
const CATEGORIES_API_URL = 'http://localhost:8000/categories';

const getClientTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

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

const emptyTask = {
  title: '',
  description: '',
  category_id: '',
  priority: 'medium',
  due_date: '',
  planned_start_local: '',
  planned_start_timezone: getClientTimezone(),
  estimated_minutes: '',
  actual_minutes: '',
  status: 'new',
};

const normalizeTaskPayload = (payload) => ({
  ...payload,
  category_id: payload.category_id ? Number(payload.category_id) : null,
  estimated_minutes:
    payload.estimated_minutes !== '' && payload.estimated_minutes != null
      ? Number(payload.estimated_minutes)
      : null,
  actual_minutes:
    payload.actual_minutes !== '' && payload.actual_minutes != null
      ? Number(payload.actual_minutes)
      : 0,
  due_date: payload.due_date || null,
  planned_start_local: payload.planned_start_local || null,
  planned_start_timezone:
    payload.planned_start_timezone || getClientTimezone(),
});

const TaskDetails = () => {
  const { id } = useParams();
  const isCreating = id === 'new';
  const navigate = useNavigate();
  const { fetchTasks } = useTasks();

  const [task, setTask] = useState(isCreating ? emptyTask : null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(!isCreating);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(isCreating);

  const AUTH_TOKEN = localStorage.getItem('access_token');

  const loadTaskAndCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const [taskResponse, categoriesResponse] = await Promise.all([
        fetch(`${TASKS_API_URL}/${id}`, {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(CATEGORIES_API_URL, {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!taskResponse.ok) {
        throw new Error(`Ошибка загрузки задачи: ${taskResponse.status}`);
      }

      if (!categoriesResponse.ok) {
        throw new Error(`Ошибка загрузки категорий: ${categoriesResponse.status}`);
      }

      const taskData = await taskResponse.json();
      const categoriesData = await categoriesResponse.json();

      setTask(taskData);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки задачи');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    const response = await fetch(CATEGORIES_API_URL, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки категорий: ${response.status}`);
    }

    const categoriesData = await response.json();
    setCategories(Array.isArray(categoriesData) ? categoriesData : []);
  };

  const init = async () => {
    if (isCreating) {
      setLoading(true);
      setError('');

      try {
        setTask(emptyTask);
        setEditing(true);
        await loadCategories();
      } catch (err) {
        setError(err.message || 'Ошибка загрузки категорий');
      } finally {
        setLoading(false);
      }

      return;
    }

    await loadTaskAndCategories();
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const categoryName = useMemo(() => {
    const found = categories.find(
      (category) => String(category.id) === String(task?.category_id)
    );
    return found?.name || 'Без категории';
  }, [categories, task]);

  const requestTaskAction = async (action) => {
    setActionLoading(action);
    setError('');

    try {
      const response = await fetch(`${TASKS_API_URL}/${id}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка выполнения действия "${action}": ${response.status}`);
      }

      await loadTaskAndCategories();
      await fetchTasks();
    } catch (err) {
      setError(err.message || 'Ошибка выполнения действия');
    } finally {
      setActionLoading('');
    }
  };

  const handleCreate = async (payload) => {
    setSaving(true);
    setError('');

    try {
      const normalizedPayload = normalizeTaskPayload(payload);

      const response = await fetch(TASKS_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.log('CREATE error response:', errorData);
        throw new Error(`Ошибка создания задачи: ${response.status}`);
      }

      const createdTask = await response.json().catch(() => null);

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

  const handleUpdate = async (payload) => {
    setSaving(true);
    setError('');

    try {
      const normalizedPayload = normalizeTaskPayload(payload);

      const response = await fetch(`${TASKS_API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.log('UPDATE error response:', errorData);
        throw new Error(`Ошибка обновления задачи: ${response.status}`);
      }

      await loadTaskAndCategories();
      await fetchTasks();
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Ошибка обновления задачи');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить задачу?')) return;

    try {
      const response = await fetch(`${TASKS_API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка удаления задачи: ${response.status}`);
      }

      navigate('/tasks');
    } catch (err) {
      setError(err.message || 'Ошибка удаления задачи');
    }
  };

  const handleCopy = () => {
    navigate('/tasks/new', {
      state: {
        mode: 'copy',
        task,
      },
    });
  };

  const status = task?.status;
  const isTaskNew = status === 'new';
  const isInProgress = status === 'in_progress';
  const isPaused = status === 'paused';
  const statusLabel = getStatusLabel(status);

  if (loading) {
    return (
      <main className="task-details">
        <p className="task-details__message">Загрузка задачи...</p>
      </main>
    );
  }

  if (error && !task && !isCreating) {
    return (
      <main className="task-details">
        <p className="task-details__message task-details__message--error" role="alert">
          {error}
        </p>
        <Link to="/tasks" className="task-details__back-link">
          Вернуться к списку задач
        </Link>
      </main>
    );
  }

  return (
    <main className="task-details">
      <header className="task-details__header">
        <div>
          <h1 className="task-details__title">
            {isCreating ? 'Новая задача' : task?.title}
          </h1>
          <p className="task-details__subtitle">
            {isCreating ? 'Заполните форму создания задачи' : task?.description || 'Нет описания'}
          </p>
        </div>

        <div className="task-details__actions">
          {!isCreating && isTaskNew && (
            <>
              <button
                type="button"
                className="task-details__button"
                onClick={() => requestTaskAction('start')}
                disabled={actionLoading === 'start'}
              >
                {actionLoading === 'start' ? 'Запуск...' : 'Начать выполнение'}
              </button>

              <button
                type="button"
                className="task-details__button task-details__button--danger"
                onClick={() => requestTaskAction('cancel')}
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' ? 'Отмена...' : 'Отмена'}
              </button>
            </>
          )}

          {!isCreating && isInProgress && (
            <>
              <button
                type="button"
                className="task-details__button"
                onClick={() => requestTaskAction('pause')}
                disabled={actionLoading === 'pause'}
              >
                {actionLoading === 'pause' ? 'Пауза...' : 'Пауза'}
              </button>

              <button
                type="button"
                className="task-details__button task-details__button--success"
                onClick={() => requestTaskAction('complete')}
                disabled={actionLoading === 'complete'}
              >
                {actionLoading === 'complete' ? 'Завершение...' : 'Задача выполнена'}
              </button>
            </>
          )}

          {!isCreating && isPaused && (
            <button
              type="button"
              className="task-details__button"
              onClick={() => requestTaskAction('resume')}
              disabled={actionLoading === 'resume'}
            >
              {actionLoading === 'resume' ? 'Возобновление...' : 'Возобновить'}
            </button>
          )}

          {!isCreating && (
            <>
              <button
                type="button"
                className="task-details__button"
                onClick={handleCopy}
              >
                Копировать
              </button>

              <button
                type="button"
                className="task-details__button"
                onClick={() => setEditing((prev) => !prev)}
              >
                {editing ? 'Скрыть форму' : 'Редактировать'}
              </button>

              <button
                type="button"
                className="task-details__button task-details__button--danger"
                onClick={handleDelete}
              >
                Удалить
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="task-details__error" role="alert">
          {error}
        </div>
      )}

      {!isCreating && task && (
        <section className="task-details__info">
          <div className="task-details__status">
            <span className="task-details__status-label">Статус</span>
            <span className="task-details__status-value">{statusLabel}</span>
          </div>

          <dl className="task-details__grid">
            <div>
              <dt>Категория</dt>
              <dd>{categoryName}</dd>
            </div>
            <div>
              <dt>Приоритет</dt>
              <dd>{task.priority || '—'}</dd>
            </div>
            <div>
              <dt>Плановый старт</dt>
              <dd>{formatDateTimeLocal(task.planned_start_local)}</dd>
            </div>
            <div>
              <dt>Часовой пояс</dt>
              <dd>{task.planned_start_timezone || '—'}</dd>
            </div>
            <div>
              <dt>Дедлайн</dt>
              <dd>{formatDateTimeLocal(task.due_date)}</dd>
            </div>
            <div>
              <dt>Прогноз</dt>
              <dd>{task.estimated_minutes ?? '—'} мин.</dd>
            </div>
            <div>
              <dt>Факт</dt>
              <dd>{task.actual_minutes ?? '—'} мин.</dd>
            </div>
            <div>
              <dt>Создана</dt>
              <dd>{formatDateTimeLocal(task.created_at)}</dd>
            </div>
            <div>
              <dt>Начата</dt>
              <dd>{formatDateTimeLocal(task.actual_started_at)}</dd>
            </div>
            <div>
              <dt>Текущий старт</dt>
              <dd>{formatDateTimeLocal(task.current_started_at)}</dd>
            </div>
            <div>
              <dt>Завершена</dt>
              <dd>{formatDateTimeLocal(task.completed_at)}</dd>
            </div>
          </dl>
        </section>
      )}

      {(editing || isCreating) && (
        <section className="task-details__panel">
          <h2 className="task-details__panel-title">
            {isCreating ? 'Создание задачи' : 'Редактирование задачи'}
          </h2>

          <TaskForm
            initialValues={task || emptyTask}
            categories={categories}
            onSubmit={isCreating ? handleCreate : handleUpdate}
            onCancel={() => {
              if (isCreating) {
                navigate('/tasks');
              } else {
                setEditing(false);
              }
            }}
            submitText={isCreating ? 'Создать' : 'Обновить'}
            loading={saving}
          />
        </section>
      )}

      <Link to="/tasks" className="task-details__back-link">
        ← Назад к списку
      </Link>
    </main>
  );
};

export default TaskDetails;