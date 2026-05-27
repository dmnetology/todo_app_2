import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';

const Details = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { addTaskToFavorites, removeTaskFromFavorites, isFavorite } = useTasks();

  const AUTH_TOKEN = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        if (!AUTH_TOKEN) {
          return;
        }

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
        setCategories(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCategories();
  }, [AUTH_TOKEN]);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!AUTH_TOKEN) {
          throw new Error('Токен авторизации не найден');
        }

        const response = await fetch(`http://localhost:8000/tasks/${id}`, {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();
        setTask(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTaskDetails();
    }
  }, [id, AUTH_TOKEN]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      map.set(String(category.id), category.name);
    });
    return map;
  }, [categories]);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
  };

  const formatMinutes = (value) => {
    return value === null || value === undefined ? '—' : `${value} мин.`;
  };

  const handleToggleFavorite = () => {
    if (!task?.id) return;

    if (isFavorite(task.id)) {
      removeTaskFromFavorites(task.id);
    } else {
      addTaskToFavorites(task.id);
    }
  };

  if (loading) {
    return <div>Загрузка информации о задаче...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Ошибка при загрузке задачи: {error}</div>;
  }

  if (!task) {
    return <div>Задача не найдена.</div>;
  }

  return (
    <div>
      <h2>Подробная информация по задаче</h2>

      <p><strong>ID:</strong> {task.id}</p>
      <p><strong>Название:</strong> {task.title}</p>
      <p><strong>Описание:</strong> {task.description || 'Нет описания'}</p>
      <p><strong>Статус:</strong> {task.is_completed ? 'Выполнена' : 'Не выполнена'}</p>
      <p><strong>Приоритет:</strong> {task.priority || '—'}</p>
      <p><strong>Срок выполнения:</strong> {formatDate(task.due_date)}</p>
      <p><strong>Создана:</strong> {formatDate(task.created_at)}</p>
      <p><strong>Выполнена:</strong> {formatDate(task.completed_at)}</p>
      <p><strong>Ожидаемое время:</strong> {formatMinutes(task.estimated_minutes)}</p>
      <p><strong>Фактическое время:</strong> {formatMinutes(task.actual_minutes)}</p>
      <p>
        <strong>Категория:</strong> {categoryMap.get(String(task.category_id)) || '—'}
      </p>

      <button
        onClick={handleToggleFavorite}
        style={{
          backgroundColor: isFavorite(task.id) ? '#ff4d4d' : '#4CAF50',
          color: 'white',
          padding: '10px 15px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '20px',
        }}
      >
        {isFavorite(task.id) ? 'Удалить из избранного' : 'Добавить в избранное'}
      </button>
    </div>
  );
};

export default Details;