// src/pages/Details.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTasks } from '../context/TaskContext'; // Импортируем хук

// Токен.
const AUTH_TOKEN = localStorage.getItem('access_token');

const Details = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addTaskToFavorites, removeTaskFromFavorites, isFavorite } = useTasks();

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`http://localhost:8000/tasks/${id}`, {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
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
  }, [id]);

  if (loading) {
    return <div>Загрузка информации о задаче...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Ошибка при загрузке задачи: {error}</div>;
  }

  if (!task) {
    return <div>Задача не найдена.</div>;
  }

  const handleToggleFavorite = () => {
    if (isFavorite(task.id)) {
      removeTaskFromFavorites(task.id);
    } else {
      addTaskToFavorites(task.id);
    }
  };

  return (
    <div>
      <h2>{task.title}</h2>
      <p><strong>ID:</strong> {task.id}</p>
      <p><strong>Описание:</strong> {task.description || 'Нет описания'}</p>
      <p><strong>Статус:</strong> {task.is_completed ? 'Выполнена' : 'Не выполнена'}</p>
      {task.category && <p><strong>Категория:</strong> {task.category.name}</p>}
      <p><strong>Создана:</strong> {new Date(task.created_at).toLocaleString()}</p>
      <p><strong>Обновлена:</strong> {new Date(task.updated_at).toLocaleString()}</p>
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