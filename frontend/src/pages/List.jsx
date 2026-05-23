// src/pages/List.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '../context/TaskContext'; // Импортируем хук

const List = () => {
  const { tasks, loading, error, addTaskToFavorites, removeTaskFromFavorites, isFavorite } = useTasks();

  if (loading) {
    return <div>Загрузка задач...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Ошибка при загрузке задач: {error}</div>;
  }

  return (
    <div>
      <h2>Список задач</h2>
      {tasks.length === 0 ? (
        <p>Задач пока нет.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {tasks.map((task) => (
            <div key={task.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
              <h3>
                <Link to={`/list/${task.id}`}>{task.title}</Link>
              </h3>
              <p>{task.description ? task.description.substring(0, 100) + '...' : 'Без описания'}</p>
              <p>
                <strong>Статус:</strong> {task.is_completed ? 'Выполнена' : 'Не выполнена'}
              </p>
              {task.category && <p><strong>Категория:</strong> {task.category.name}</p>}
              <button
                onClick={() => (isFavorite(task.id) ? removeTaskFromFavorites(task.id) : addTaskToFavorites(task.id))}
                style={{
                  backgroundColor: isFavorite(task.id) ? '#ff4d4d' : '#4CAF50',
                  color: 'white',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px',
                }}
              >
                {isFavorite(task.id) ? 'Удалить из избранного' : 'Добавить в избранное'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default List;