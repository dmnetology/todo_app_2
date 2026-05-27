import React from 'react';
import { useTasks } from '../context/TaskContext';
import { Link } from 'react-router-dom';
import './List.css';

const Favourites = () => {
  const { tasks, favorites, removeTaskFromFavorites, loading, error } = useTasks();

  const favoriteTasks = tasks.filter((task) => favorites.includes(task.id));

  if (loading && tasks.length === 0) {
    return (
      <main>
        <p role="status">Загрузка избранных задач...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <p role="alert" style={{ color: 'red' }}>
          Ошибка при загрузке задач: {error}
        </p>
      </main>
    );
  }

  return (
    <main className="list-container">
      <h1>Избранные задачи</h1>

      {favoriteTasks.length === 0 ? (
        <p>У вас пока нет избранных задач.</p>
      ) : (
        <ul className="task-grid" aria-label="Список избранных задач">
          {favoriteTasks.map((task) => (
            <li key={task.id} className="task-card">
              <h2>
                <Link to={`/list/${task.id}`}>
                  {task.title || `Задача ${task.id}`}
                </Link>
              </h2>

              <p>
                <strong>Описание:</strong> {task.description || '—'}
              </p>

              <p>
                <strong>Категория:</strong>{' '}
                {task.category?.name || task.category_name || 'Не указана'}
              </p>

              <p>
                <strong>Статус:</strong> {task.status || 'Не указан'}
              </p>

              <p>
                <strong>Приоритет:</strong> {task.priority || 'Не указан'}
              </p>

              <p>
                <strong>Начало:</strong>{' '}
                {task.planned_start_time
                  ? new Date(task.planned_start_time).toLocaleDateString()
                  : 'Не указано'}
              </p>

              <p>
                <strong>Прогнозное время:</strong>{' '}
                {task.predicted_completion_time
                  ? `${task.predicted_completion_time} ч.`
                  : 'Неизвестно'}
              </p>

              <button
                type="button"
                onClick={() => removeTaskFromFavorites(task.id)}
                className="remove-favorite-button"
                aria-label={`Удалить задачу "${task.title}" из избранного`}
              >
                Удалить из избранного
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default Favourites;